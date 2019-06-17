/**
 * Script to automatically compare data stored in vulcan2x vs google big query public dataset.
 */
import { BigQuery } from '@google-cloud/bigquery';

import { getDefaultConfig } from '../../spock-core/config';
import { createDB, withConnection } from '../../spock-core/db/db';
import { getLastBlockBQ, countBQ, countV2 } from './common';

const bigQueryClient = new BigQuery();
const config = getDefaultConfig(process.env);
const db = createDB(config.db);
const contracts = config.extractors.map(e => (e as any).address);

async function main(): Promise<void> {
  console.log(`Running...`);

  const maxBlock = await getLastBlockBQ(bigQueryClient);
  const minBlock = 4751582;

  await findNotSyncedBlocks(minBlock, maxBlock);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});

async function findNotSyncedBlocks(minBlock: number, maxBlock: number): Promise<number> {
  const diff = await getDiff(minBlock, maxBlock);

  if (diff === 0) {
    return diff;
  }

  if (minBlock === maxBlock) {
    return diff;
  }

  const midPoint = Math.floor(minBlock + (maxBlock - minBlock) / 2);
  if (midPoint === minBlock || midPoint === maxBlock) {
    await findNotSyncedBlocks(minBlock, minBlock);
    await findNotSyncedBlocks(maxBlock, maxBlock);
  } else {
    await findNotSyncedBlocks(midPoint, maxBlock);
    await findNotSyncedBlocks(minBlock, midPoint);
  }

  return diff;
}

async function getDiff(minBlock: number, maxBlock: number): Promise<number> {
  const bigQueryCount = await countBQ(bigQueryClient, contracts, maxBlock, minBlock);
  const vulcan2xCount = await withConnection(db.db, c => {
    return countV2(c, contracts, maxBlock, minBlock);
  });

  console.log(`Checking ${minBlock} - ${maxBlock} (range: ${maxBlock - minBlock})`);
  console.log(`BQ events: ${bigQueryCount}`);
  console.log(`Vulcan2x events: ${vulcan2xCount}`);

  const diff = bigQueryCount - vulcan2xCount;
  console.log(`Diff: ${diff}`);
  if (diff > 0 && minBlock === maxBlock) {
    console.log(`FOUND NOT SYNCED BLOCK! Diff: ${diff}`);
  }
  console.log('-----------------------');

  return diff;
}
