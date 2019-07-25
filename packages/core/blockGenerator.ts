import { Block, JsonRpcProvider } from 'ethers/providers';
import { withConnection, makeNullUndefined } from './db/db';
import { compact } from 'lodash';
import { getLast, getRangeAsString } from './utils';
import { getLogger } from './utils/logger';
import { SpockConfig } from './config';
import { Services } from './types';
import { BlockModel } from './db/models/Block';

const logger = getLogger('block-generator');

export async function blockGenerator(
  services: Services,
  fromBlockNo: number,
  toBlockNo?: number,
): Promise<void> {
  let currentBlockNo: number;

  const isFromBlockMissing = !(await getBlock(services, fromBlockNo));
  if (isFromBlockMissing) {
    logger.warn(`Initial block is missing. Starting from ${fromBlockNo}`);
    const blocks = await getRealBlocksStartingFrom(services, fromBlockNo);
    await addBlocks(services, blocks);
  }

  currentBlockNo = (await getLastBlockNo(services)) + 1;

  while (toBlockNo ? currentBlockNo < toBlockNo : true) {
    logger.info('Waiting for block:', currentBlockNo);

    const blocks = await getRealBlocksStartingFrom(services, currentBlockNo);
    const previousBlock = await getBlock(services, currentBlockNo - 1);

    if (!previousBlock) {
      throw new Error('Should not get here!');
    }

    if (!verifyBlocksConsistency(previousBlock, blocks)) {
      currentBlockNo = currentBlockNo - 1;
      logger.warn(`Backtracking to: ${currentBlockNo}`);

      await removeBlock(services, previousBlock.hash);

      continue;
    }
    logger.info(`Adding ${blocks.length} new blocks.`);
    await addBlocks(services, blocks);

    currentBlockNo = getLast(blocks)!.number + 1;
  }
}

async function addBlocks({ db, pg, columnSets }: Services, blocks: Block[]): Promise<BlockModel[]> {
  const values = blocks.map(block => ({
    number: block.number,
    hash: block.hash,
    timestamp: new Date(block.timestamp * 1000),
  }));
  logger.info(`Adding blocks ${getRangeAsString(blocks, b => b.number)}`);

  const persistedBlocks = await db.tx(async tx => {
    const addBlocksQuery =
      pg.helpers.insert(values, columnSets['block']) + 'ON CONFLICT(hash) DO NOTHING RETURNING *';

    const persistedBlocks = await tx.manyOrNone(addBlocksQuery);

    if (!persistedBlocks || persistedBlocks.length === 0) {
      return [];
    }

    return persistedBlocks;
  });

  return persistedBlocks || [];
}

async function getLastBlockNo({ db }: Services): Promise<number> {
  const lastBlockNo = await withConnection(db, connection => {
    return connection
      .oneOrNone<{ number: number }>(
        'SELECT number FROM vulcan2x.block ORDER BY number DESC LIMIT 1;',
      )
      .then(n => {
        if (n === null) {
          throw new Error('Last block couldnt be found. It should never happen');
        }
        return n;
      })
      .then(n => n.number);
  });

  logger.info(`Found last block number: ${lastBlockNo}`);

  return lastBlockNo;
}

async function removeBlock(services: Services, blockHash: string): Promise<void> {
  const { db } = services;
  await withConnection(db, async connection => {
    await connection.none(`DELETE FROM vulcan2x.block WHERE hash=\${hash};`, {
      hash: blockHash,
    });
  });
}

export async function getBlock({ db }: Services, blockNo: number): Promise<BlockModel | undefined> {
  return withConnection(db, connection => {
    return connection
      .oneOrNone<BlockModel>('SELECT * FROM vulcan2x.block WHERE number=$1;', blockNo)
      .then(makeNullUndefined);
  });
}

async function getRealBlocksStartingFrom(
  { provider, config }: Services,
  blockNo: number,
): Promise<Block[]> {
  logger.info(
    `Looking for ${config.blockGenerator.batch} external blocks starting from: ${blockNo}`,
  );
  const blocks = compact(
    await Promise.all(
      [...Array(config.blockGenerator.batch).keys()].map(offset =>
        provider.getBlock(blockNo + offset),
      ),
    ),
  );
  logger.info(`Got ${blocks.length} external blocks`);

  if (blocks.length !== 0) {
    return blocks;
  }

  return new Promise((resolve, reject) => {
    async function handleBlock(currentBlockNo: number): Promise<void> {
      try {
        if (currentBlockNo >= blockNo) {
          provider.removeListener('block', handleBlock);
          const block = await provider.getBlock(blockNo);
          if (!block) {
            reject(new Error("Couldn't get new block"));
          }
          resolve([block]);
        }
      } catch {
        reject(new Error("Couldn't get new block"));
      }
    }

    provider.on('block', handleBlock);
  });
}

function verifyBlocksConsistency(previousBlock: BlockModel, newBlocks: Block[]): boolean {
  let parentHash = previousBlock.hash;

  for (const block of newBlocks) {
    if (parentHash !== block.parentHash) {
      return false;
    }
    parentHash = block.hash;
  }

  return true;
}
