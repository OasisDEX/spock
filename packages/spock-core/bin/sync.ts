/**
 * Produces jobs (extracted_block, transformed block rows) for all defined extractors and transformers. It is safe to run this multiple times, in fact it's required to run this script after adding new extractor/block to process past blocks.
 */

import { createDB, withConnection, DbConnection } from '../db/db';
import { BlockExtractor } from '../extractors/extractor';
import { BlockTransformer } from '../transformers/transformers';
import { chunk } from 'lodash';
import { loadConfig } from '../utils/configUtils';

async function main(): Promise<void> {
  const config = loadConfig();
  const db = createDB(config.db);
  const { extractors, transformers } = config;

  await withConnection(db.db, async c => {
    for (const extractor of extractors) {
      let res = 0;
      do {
        res = await produceMissingExtractorJobs(c, extractor);
      } while (res !== 0);
    }

    for (const transformer of transformers) {
      let res = 0;
      do {
        res = await produceMissingTransformerJobs(c, transformer);
      } while (res !== 0);
    }
  });

  console.log('DONE!');
}

async function produceMissingExtractorJobs(
  c: DbConnection,
  extractor: BlockExtractor,
): Promise<number> {
  const missing = await c.manyOrNone(
    `
SELECT b.* 
FROM vulcan2x.block b
LEFT OUTER JOIN vulcan2x.extracted_block eb ON b.id=eb.block_id AND eb.extractor_name=\${extractor_name}
WHERE eb.id IS NULL 
ORDER BY b.number 
LIMIT 50000
`,
    { extractor_name: extractor.name },
  );

  console.log(`Missing ${extractor.name} extractors: ${missing.length}`);

  await Promise.all(
    missing.map(m => {
      const values = {
        block_id: m.id,
        extractor_name: extractor.name,
        status: 'new',
      };

      return c.none(
        `
INSERT INTO vulcan2x.extracted_block (
  block_id, extractor_name, status
) VALUES (
  \${block_id}, \${extractor_name}, \${status}
);`,
        values,
      );
    }),
  );

  return missing.length;
}

async function produceMissingTransformerJobs(
  c: DbConnection,
  transformer: BlockTransformer,
): Promise<number> {
  const missing = await c.manyOrNone(
    `
SELECT b.* 
FROM vulcan2x.block b
LEFT OUTER JOIN vulcan2x.transformed_block eb ON b.id=eb.block_id AND eb.transformer_name=\${transformer_name}
WHERE eb.id IS NULL 
ORDER BY b.number 
LIMIT 50000
`,
    { transformer_name: transformer.name },
  );

  console.log(`Missing ${transformer.name} transformer: ${missing.length}`);

  const batches = chunk(missing, 200);

  await Promise.all(
    batches.map(async batch => {
      const values = batch.map(m => ({
        block_id: m.id,
        transformer_name: transformer.name,
        status: 'new',
      }));

      await c.none(
        `
INSERT INTO vulcan2x.transformed_block (
  block_id, transformer_name, status
) VALUES ${values.map(v => `(${v.block_id}, '${v.transformer_name}', '${v.status}')`)};`,
      );
    }),
  );

  return missing.length;
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
