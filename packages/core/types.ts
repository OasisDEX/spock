import { DB, ColumnSets } from './db/db';
import { JsonRpcProvider } from 'ethers/providers';
import pgPromise = require('pg-promise');
import { SpockConfig } from './config';

export interface Services {
  provider: JsonRpcProvider;
  db: DB;
  pg: pgPromise.IMain;
  config: SpockConfig;
  columnSets: ColumnSets;
}
