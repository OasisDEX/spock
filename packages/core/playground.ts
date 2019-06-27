/**
 * Easy run transformers without introducing any changes to DB. Useful for developing new transformers.
 */
import * as ethers from 'ethers';
import { getDefaultConfig } from './config';
import { createDB } from './db/db';
import { RetryProvider } from './ethereum/RetryProvider';
import { Services, TransactionalServices } from './types';

ethers.errors.setLogLevel('error');

const config = getDefaultConfig(process.env) as any;
const provider = new RetryProvider(config.chain.host, config.chain.retries);
const db = createDB(config.db);

const services: Services = {
  provider,
  ...db,
  config,
};

const transformer = null as any;

async function main(): Promise<void> {
  await db.db.tx(async tx => {
    const txServices: TransactionalServices = {
      ...services,
      tx: tx,
    };

    const data = await getExtractedData(txServices, '0x8e2a84d6ade1e7fffee039a35ef5f19f13057152');

    await transformer.transform(txServices, data);

    throw new Error('REJECT TX');
  });
}

function getExtractedData(services: TransactionalServices, address: string): Promise<any[]> {
  return (
    services.tx.manyOrNone(
      `
SELECT * FROM extracted.logs WHERE address=\${address} LIMIT 26000;
`,
      {
        address,
      },
    ) || []
  );
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
