import { Block, JsonRpcProvider } from 'ethers/providers';
import { DB, withConnection, makeNullUndefined, DbTransactedConnection, ColumnSets } from './db/db';
import { Omit } from 'ts-essentials';
import { compact } from 'lodash';
import { getLast, getRangeAsString, getRange } from './utils';
import pgPromise = require('pg-promise');
import { getLogger } from './utils/logger';
import { SpockConfig } from './config';

const logger = getLogger('block-generator');

export async function blockGenerator(
  services: Services,
  fromBlockNo: number,
  onNewBlocks: NewBlockHandler = async () => {},
): Promise<void> {
  let currentBlockNo: number;

  const isFromBlockMissing = !(await getBlock(services, fromBlockNo));
  if (isFromBlockMissing) {
    logger.warn(`Initial block is missing. Starting from ${fromBlockNo}`);
    const blocks = await getRealBlocksStartingFrom(services, fromBlockNo);
    await addBlocks(services, blocks, onNewBlocks);
  }

  currentBlockNo = (await getLastBlockNo(services)) + 1;

  while (true) {
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
    await addBlocks(services, blocks, onNewBlocks);

    currentBlockNo = getLast(blocks)!.number + 1;
  }
}

export interface PersistedBlock {
  id: number;
  number: number;
  hash: string;
  timestamp: string;
}

export interface Services {
  provider: JsonRpcProvider;
  db: DB;
  pg: pgPromise.IMain;
  config: SpockConfig;
  columnSets: ColumnSets;
}

export interface TransactionalServices extends Omit<Services, 'db'> {
  tx: DbTransactedConnection;
}

async function addBlocks(
  { db, pg, columnSets }: Services,
  blocks: Block[],
  onNewBlocks: NewBlockHandler,
): Promise<PersistedBlock[]> {
  const values = blocks.map(block => ({
    number: block.number,
    hash: block.hash,
    timestamp: new Date(block.timestamp * 1000),
  }));
  logger.info(`Adding blocks ${getRangeAsString(blocks, b => b.number)}`);

  const persistedBlocks = await withConnection(db, async c => {
    const addBlocksQuery =
      pg.helpers.insert(values, columnSets['block']) + 'ON CONFLICT(hash) DO NOTHING';

    await c.none(addBlocksQuery);

    const range = getRange(values, v => v.number);
    if (!range) {
      return;
    }

    const res = await c.many<PersistedBlock>(
      'SELECT * FROM vulcan2x.block WHERE number >= ${first} AND number <= ${last}',
      { first: range.first, last: range.last },
    );

    return res;
  });

  if (!persistedBlocks) {
    return [];
  }

  return await db.tx(async tx => {
    await onNewBlocks(tx, persistedBlocks);
    return persistedBlocks;
  });
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

export async function getBlock(
  { db }: Services,
  blockNo: number,
): Promise<PersistedBlock | undefined> {
  return withConnection(db, connection => {
    return connection
      .oneOrNone<PersistedBlock>('SELECT * FROM vulcan2x.block WHERE number=$1;', blockNo)
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

type NewBlockHandler = (tx: DbTransactedConnection, blocks: PersistedBlock[]) => Promise<any>;

function verifyBlocksConsistency(previousBlock: PersistedBlock, newBlocks: Block[]): boolean {
  let parentHash = previousBlock.hash;

  for (const block of newBlocks) {
    if (parentHash !== block.parentHash) {
      return false;
    }
    parentHash = block.hash;
  }

  return true;
}
