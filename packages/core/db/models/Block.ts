import { LocalServices } from '../../types';
import { makeNullUndefined } from '../db';

export interface PersistedBlock {
  id: number;
  number: number;
  hash: string;
  timestamp: string;
}

export async function getBlock(
  { tx }: LocalServices,
  blockHash: string,
): Promise<PersistedBlock | undefined> {
  return tx
    .oneOrNone<PersistedBlock>('SELECT * FROM vulcan2x.block WHERE hash=$1;', blockHash)
    .then(makeNullUndefined);
}

export async function getBlockById(
  { tx }: LocalServices,
  id: number,
): Promise<PersistedBlock | undefined> {
  return tx
    .oneOrNone<PersistedBlock>('SELECT * FROM vulcan2x.block WHERE id=$1;', id)
    .then(makeNullUndefined);
}

export async function getBlockByIdOrDie(
  { tx }: LocalServices,
  id: number,
): Promise<PersistedBlock> {
  return tx
    .oneOrNone<PersistedBlock>('SELECT * FROM vulcan2x.block WHERE id=$1;', id)
    .then(makeNullUndefined)
    .then(r => {
      if (!r) {
        throw new Error(`Block(id=${id}) is missing`);
      }
      return r;
    });
}
