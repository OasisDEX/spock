import { prepareDB } from './db';
import { SpockConfig, getDefaultConfig } from 'spock-etl/dist/config';
import { Services } from 'spock-etl/dist/types';
import { createDB } from 'spock-etl/dist/db/db';
import { NetworkState } from 'spock-etl/dist/ethereum/getNetworkState';

export async function prepareServices(): Promise<Services> {
  const dbCtx = createDB(testConfig.db);
  await prepareDB(dbCtx.db, testConfig);

  return {
    db: dbCtx.db,
    pg: dbCtx.pg,
    config: testConfig,
    columnSets: undefined as any,
    provider: undefined as any,
    networkState,
    processorsState: {},
  };
}

export const networkState: NetworkState = {
  latestEthereumBlockOnStart: 1,
  networkName: { name: 'test', chainId: 1337, ensAddress: '0x0' },
};

export const testConfig: SpockConfig = {
  ...getDefaultConfig({
    VL_DB_DATABASE: 'database',
    VL_DB_USER: 'user',
    VL_DB_PASSWORD: 'password',
    VL_DB_HOST: 'localhost',
    VL_DB_PORT: '5432',
    VL_CHAIN_HOST: '',
    VL_CHAIN_NAME: '',
  }),
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
} as any;
