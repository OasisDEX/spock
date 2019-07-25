import { makeNullUndefined } from '../db';
import { Connection } from './common';

export interface JobModel {
  id: number;
  name: string;
  last_block_id: number;
}

export type WritableJobModel = Omit<JobModel, 'id'>;

export async function saveJob(c: Connection, job: WritableJobModel): Promise<void> {
  const saveSQL = `
  INSERT INTO vulcan2x.job(name, last_block_id)
  VALUES('${job.name}', ${job.last_block_id})
  `;

  await c.none(saveSQL);
}

export async function getJob(c: Connection, jobName: string): Promise<JobModel | undefined> {
  const getSQL = `
      SELECT * FROM vulcan2x.job j
      WHERE j.name='${jobName}'
      `;

  return await c.oneOrNone<JobModel>(getSQL).then(makeNullUndefined);
}

export async function getAllJobs(c: Connection): Promise<JobModel[]> {
  const countJobsDoneSQL = `
  SELECT * FROM vulcan2x.job;
  `;
  const jobs = await c.many<JobModel>(countJobsDoneSQL);

  return jobs;
}
