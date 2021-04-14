import { Block } from 'ethers/providers'
import { compact } from 'lodash'
import { assert } from 'ts-essentials'

import { DbConnection } from '../db/db'
import {
  BlockModel,
  getBlockByNumber,
  getLastBlockNumber,
  insertBlocksBatch,
  removeBlockByHash,
  WritableBlockModel,
} from '../db/models/Block'
import { Services } from '../services/types'
import { getLast } from '../utils/arrays'
import { getSpockBreakout } from '../utils/breakout'
import { getLogger } from '../utils/logger'

const logger = getLogger('block-generator')

export class BlockGenerator {
  constructor(private readonly services: Services) {}
  private connection!: DbConnection

  async init() {
    this.connection = await this.services.db.connect()
  }

  async deinit() {
    this.connection.done()
  }

  public async run(fromBlockNo: number, toBlockNo?: number): Promise<void> {
    const isFromBlockMissing = !(await getBlockByNumber(this.connection, fromBlockNo))
    if (isFromBlockMissing) {
      logger.warn(`Initial block is missing. Starting from ${fromBlockNo}`)
      const blocks = await getRealBlocksStartingFrom(this.services, fromBlockNo)
      await insertBlocksBatch(this.connection, this.services.pg, blocks.map(block2BlockModel))
    }

    const lastBlockNumber = await getLastBlockNumber(this.connection)
    assert(lastBlockNumber, `Last block couldn't be found. It should never happen at this point`)

    let currentBlockNo = lastBlockNumber + 1

    // eslint-disable-next-line
    while (toBlockNo ? currentBlockNo < toBlockNo : true && !getSpockBreakout()) {
      logger.info('Waiting for block:', currentBlockNo)

      const blocks = await getRealBlocksStartingFrom(this.services, currentBlockNo)
      const previousBlock = await getBlockByNumber(this.connection, currentBlockNo - 1)
      assert(previousBlock, 'previousBlock should be defined')

      if (!verifyBlocksConsistency(previousBlock, blocks)) {
        currentBlockNo = currentBlockNo - 1
        logger.warn(`Backtracking to: ${currentBlockNo}`)

        await removeBlockByHash(this.connection, previousBlock.hash)

        continue
      }
      logger.info(`Adding ${blocks.length} new blocks.`)
      await insertBlocksBatch(this.connection, this.services.pg, blocks.map(block2BlockModel))

      currentBlockNo = getLast(blocks)!.number + 1
    }
  }
}

function block2BlockModel(block: Block): WritableBlockModel {
  return {
    number: block.number,
    hash: block.hash,
    timestamp: new Date(block.timestamp * 1000),
  }
}

async function getRealBlocksStartingFrom({ config, provider }: Services, blockNo: number): Promise<Block[]> {
  logger.info(`Looking for ${config.blockGenerator.batch} external blocks starting from: ${blockNo}`)
  const blocks = compact(
    await Promise.all(
      [...Array(config.blockGenerator.batch).keys()].map((offset) => provider.getBlock(blockNo + offset)),
    ),
  )
  logger.info(`Got ${blocks.length} external blocks`)

  if (blocks.length !== 0) {
    return blocks
  }

  return new Promise((resolve, reject) => {
    async function handleBlock(currentBlockNo: number): Promise<void> {
      try {
        if (currentBlockNo >= blockNo) {
          provider.removeListener('block', handleBlock)
          const block = await provider.getBlock(blockNo)
          if (!block) {
            reject(new Error("Couldn't get new block"))
          }
          resolve([block])
        }
      } catch {
        reject(new Error("Couldn't get new block"))
      }
    }

    provider.on('block', handleBlock)
  })
}

function verifyBlocksConsistency(previousBlock: BlockModel, newBlocks: Block[]): boolean {
  let parentHash = previousBlock.hash

  for (const block of newBlocks) {
    if (parentHash !== block.parentHash) {
      return false
    }
    parentHash = block.hash
  }

  return true
}
