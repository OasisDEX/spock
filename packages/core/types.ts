import { DB, ColumnSets, DbTransactedConnection } from './db/db';
import { JsonRpcProvider } from 'ethers/providers';
import { StrictOmit } from 'ts-essentials';
import pgPromise = require('pg-promise');
import { SpockConfig } from './config';
import { NetworkState } from './ethereum/getNetworkState';

export interface Services {
  provider: JsonRpcProvider;
  db: DB;
  pg: pgPromise.IMain;
  config: SpockConfig;
  columnSets: ColumnSets;
  networkState: NetworkState;
}

export interface TransactionalServices extends StrictOmit<Services, 'db'> {
  tx: DbTransactedConnection;
}

// No external data sources like blockchain
export type LocalServices = Omit<TransactionalServices, 'provider'>;
