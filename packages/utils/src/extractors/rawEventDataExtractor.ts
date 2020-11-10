import { BlockModel } from '@oasisdex/spock-etl/dist/db/models/Block'
import { isGanache } from '@oasisdex/spock-etl/dist/ethereum/getNetworkState'
import { BlockExtractor } from '@oasisdex/spock-etl/dist/processors/types'
import { LocalServices, TransactionalServices } from '@oasisdex/spock-etl/dist/services/types'
import { getLast } from '@oasisdex/spock-etl/dist/utils/arrays'
import { timer } from '@oasisdex/spock-etl/dist/utils/timer'
import { Log } from 'ethers/providers'
import { groupBy, max, min, uniqBy } from 'lodash'
import { isString } from 'util'

import { getOrCreateTx } from './common'

export interface SimpleProcessorDefinition {
  address: string
  startingBlock?: number
}

export function makeRawLogExtractors(_extractors: (string | SimpleProcessorDefinition)[]): BlockExtractor[] {
  const extractors = _extractors.map((a) => {
    const address = isString(a) ? a.toLowerCase() : a.address.toLowerCase()
    const startingBlock = isString(a) ? undefined : a.startingBlock
    return {
      address,
      startingBlock,
    }
  })

  return extractors.map((extractor) => ({
    name: getExtractorName(extractor.address),
    startingBlock: extractor.startingBlock,
    extract: async (services, blocks) => {
      await extractRawLogs(services, blocks, extractor.address)
    },
    async getData(services: LocalServices, blocks: BlockModel[]): Promise<any> {
      return await getPersistedLogs(services, [extractor.address], blocks)
    },
  }))
}

export async function extractRawLogs(
  services: TransactionalServices,
  blocks: BlockModel[],
  address: string | string[],
): Promise<PersistedLog[]> {
  const wholeExtractTimer = timer('whole-extract')

  const gettingLogs = timer('getting-logs')
  const logs = await getLogs(services, blocks, address)
  gettingLogs()

  const processingLogs = timer(`processing-logs`, `with: ${logs.length}`)

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
  processingLogs()

  let insertedLogs: PersistedLog[] = []
  if (logsToInsert.length !== 0) {
    const addingLogs = timer(`adding-logs`, `with: ${logsToInsert.length} logs`)
    const query = services.pg.helpers.insert(logsToInsert, services.columnSets['extracted_logs']) + ' RETURNING *'
    insertedLogs = await services.tx.many<PersistedLog>(query)
    addingLogs()
  }

  wholeExtractTimer()

  return insertedLogs
}

export async function getPersistedLogs(
  services: LocalServices,
  addresses: string[],
  blocks: BlockModel[],
): Promise<any[]> {
  if (addresses.length === 0) {
    return []
  }

  const blocksIds = blocks.map((b) => b.id)
  const minId = min(blocksIds)
  const maxId = max(blocksIds)

  return (
    (await services.tx.manyOrNone(
      `
SELECT * FROM extracted.logs
WHERE logs.block_id >= \${id_min} AND logs.block_id <= \${id_max} AND address IN (\${addresses:csv});
  `,
      {
        addresses,
        id_min: minId,
        id_max: maxId,
      },
    )) || []
  )
}

export function getExtractorName(address: string): string {
  return `raw_log_${address.toLowerCase()}_extractor`
}

export interface PersistedLog {
  block_id: number
  tx_id: number
  log_index: number
  address: string
  data: string
  topics: string
}

export async function getLogs(
  services: TransactionalServices,
  blocks: BlockModel[],
  address: string[] | string,
): Promise<Log[]> {
  if (blocks.length === 0) {
    return []
  } else if (blocks.length === 1 && !isGanache(services.networkState)) {
    // note: ganache doesnt support this RPC call so we avoid id
    return await services.provider.getLogs({
      address,
      blockHash: blocks[0].hash,
    })
  } else {
    const fromBlock = blocks[0].number
    const toBlock = getLast(blocks)!.number

    return await services.provider.getLogs({
      address,
      fromBlock,
      toBlock,
    })
  }
}
