import { DeepPartial } from 'ts-essentials';
import { merge } from 'lodash';

import { prepareDB } from './db';
import { SpockConfig, getDefaultConfig, getAllProcessors } from 'spock-etl/dist/config';
import { Services } from 'spock-etl/dist/types';
import { createDB } from 'spock-etl/dist/db/db';
import { getRandomProvider, createProviders } from 'spock-etl/dist/services';
import { NetworkState, getNetworkState } from 'spock-etl/dist/ethereum/getNetworkState';
import { getInitialProcessorsState } from 'spock-etl/dist/processors/state';

export async function createTestServices(services: Partial<Services> = {}): Promise<Services> {
  const config = services.config ?? getTestConfig();
  const dbCtx = createDB(config.db);
  await prepareDB(dbCtx.db, config);
  createProviders(config);
  const provider = getRandomProvider();
  const networkState = config.chain.host ? await getNetworkState(provider) : dummyNetworkState;

  return {
    ...dbCtx,
    config,
    provider,
    networkState,
    processorsState: getInitialProcessorsState(getAllProcessors(config)),
    ...services,
  };
}

export async function destroyTestServices(services: Services): Promise<void> {
  await services.db.$pool.end();
}

export const dummyNetworkState: NetworkState = {
  latestEthereumBlockOnStart: 1,
  networkName: { name: 'test', chainId: 1337, ensAddress: '0x0' },
};

export function getTestConfig(customConfig: DeepPartial<SpockConfig> = {}): SpockConfig {
  return merge(
    {},
    getDefaultConfig({
      VL_DB_DATABASE: 'database',
      VL_DB_USER: 'user',
      VL_DB_PASSWORD: 'password',
      VL_DB_HOST: 'localhost',
      VL_DB_PORT: '5432',
      VL_CHAIN_HOST: '',
      VL_CHAIN_NAME: '',
    }),
    {
      blockGenerator: {
        batch: 2,
      },
      extractorWorker: {
        batch: 2,
        reorgBuffer: 10,
      },
      startingBlock: 0,
      processorsWorker: {
        retriesOnErrors: 1,
      },
      migrations: {},
      statsWorker: {
        enabled: false,
      },
      extractors: [],
      transformers: [],
    },
    customConfig,
  ) as any;
}
