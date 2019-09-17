import { DB, ColumnSets, DbTransactedConnection } from './db/db';
import { Provider } from 'ethers/providers';
import { StrictOmit } from 'ts-essentials';
import pgPromise = require('pg-promise');
import { SpockConfig } from './config';
import { NetworkState } from './ethereum/getNetworkState';
import { ProcessorsState } from './processors/state';

export interface Services {
  provider: Provider;
  db: DB;
  pg: pgPromise.IMain;
  config: SpockConfig;
  columnSets: ColumnSets;
  networkState: NetworkState;
  processorsState: ProcessorsState;
}

export interface TransactionalServices extends StrictOmit<Services, 'db'> {
  tx: DbTransactedConnection;
}

// No external data sources like blockchain
export type LocalServices = Omit<TransactionalServices, 'provider'>;
