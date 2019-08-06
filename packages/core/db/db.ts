import * as pg from 'pg-promise';
import { getLogger } from '../utils/logger';

const logger = getLogger('db');

export type DB = pg.IDatabase<{}>;
export type DbConnection = pg.IConnected<{}>;
export type DbTransactedConnection = pg.ITask<{}>;
export type ColumnSets = ReturnType<typeof getColumnSets>;

export function createDB(config: pg.TConfig): { db: DB; pg: pg.IMain; columnSets: ColumnSets } {
  const PgClient = pg({
    receive: (_data, res, e) => {
      // avoid clutter in output
      if (e.query === 'begin' || e.query === 'commit') {
        return;
      }

      logger.trace(`${e.query} (${res.duration} ms)`);
      if ((res.duration || 0) / 1000 > 5) {
        logger.warn(`SLOW QUERY DETECTED! TOOK: ${res.duration} ms`, e.query);
      }
    },
  });

  return {
    pg: PgClient,
    db: PgClient({ ...config }),
    columnSets: getColumnSets(PgClient),
  };
}

export async function withConnection<T>(
  db: DB,
  action: (connection: DbConnection) => Promise<T>,
): Promise<T> {
  let connection: DbConnection | undefined;
  try {
    connection = await db.connect();

    return await action(connection);
  } finally {
    if (connection) {
      connection.done();
    }
  }
}

export function makeNullUndefined<T>(value: T | null): T | undefined {
  if (value === null) {
    return undefined;
  }

  return value;
}

// tslint:disable-next-line
export function getColumnSets(pg: pg.IMain) {
  return {
    block: new pg.helpers.ColumnSet(['number', 'hash', 'timestamp'], {
      table: new pg.helpers.TableName('block', 'vulcan2x'),
    }),
    extracted_logs: new pg.helpers.ColumnSet(
      ['block_id', 'tx_id', 'log_index', 'address', 'data', 'topics'],
      {
        table: new pg.helpers.TableName('logs', 'extracted'),
      },
    ),
  };
}
