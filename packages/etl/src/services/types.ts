import { Provider } from 'ethers/providers'
import pgPromise from 'pg-promise'
import { StrictOmit } from 'ts-essentials'

import { ColumnSets, DB, DbTransactedConnection } from '../db/db'
import { NetworkState } from '../ethereum/getNetworkState'
import { ProcessorsState } from '../processors/state'
import { SpockConfig } from './config'

export interface Services {
  provider: Provider
  db: DB
  pg: pgPromise.IMain
  config: SpockConfig
  columnSets: ColumnSets
  networkState: NetworkState
  processorsState: ProcessorsState
}

export interface TransactionalServices extends StrictOmit<Services, 'db'> {
  tx: DbTransactedConnection
}

// No external data sources like blockchain
export type LocalServices = Omit<TransactionalServices, 'provider'>
