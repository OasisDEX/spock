import { ethers } from '../spock-core/node_modules/ethers';
import { getDefaultConfig } from '../spock-core/config';
import { createDB, withConnection, DbConnection } from '../spock-core/db/db';
import { RetryProvider } from '../spock-core/ethereum/RetryProvider';

const config = getDefaultConfig(process.env) as any;
const db = createDB(config.db);
const provider = new RetryProvider(config.chain.host, config.chain.retries);

async function main(): Promise<void> {
  await withConnection(db.db, async c => {
    let res = 0;
    do {
      res = await extractAddresses(c);
    } while (res !== 0);
  });

  console.log('DONE!');
}

async function extractAddresses(c: DbConnection): Promise<number> {
  const notCompleted = await c.manyOrNone(
    `SELECT DISTINCT et.arg0 as address 
    FROM vulcan2x.enhanced_transaction et
    LEFT OUTER JOIN vulcan2x.address a 
    ON et.arg0 = a.address 
    WHERE LENGTH(arg0) = 42 and a.address IS NULL 
    LIMIT 5000`,
  );

  console.log(`Not completed txs ${notCompleted.length}`);

  await Promise.all(
    notCompleted.map(async ({ address }) => {
      const bytecode = await provider.getCode(address);
      const is_contract = bytecode !== '0x';
      const bytecode_hash = is_contract ? ethers.utils.sha256(bytecode) : undefined;

      return c.none(
        `INSERT INTO vulcan2x.address (address, bytecode_hash, is_contract) 
        VALUES (\${address}, \${bytecode_hash}, \${is_contract}) 
        ON CONFLICT (address) DO NOTHING`,
        {
          is_contract,
          bytecode_hash,
          address: address.toLowerCase(),
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
