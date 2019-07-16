import { DB, ColumnSets, DbTransactedConnection } from './db/db';
import { JsonRpcProvider } from 'ethers/providers';
import { StrictOmit } from 'ts-essentials';
import pgPromise = require('pg-promise');
import { SpockConfig } from './config';

export interface Services {
  provider: JsonRpcProvider;
  db: DB;
  pg: pgPromise.IMain;
  config: SpockConfig;
  columnSets: ColumnSets;
}

export interface TransactionalServices extends StrictOmit<Services, 'db'> {
  tx: DbTransactedConnection;
}

// No external data sources like blockchain
export type LocalServices = Omit<TransactionalServices, 'provider'>;

export interface PersistedBlock {
  id: number;
  number: number;
  hash: string;
  timestamp: string;
}
