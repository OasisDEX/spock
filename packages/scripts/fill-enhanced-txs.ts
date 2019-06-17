/**
 * Script used for filling out missing enhanced tx data (like parsed TXs data by ABIs).
 */
import { getConfig } from '../../instances/oasis/config';
import { createDB, withConnection, DbConnection } from '../spock-core/db/db';
import { readdirSync } from 'fs';
import { join } from '../spock-core/utils/node_modules/path';
import BigNumber from '../spock-core/transformers/node_modules/bignumber.js.js';

const config = getConfig(process.env);
const db = createDB(config.db);

const abiDecoder = require('abi-decoder');
loadAbis(join(__dirname, '../blockchain-etl/transformers/abis'));

async function main(): Promise<void> {
  await withConnection(db.db, async c => {
    let res = 0;
    do {
      res = await fixEnhancedTxs(c);
    } while (res !== 0);
  });

  console.log('DONE!');
}

async function fixEnhancedTxs(c: DbConnection): Promise<number> {
  const missing = await c.manyOrNone<{ data: string; hash: string }>(
    `
    SELECT tx.* 
    FROM vulcan2x.transaction tx
    LEFT OUTER JOIN vulcan2x.enhanced_transaction et ON tx.hash=et.hash
    WHERE et.hash IS NULL  
    LIMIT 50000    
`,
  );

  console.log(`Missing txs: ${missing.length}`);

  await Promise.all(
    missing.map(async tx => {
      const { data } = tx;
      const res: ParsedCall | undefined = abiDecoder.decodeMethod(data);

      let values: any = {
        hash: tx.hash,
        method_name: undefined,
        arg0: undefined,
        arg1: undefined,
        arg2: undefined,
        args: undefined,
      };
      if (res) {
        values = {
          ...values,
          method_name: res.name,
          arg0: formatArg(res.params[0] && res.params[0].value),
          arg1: formatArg(res.params[1] && res.params[1].value),
          arg2: formatArg(res.params[2] && res.params[2].value),
          args: res,
        };
      }

      return c.none(
        'INSERT INTO vulcan2x.enhanced_transaction (hash, method_name, arg0, arg1, arg2, args) VALUES (${hash}, ${method_name}, ${arg0}, ${arg1}, ${arg2}, ${args});',
        values,
      );
    }),
  );

  return missing.length;
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});

function loadAbis(path: string): void {
  const files = readdirSync(path);
  for (const file of files) {
    console.log(`Loading abi at ${file}`);
    const abi = require(join(path, file));
    abiDecoder.addABI(abi);
  }
}

interface ParsedCall {
  name: string;
  params: {
    name: string;
    type: string;
    value: any;
  }[];
}

function formatArg(arg: string): any {
  if (!arg) {
    return;
  }

  if (arg.indexOf('e+') !== -1) {
    return new BigNumber(arg).toString(10);
  }

  return arg;
}
