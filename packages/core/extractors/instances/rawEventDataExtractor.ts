import { TransactionalServices, PersistedBlock } from '../../generator';
import { getLast, splitArrayInHalf } from '../../utils';
import { getOrCreateTx, getBlock } from '../common';
import { BlockExtractor } from '../extractor';
import { min, max } from 'lodash';
import { Log } from 'ethers/providers';
import { BlockRangeTooWideInfuraError } from '../../ethereum/RetryProvider';
import { getLogger } from '../../utils/logger';

const logger = getLogger('extractors/instances/rawEventDataExtractor');

export function makeRawLogExtractors(addresses: string[]): BlockExtractor[] {
  return addresses.map(address => ({
    name: `raw_log_${address}_extractor`,
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

        try {
          logs = await services.provider.getLogs({
            address,
            fromBlock,
            toBlock,
          });
        } catch (e) {
          if (e instanceof BlockRangeTooWideInfuraError) {
            logger.warn(
              'Detected call that queried too many blocks at one time. Retrying with smaller set.',
            );
            const [firstHalf, secondHalf] = splitArrayInHalf(blocks);

            // tslint:disable-next-line
            await this.extract(services, firstHalf);
            // tslint:disable-next-line
            await this.extract(services, secondHalf);
            return;
          } else {
            throw e;
          }
        }
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

    async getData(services: TransactionalServices, blocks: PersistedBlock[]): Promise<any> {
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

export interface PersistedLog {
  block_id: number;
  tx_id: number;
  log_index: number;
  address: string;
  data: string;
  topics: string;
}
