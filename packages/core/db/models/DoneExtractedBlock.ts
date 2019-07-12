import { Omit } from 'ts-essentials';
import { TransactionalServices } from '../../types';

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
