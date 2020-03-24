export interface ExtractedBlock {
  id: number;
  block_id: number;
  extractor_name: string;
  status: string;
}

export type TaskType = 'extract' | 'transform';

export function getNameFieldForTask(task: TaskType): string {
  if (task === 'extract') {
    return 'extractor_name';
  } else {
    return 'transformer_name';
  }
}
