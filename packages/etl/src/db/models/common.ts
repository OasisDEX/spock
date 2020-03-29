import { DbConnection, DbTransactedConnection } from '../db'

export type Connection = DbConnection | DbTransactedConnection
