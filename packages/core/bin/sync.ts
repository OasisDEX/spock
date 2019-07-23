/**
 * Produces jobs (extracted_block, transformed block rows) for all defined extractors and transformers. It is safe to run this multiple times, in fact it's required to run this script after adding new extractor/block to process past blocks.
 */

import { withConnection, DbConnection } from '../db/db';
import { BlockExtractor } from '../extractors/extractor';
import { BlockTransformer } from '../transformers/transformers';
import { chunk } from 'lodash';
import { loadConfig } from '../utils/configUtils';
import { withLock } from '../db/locks';
import { archiveOnce } from '../archiver/archiver';
import { createServices } from '../services';
import { Services } from '../types';
import { DoneJob } from '../db/models/DoneJob';

async function main(): Promise<void> {
  const config = loadConfig();
  const services = await createServices(config);
  const { extractors, transformers } = config;

  await withConnection(services.db, async c => {
    await withLock(services.db, config.processDbLock, async () => {
      await archiveOnce(services);

      for (const extractor of extractors) {
        let res = 0;
        do {
          res = await produceMissingExtractorJobs(services, extractor);
        } while (res !== 0);
      }

      for (const transformer of transformers) {
        let res = 0;
        do {
          res = await produceMissingTransformerJobs(c, transformer);
        } while (res !== 0);
      }
    });
  });

  console.log('DONE!');
  process.exit(0);
}

async function getAllDoneJobs(
  services: Services,
  extractorName: string,
): Promise<DoneJob[]> {
  const sql = `SELECT * FROM vulcan2x.done_job dj 
  WHERE dj.name='${extractorName}';`;

  return await withConnection(services.db, async c => {
    return c.manyOrNone<DoneJob>(sql);
  });
}

async function produceMissingExtractorJobs(
  services: Services,
  extractor: BlockExtractor,
): Promise<number> {
  const extractedRanges = await getAllDoneJobs(services, extractor.name);

  return await withConnection(services.db, async c => {
    const missing = await c.manyOrNone(
      `
  SELECT b.* 
  FROM (
    SELECT * FROM vulcan2x.block b
    ${
      extractedRanges.length > 0
        ? `WHERE ${extractedRanges
            .map(er => `(b.id < ${er.start_block_id} OR b.id > ${er.end_block_id})`)
            .join(' AND ')}`
        : ''
    }
  ) b
  LEFT OUTER JOIN vulcan2x.extracted_block eb ON b.id=eb.block_id AND eb.extractor_name=\${extractor_name}
  WHERE eb.id IS NULL 
  ORDER BY b.number 
  LIMIT 50000
  `,
      { extractor_name: extractor.name },
    );

    console.log(`Missing ${extractor.name} extractors: ${missing.length}`);

    const jobs = chunk(missing, 1000).map(missingChunk => {
      return c.none(
        `
INSERT INTO vulcan2x.extracted_block (block_id, extractor_name, status) 
VALUES ${missingChunk.map(m => `(${m.id}, '${extractor.name}', 'new')`).join(',')};`,
      );
    });

    await Promise.all(jobs);

    return missing.length;
  });
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
