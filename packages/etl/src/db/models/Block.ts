import { LocalServices } from '../../services/types'
import { makeNullUndefined, DbConnection } from '../db'

export interface BlockModel {
  id: number
  number: number
  hash: string
  timestamp: string
}

export async function getBlock({ tx }: LocalServices, blockHash: string): Promise<BlockModel | undefined> {
  return tx.oneOrNone<BlockModel>('SELECT * FROM vulcan2x.block WHERE hash=$1;', blockHash).then(makeNullUndefined)
}

export async function getBlockById({ tx }: LocalServices, id: number): Promise<BlockModel | undefined> {
  return tx.oneOrNone<BlockModel>('SELECT * FROM vulcan2x.block WHERE id=$1;', id).then(makeNullUndefined)
}

export async function getBlockByNumber(c: DbConnection, id: number): Promise<BlockModel | undefined> {
  return c.oneOrNone<BlockModel>('SELECT * FROM vulcan2x.block WHERE number=$1;', id).then(makeNullUndefined)
}

export async function getBlockByIdOrDie({ tx }: LocalServices, id: number): Promise<BlockModel> {
  return tx
    .oneOrNone<BlockModel>('SELECT * FROM vulcan2x.block WHERE id=$1;', id)
    .then(makeNullUndefined)
    .then((r) => {
      if (!r) {
        throw new Error(`Block(id=${id}) is missing`)
      }
      return r
    })
}

export async function getBlockRange({ tx }: LocalServices, start: number, end: number): Promise<BlockModel[]> {
  const sql = `
SELECT * FROM vulcan2x.block
WHERE id >= ${start} AND id <= ${end}
  `

  return tx.manyOrNone<BlockModel>(sql)
}
