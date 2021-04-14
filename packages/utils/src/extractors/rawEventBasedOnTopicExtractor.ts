import { BlockModel } from '@oasisdex/spock-etl/dist/db/models/Block'
import { isGanache } from '@oasisdex/spock-etl/dist/ethereum/getNetworkState'
import { BlockExtractor } from '@oasisdex/spock-etl/dist/processors/types'
import { LocalServices, TransactionalServices } from '@oasisdex/spock-etl/dist/services/types'
import { getLast } from '@oasisdex/spock-etl/dist/utils/arrays'
import { timer } from '@oasisdex/spock-etl/dist/utils/timer'
import { ethers } from 'ethers'
import { Log } from 'ethers/providers'
import { groupBy, max, min, uniqBy } from 'lodash'

import { getOrCreateTx } from './common'

interface AbiInfo {
  name: string
  abi: Object
  startingBlock?: number
}

export function makeRawEventBasedOnTopicExtractor(abis: AbiInfo[]): BlockExtractor[] {
  return abis.map((abi) => {
    const iface = new ethers.utils.Interface(abi.abi as any)
    const allTopics = Object.values(iface.events).map((e) => e.topic)

    return {
      name: getExtractorName(abi.name),
      startingBlock: abi.startingBlock,
      address: abi,
      extract: async (services, blocks) => {
        await extractRawLogsOnTopic(services, blocks, allTopics)
      },
      async getData(services: LocalServices, blocks: BlockModel[]): Promise<any> {
        return await getPersistedLogsByTopic(services, allTopics, blocks)
      },
    }
  })
}

export async function extractRawLogsOnTopic(
  services: TransactionalServices,
  blocks: BlockModel[],
  topics: string[],
): Promise<PersistedLog[]> {
  const logs = await getLogsBasedOnTopics(services, blocks, topics)

  const blocksByHash = groupBy(blocks, 'hash')
  const allTxs = uniqBy(
    logs.map((l) => ({ txHash: l.transactionHash!, blockHash: l.blockHash! })),
    'txHash',
  )
  const allStoredTxs = await Promise.all(
    allTxs.map((tx) => getOrCreateTx(services, tx.txHash, blocksByHash[tx.blockHash][0])),
  )
  const allStoredTxsByTxHash = groupBy(allStoredTxs, 'hash')

  const logsToInsert = (
    await Promise.all(
      logs.map(async (log) => {
        const _block = blocksByHash[log.blockHash!]
        // eslint-disable-next-line
        if (!_block) {
          return
        }
        const block = _block[0]
        const storedTx = allStoredTxsByTxHash[log.transactionHash!][0]

        return {
          ...log,
          address: log.address.toLowerCase(), // always use lower case
          log_index: log.logIndex,
          block_id: block.id,
          tx_id: storedTx.id,
        }
      }),
    )
  ).filter((log) => !!log)

  let insertedLogs: PersistedLog[] = []
  if (logsToInsert.length !== 0) {
    const addingLogs = timer(`adding-logs`, `with: ${logsToInsert.length} logs`)
    const query = services.pg.helpers.insert(logsToInsert, services.columnSets['extracted_logs']) + ' RETURNING *'
    insertedLogs = await services.tx.many<PersistedLog>(query)
    addingLogs()
  }

  return insertedLogs
}

export async function getPersistedLogsByTopic(
  services: LocalServices,
  topics: string[],
  blocks: BlockModel[],
): Promise<any[]> {
  const blocksIds = blocks.map((b) => b.id)
  const minId = min(blocksIds)
  const maxId = max(blocksIds)

  const result =
    (await services.tx.manyOrNone(
      `
  SELECT * FROM extracted.logs
  WHERE logs.block_id >= \${id_min} AND logs.block_id <= \${id_max} AND (
    ${topics.map((t) => `logs.topics LIKE '%${t}%'`).join(' OR ')}
  );
    `,
      {
        id_min: minId,
        id_max: maxId,
      },
    )) || []

  return result
}

export function getExtractorName(name: string): string {
  return `raw_log_topic_${name}_extractor`
}

export interface PersistedLog {
  block_id: number
  tx_id: number
  log_index: number
  address: string
  data: string
  topics: string
}

export async function getLogsBasedOnTopics(
  services: TransactionalServices,
  blocks: BlockModel[],
  topics: string[],
): Promise<Log[]> {
  // we want to find any matching topic so we construct OR request
  // docs: https://github.com/ethereum/wiki/wiki/JSON-RPC#eth_newfilter
  const topicsRequest = [topics]
  if (blocks.length === 0) {
    return []
  } else if (blocks.length === 1 && !isGanache(services.networkState)) {
    // note: ganache doesnt support this RPC call so we avoid id
    return await services.provider.getLogs({
      blockHash: blocks[0].hash,
      topics: topicsRequest,
    })
  } else {
    const fromBlock = blocks[0].number
    const toBlock = getLast(blocks)!.number

    return await services.provider.getLogs({
      topics: topicsRequest,
      fromBlock,
      toBlock,
    })
  }
}
