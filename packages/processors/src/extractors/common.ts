export const DEFAULT_ADDRESS = '0x0000000000000000000000000000000000000000';

import { Transaction } from 'ethers/utils';
import { TransactionalServices, LocalServices } from 'spock-etl/dist/esm/types';
import { assert } from 'ts-essentials';

import { BlockModel } from '../../../etl/src/db/models/Block';
import { makeNullUndefined } from '../../../etl/src/db/db';

export async function getOrCreateTx(
  services: TransactionalServices,
  transactionHash: string,
  block: BlockModel,
): Promise<PersistedTransaction> {
  const transaction = await services.provider.getTransaction(transactionHash);

  assert(transaction, `Tx (${transactionHash}) couldn't be found - probably reorg is in progress`);

  const storedTx = await addTx(services, transaction, block);

  return storedTx;
}

export async function getTx(
  { tx }: LocalServices,
  txHash: string,
): Promise<PersistedTransaction | undefined> {
  return tx
    .oneOrNone(
      `
  SELECT * FROM vulcan2x.transaction
  WHERE hash=\${txHash}
  `,
      { txHash },
    )
    .then(makeNullUndefined);
}

export async function getTxByIdOrDie(
  { tx }: LocalServices,
  txId: number,
): Promise<PersistedTransaction> {
  return tx
    .oneOrNone(
      `
  SELECT * FROM vulcan2x.transaction
  WHERE id=\${txId}
  `,
      { txId },
    )
    .then(makeNullUndefined)
    .then(r => {
      if (!r) {
        throw new Error(`Tx(id=${txId}) is missing`);
      }
      return r;
    });
}

export async function addTx(
  services: LocalServices,
  transaction: Transaction,
  block: BlockModel,
): Promise<PersistedTransaction> {
  const { tx } = services;

  await tx
    .none(
      `
    INSERT INTO vulcan2x.transaction (hash, to_address, from_address, block_id, nonce, value, gas_limit, gas_price, data) VALUES(\${hash}, \${to}, \${from}, \${block_id}, \${nonce}, \${value}, \${gas_limit}, \${gas_price}, \${data})
    ON CONFLICT DO NOTHING
  `,
      {
        hash: transaction.hash,
        to: (transaction.to || DEFAULT_ADDRESS).toLowerCase(), // this can happen when tx was contract creation
        from: transaction.from && transaction.from.toLowerCase(),
        block_id: block.id,
        nonce: transaction.nonce,
        value: transaction.value.toString(),
        gas_limit: transaction.gasLimit.toString(),
        gas_price: transaction.gasPrice.toString(),
        data: transaction.data,
      },
    )
    .catch(silenceError(matchUniqueKeyError));

  const storedTx = await getTx(services, transaction.hash!);
  assert(storedTx, 'storedTx MUST be defined');

  return storedTx;
}

interface PersistedTransaction {
  id: number;
  hash: string;
  nonce: number;
  from_address: string;
  to_address: string;
  value: string;
  gas_limit: string;
  gas_price: string;
  data: string;
  block_id: number;
}

export function matchMissingForeignKeyError(e: any): boolean {
  return e.code === '23503';
}

export function matchUniqueKeyError(e: any): boolean {
  return e.code === '23505';
}

export function matchDeadlockDetectedError(e: any): boolean {
  return e.code === '40P01';
}

export const silenceError = (...matchers: Array<(e: any) => boolean>) => (e: any) => {
  const matched = matchers.filter(m => m(e)).length > 0;

  if (!matched) {
    throw e;
  }
};
