export interface ExtractedBlock {
  id: number;
  block_id: number;
  extractor_name: string;
  status: string;
}

export type TaskType = 'extract' | 'transform';

export function getTableNameForTask(task: TaskType): string {
  if (task === 'extract') {
    return 'vulcan2x.extracted_block';
  } else {
    return 'vulcan2x.transformed_block';
  }
}

export function getNameFieldForTask(task: TaskType): string {
  if (task === 'extract') {
    return 'extractor_name';
  } else {
    return 'transformer_name';
  }
}
