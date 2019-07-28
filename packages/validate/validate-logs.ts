/**
 * Script to automatically compare data stored in vulcan2x vs google big query public dataset.
 */
import { BigQuery } from '@google-cloud/bigquery';
import { createServices } from '../core/services';
import { withConnection } from '../core/db/db';

import { getLastBlockBQ, countBQ, countV2, findObservedAddresses } from './common';
import { SpockConfig } from '../core/config';
import { getLogger } from '../core/utils/logger';

const logger = getLogger('validate');

export async function validate(config: SpockConfig): Promise<void> {
  logger.info(`Running...`);
  if (config.chain.name !== 'mainnet') {
    logger.error('Only mainnet is supported');
    process.exit(1);
  }

  const spockServices = await createServices(config);
  const bigQueryClient = new BigQuery();

  // big query has 1 day delay, so we query for last block that they are aware of
  const lastBlock = await getLastBlockBQ(bigQueryClient);
  const firstBlock = config.startingBlock;
  const contracts = findObservedAddresses(config);
  logger.info(`Log sources: ${contracts.join(', ')}`);

  const bigQueryCount = await countBQ(bigQueryClient, contracts, lastBlock, firstBlock);
  const vulcan2xCount = await withConnection(spockServices.db, c => {
    return countV2(c, contracts, lastBlock, firstBlock);
  });

  logger.info(`Last recorded block on GBQ: ${lastBlock}`);
  logger.info(`BQ events: ${bigQueryCount}`);
  logger.info(`Vulcan2x events: ${vulcan2xCount}`);

  if (vulcan2xCount === 0) {
    throw new Error('No events found! Probably something is wrong!');
  }

  const diff = bigQueryCount - vulcan2xCount;

  logger.info(`Difference is ${diff}`);
  if (diff > 0) {
    logger.error(`Lost events detected! Failing!`);
    process.exit(1);
  } else {
    logger.info('Everything is fine!');
  }
}
