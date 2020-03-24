import { StrictOmit } from 'ts-essentials';
import { TransactionalServices } from '../../types';
import { makeNullUndefined } from '../db';

export interface DoneJob {
  id: number;
  start_block_id: number;
  end_block_id: number;
  name: string;
}

export async function saveDoneJob(
  services: TransactionalServices,
  block: StrictOmit<DoneJob, 'id'>,
): Promise<void> {
  const sql = `INSERT INTO vulcan2x.done_job(start_block_id, end_block_id, name) VALUES (
    ${block.start_block_id},
    ${block.end_block_id},
    '${block.name}'
  );`;

  await services.tx.none(sql);
}

export async function selectDoneJob(
  services: TransactionalServices,
  block: Pick<DoneJob, 'end_block_id' | 'name'>,
): Promise<DoneJob | undefined> {
  const sql = `
  SELECT * FROM vulcan2x.done_job deb 
  WHERE deb.end_block_id = ${block.end_block_id} AND deb.name='${block.name}';`;

  return await services.tx.oneOrNone(sql).then(makeNullUndefined);
}

export async function updateDoneJob(
  services: TransactionalServices,
  id: number,
  block: Pick<DoneJob, 'end_block_id'>,
): Promise<void> {
  const sql = `
  UPDATE vulcan2x.done_job 
  SET end_block_id=${block.end_block_id} 
  WHERE id=${id};`;

  await services.tx.none(sql);
}
