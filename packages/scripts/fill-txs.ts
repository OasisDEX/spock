/**
 * Script used for filling out missing data in tx when migrating DB schema.
 */
import { getConfig } from '../../instances/oasis/config';
import { createDB, withConnection, DbConnection } from '../spock-core/db/db';
import { RetryProvider } from '../spock-core/ethereum/RetryProvider';

const config = getConfig(process.env);
const db = createDB(config.db);
const provider = new RetryProvider(config.chain.host, config.chain.retries);

async function main(): Promise<void> {
  await withConnection(db.db, async c => {
    let res = 0;
    do {
      res = await fixTxs(c);
    } while (res !== 0);
  });

  console.log('DONE!');
}

async function fixTxs(c: DbConnection): Promise<number> {
  // we identify not completed tx based on value
  const notCompleted = await c.manyOrNone(
    `SELECT hash from vulcan2x.transaction tx WHERE tx.value IS NULL LIMIT 1000;`,
  );

  console.log(`Not completed txs ${notCompleted.length}`);

  await Promise.all(
    notCompleted.map(async ({ hash }) => {
      const transaction = await provider.getTransaction(hash);
      return c.none(
        'UPDATE vulcan2x.transaction SET nonce = ${nonce}, value = ${value}, gas_limit = ${gas_limit}, gas_price = ${gas_price}, data = ${data} WHERE hash=${hash};',
        {
          hash,
          nonce: transaction.nonce,
          value: transaction.value.toString(),
          gas_limit: transaction.gasLimit.toString(),
          gas_price: transaction.gasPrice.toString(),
          data: transaction.data,
        },
      );
    }),
  );

  return notCompleted.length;
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
