// eslint false positive
// eslint-disable-next-line
import type pg from 'pg-promise'

import { makeNullUndefined, DbConnection, Connection } from '../db'

export interface BlockModel {
  id: number
  number: number
  hash: string
  timestamp: string
}

export interface WritableBlockModel {
  number: number
  hash: string
  timestamp: Date
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

export async function getLastBlockNumber(c: Connection): Promise<number | undefined> {
  const lastBlock = await c.oneOrNone<{ number: number }>(
    'SELECT number FROM vulcan2x.block ORDER BY number DESC LIMIT 1;',
  )

  return lastBlock?.number
}

export async function removeBlockByHash(c: Connection, blockHash: string): Promise<void> {
  await c.none('DELETE FROM vulcan2x.block WHERE hash=${hash};', {
    hash: blockHash,
  })
}

export async function insertBlocksBatch(
  c: Connection,
  pg: pg.IMain,
  blocks: WritableBlockModel[],
): Promise<BlockModel[]> {
  const BLOCK_COLUMN_SET = new pg.helpers.ColumnSet(['number', 'hash', 'timestamp'], {
    table: new pg.helpers.TableName({ table: 'block', schema: 'vulcan2x' }),
  })

  const addBlocksQuery = pg.helpers.insert(blocks, BLOCK_COLUMN_SET) + 'ON CONFLICT(hash) DO NOTHING RETURNING *'

  const persistedBlocks = await c.manyOrNone(addBlocksQuery)

  if (!persistedBlocks || persistedBlocks.length === 0) {
    return []
  }

  return persistedBlocks || []
}
