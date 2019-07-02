import { getLast } from '../../utils';
import { getOrCreateTx, getBlock } from '../common';
import { BlockExtractor } from '../extractor';
import { min, max } from 'lodash';
import { Log } from 'ethers/providers';
import { TransactionalServices, PersistedBlock, LocalServices } from '../../types';

export function makeRawLogExtractors(_addresses: string[]): BlockExtractor[] {
  const addresses = _addresses.map(a => a.toLowerCase());

  return addresses.map(address => ({
    name: getExtractorName(address),
    address,
    async extract(services: TransactionalServices, blocks: PersistedBlock[]): Promise<void> {
      let logs: Log[];
      if (blocks.length === 0) {
        return;
      } else if (blocks.length === 1) {
        logs = await services.provider.getLogs({
          address,
          blockHash: blocks[0].hash,
        });
      } else {
        const fromBlock = blocks[0].number;
        const toBlock = getLast(blocks)!.number;

        logs = await services.provider.getLogs({
          address,
          fromBlock,
          toBlock,
        });
      }

      const logsToInsert = (await Promise.all(
        logs.map(async log => {
          const transaction = await services.provider.getTransaction(log.transactionHash!);
          const block = await getBlock(services, log.blockHash!);
          if (!block) {
            return;
          }
          const storedTx = await getOrCreateTx(services, transaction, block);

          return {
            ...log,
            address: log.address.toLowerCase(), // always use lower case
            log_index: log.logIndex,
            block_id: block.id,
            tx_id: storedTx.id,
          };
        }),
      )).filter(log => !!log);
      if (logsToInsert.length === 0) {
        return;
      }

      const query = services.pg.helpers.insert(logsToInsert, services.columnSets['extracted_logs']);
      await services.tx.none(query);
    },

    async getData(services: LocalServices, blocks: PersistedBlock[]): Promise<any> {
      const blocksIds = blocks.map(b => b.id);
      const minId = min(blocksIds);
      const maxId = max(blocksIds);

      return (
        services.tx.manyOrNone(
          `
SELECT * FROM extracted.logs 
WHERE logs.block_id >= \${id_min} AND logs.block_id <= \${id_max} AND address=\${address};
  `,
          {
            address,
            id_min: minId,
            id_max: maxId,
          },
        ) || []
      );
    },
  }));
}

export function getExtractorName(address: string) {
  return `raw_log_${address.toLowerCase()}_extractor`;
}

export interface PersistedLog {
  block_id: number;
  tx_id: number;
  log_index: number;
  address: string;
  data: string;
  topics: string;
}
