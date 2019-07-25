import { DbConnection, DbTransactedConnection, makeNullUndefined } from '../db';

export interface JobModel {
  id: number;
  name: string;
  last_block_id: number;
}

export type WritableJobModel = Omit<JobModel, 'id'>;

export async function saveJob(
  c: DbConnection | DbTransactedConnection,
  job: WritableJobModel,
): Promise<void> {
  const saveSQL = `
  INSERT INTO vulcan2x.job(name, last_block_id)
  VALUES('${job.name}', ${job.last_block_id})
  `;

  await c.none(saveSQL);
}

export async function getJob(
  c: DbConnection | DbTransactedConnection,
  jobName: string,
): Promise<JobModel | undefined> {
  const getSQL = `
      SELECT * FROM vulcan2x.job j
      WHERE j.name='${jobName}'
      `;

  return await c.oneOrNone<JobModel>(getSQL).then(makeNullUndefined);
}
