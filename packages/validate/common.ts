import { BigQuery } from '@google-cloud/bigquery';
import { DbConnection } from '../core/db/db';
import { SpockConfig } from '../core/config';

export async function getLastBlockBQ(bigqueryClient: BigQuery): Promise<number> {
  const res = await bigqueryClient.query({
    query:
      'SELECT * FROM `bigquery-public-data.ethereum_blockchain.blocks` ORDER BY number DESC LIMIT 1;',
  });
  const lastBigQueryBlock = res[0][0].number;
  return lastBigQueryBlock;
}

export async function countBQ(
  bqClient: BigQuery,
  contracts: string[],
  maxBlock: number,
  minBlock?: number,
): Promise<number> {
  let res: any;
  if (minBlock === undefined) {
    res = await bqClient.query({
      query: `SELECT
      COUNT(*) as count
    FROM
    \`bigquery-public-data.ethereum_blockchain.logs\` AS logs
    WHERE (
      (
        ${contracts.map(c => `logs.address = '${c}'`).join(' OR ')}
      )
    )
    AND block_number <= ${maxBlock};`,
    });
  } else {
    res = await bqClient.query({
      query: `SELECT
      COUNT(*) as count
    FROM
    \`bigquery-public-data.ethereum_blockchain.logs\` AS logs
    WHERE (
      (
        ${contracts.map(c => `logs.address = '${c}'`).join(' OR ')}
      )
    )
    AND block_number <= ${maxBlock}
    AND block_number >= ${minBlock};`,
    });
  }

  return res[0][0].count;
}

export async function countV2(
  client: DbConnection,
  contracts: string[],
  maxBlock: number,
  minBlock?: number,
): Promise<number> {
  let res: any;

  if (minBlock === undefined) {
    res = await client.one(`
SELECT
  COUNT(*) as count
FROM
  extracted.logs AS logs
JOIN vulcan2x.block b ON b.id = logs.block_id
WHERE (
  (
    ${contracts.map(c => `logs.address = '${c}'`).join(' OR ')}
  )
)
AND b.number <= ${maxBlock};
  `);
  } else {
    res = await client.one(`
    SELECT
      COUNT(*) as count
    FROM
      extracted.logs AS logs
    JOIN vulcan2x.block b ON b.id = logs.block_id
    WHERE (
      ${contracts.map(c => `logs.address = '${c}'`).join(' OR ')}
    )
    AND b.number <= ${maxBlock}
    AND b.number >= ${minBlock};
      `);
  }

  return parseInt(res.count);
}

export function findObservedAddresses(config: SpockConfig): string[] {
  return config.extractors.map(e => (e as any).address);
}
