import { makeNullUndefined, DbConnection, Connection } from '../db'

export interface BlockModel {
  id: number
  number: number
  hash: string
  timestamp: string
}

export async function getBlock(c: Connection, blockHash: string): Promise<BlockModel | undefined> {
  return c.oneOrNone<BlockModel>('SELECT * FROM vulcan2x.block WHERE hash=$1;', blockHash).then(makeNullUndefined)
}

export async function getBlockById(c: Connection, id: number): Promise<BlockModel | undefined> {
  return c.oneOrNone<BlockModel>('SELECT * FROM vulcan2x.block WHERE id=$1;', id).then(makeNullUndefined)
}

export async function getBlockByNumber(c: DbConnection, id: number): Promise<BlockModel | undefined> {
  return c.oneOrNone<BlockModel>('SELECT * FROM vulcan2x.block WHERE number=$1;', id).then(makeNullUndefined)
}

export async function getBlockByIdOrDie(c: Connection, id: number): Promise<BlockModel> {
  return c
    .oneOrNone<BlockModel>('SELECT * FROM vulcan2x.block WHERE id=$1;', id)
    .then(makeNullUndefined)
    .then((r) => {
      if (!r) {
        throw new Error(`Block(id=${id}) is missing`)
      }
      return r
    })
}

export async function getBlockRange(c: Connection, start: number, end: number): Promise<BlockModel[]> {
  const sql = `
SELECT * FROM vulcan2x.block
WHERE id >= ${start} AND id <= ${end}
  `

  return c.manyOrNone<BlockModel>(sql)
}
