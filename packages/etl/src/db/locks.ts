import { DB, DbConnection } from './db';
import { getLogger } from '../utils/logger';
import { delay } from '../utils';
import cleanupOnExit from 'node-cleanup';

const logger = getLogger('db/utils');

export async function withLock(db: DB, id: number, fn: () => Promise<any>): Promise<void> {
  const connection = await acquire(db, id);

  cleanupOnExit(() => {
    return release(connection, id) as any;
  });

  try {
    await fn();
  } finally {
    await release(connection, id);

    cleanupOnExit.uninstall();
  }
}

async function acquire(db: DB, id: number): Promise<DbConnection> {
  logger.info(`Trying to acquire lock: ${id}`);
  const connection = await db.connect();

  let isAcquired = false;
  while (!isAcquired) {
    const result: { pg_try_advisory_lock: boolean } = await connection.one(
      'SELECT pg_try_advisory_lock(${id});',
      {
        id,
      },
    );
    isAcquired = result.pg_try_advisory_lock;

    if (!isAcquired) {
      logger.info('Retrying...');
      await delay(500);
    }
  }

  logger.info(`Acquired lock: ${id}`);

  return connection;
}

async function release(connection: DbConnection, id: number): Promise<void> {
  logger.info(`Releasing lock: ${id}`);
  await connection.one('SELECT pg_advisory_unlock(${id});', { id: id });
  logger.info(`Released lock: ${id}`);
}
