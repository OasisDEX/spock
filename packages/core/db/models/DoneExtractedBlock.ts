import { Omit } from 'ts-essentials';
import { TransactionalServices } from '../../types';
import { makeNullUndefined } from '../db';

export interface DoneExtractedBlock {
  id: number;
  start_block_id: number;
  end_block_id: number;
  extractor_name: string;
}

export async function saveDoneExtractedBlock(
  services: TransactionalServices,
  block: Omit<DoneExtractedBlock, 'id'>,
): Promise<void> {
  const sql = `INSERT INTO vulcan2x.done_extracted_block(start_block_id, end_block_id, extractor_name) VALUES (
    ${block.start_block_id},
    ${block.end_block_id},
    '${block.extractor_name}'
  );`;

  await services.tx.none(sql);
}

export async function selectDoneExtractedBlock(
  services: TransactionalServices,
  block: Pick<DoneExtractedBlock, 'end_block_id' | 'extractor_name'>,
): Promise<DoneExtractedBlock | undefined> {
  const sql = `
  SELECT * FROM vulcan2x.done_extracted_block deb 
  WHERE deb.end_block_id = ${block.end_block_id} AND deb.extractor_name='${block.extractor_name}';`;

  return await services.tx.oneOrNone(sql).then(makeNullUndefined);
}

export async function updateDoneExtractedBlock(
  services: TransactionalServices,
  id: number,
  block: Pick<DoneExtractedBlock, 'end_block_id'>,
): Promise<void> {
  const sql = `
  UPDATE vulcan2x.done_extracted_block 
  SET end_block_id=${block.end_block_id} 
  WHERE id=${id};`;

  await services.tx.none(sql);
}
