import { makeNullUndefined, DbConnection } from '../db';
import { Connection } from './common';
import { SQL } from 'sql-template-strings';

export interface JobModel {
  id: number;
  name: string;
  last_block_id: number;
  status: JobStatus;
  extra_info?: string;
}

export type JobStatus = 'processing' | 'stopped' | 'not-ready';

export type WritableJobModel = Omit<JobModel, 'id'>;

export async function saveJob(c: Connection, job: WritableJobModel): Promise<void> {
  const saveSQL = `
  INSERT INTO vulcan2x.job(name, last_block_id, status)
  VALUES('${job.name}', ${job.last_block_id}, '${job.status}')
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

export async function setJobStatus(
  c: Connection,
  job: JobModel,
  newStatus: JobStatus,
): Promise<void> {
  const sql = SQL`
    UPDATE vulcan2x.job 
    SET status=${newStatus}, extra_info=NULL
    WHERE name=${job.name}
  `;

  await c.none(sql);
}

export async function stopJob(c: Connection, jobName: string, extraInfo: string): Promise<void> {
  const sql = SQL`
    UPDATE vulcan2x.job 
    SET status='stopped', extra_info=${extraInfo}
    WHERE name=${jobName}
  `;

  await c.none(sql);
}

export async function excludeAllJobs(c: DbConnection): Promise<void> {
  const sql = `
    UPDATE vulcan2x.job 
    SET status='not-ready';
  `;

  await c.none(sql);
}
