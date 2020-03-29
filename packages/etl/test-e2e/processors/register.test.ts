import { expect } from 'chai'
import { pick } from 'lodash'

import { dumpDB, executeSQL, createTestServices, getTestConfig, destroyTestServices } from 'spock-test-utils'

import { Services } from '../../src/types'
import { registerProcessors } from '../../src/processors/register'
import { BlockExtractor } from '../../src/processors/types'

describe('register', () => {
  let services: Services

  afterEach(async () => {
    await destroyTestServices(services)
  })

  it('should register new processors', async () => {
    const extractor1: BlockExtractor = {
      name: 'test-extractor',
      extract: async () => {},
      getData: async () => ({}),
    }
    const extractor2: BlockExtractor = {
      name: 'test-extractor-2',
      extract: async () => {},
      getData: async () => ({}),
    }
    const extractor3: BlockExtractor = {
      name: 'test-extractor-3',
      extract: async () => {},
      getData: async () => ({}),
    }
    services = await createTestServices({
      config: getTestConfig({ extractors: [extractor1, extractor2] }),
    })

    await registerProcessors(services, [extractor1, extractor2])

    expect(pick(await dumpDB(services.db), 'job')).to.be.deep.eq({
      job: [
        {
          extra_info: null,
          id: 1,
          last_block_id: 0,
          name: 'test-extractor',
          status: 'processing',
        },
        {
          extra_info: null,
          id: 2,
          last_block_id: 0,
          name: 'test-extractor-2',
          status: 'processing',
        },
      ],
    })

    await registerProcessors(services, [extractor2, extractor3])

    expect(pick(await dumpDB(services.db), 'job')).to.be.deep.eq({
      job: [
        {
          extra_info: null,
          id: 1,
          last_block_id: 0,
          name: 'test-extractor',
          status: 'not-ready',
        },
        {
          extra_info: null,
          id: 2,
          last_block_id: 0,
          name: 'test-extractor-2',
          status: 'processing',
        },
        {
          extra_info: null,
          id: 3,
          last_block_id: 0,
          name: 'test-extractor-3',
          status: 'processing',
        },
      ],
    })
  })

  it('should set startingBlockNumber when applicable', async () => {
    const extractor1: BlockExtractor = {
      name: 'test-extractor',
      startingBlock: 3,
      extract: async () => {},
      getData: async () => ({}),
    }

    services = await createTestServices({ config: getTestConfig({ extractors: [extractor1] }) })

    await executeSQL(
      services.db,
      `
      -- blocks
      INSERT INTO vulcan2x.block(number, hash, timestamp) VALUES(1, '0x01', '2019-07-02 11:18:01+00');
      INSERT INTO vulcan2x.block(number, hash, timestamp) VALUES(2, '0x02', '2019-07-02 11:18:02+00');
      INSERT INTO vulcan2x.block(number, hash, timestamp) VALUES(3, '0x03', '2019-07-02 11:18:03+00');
      -- this is done to force block numbers to be different than ids
      DELETE FROM vulcan2x.block b WHERE b.number = 3;
      INSERT INTO vulcan2x.block(number, hash, timestamp) VALUES(3, '0x03', '2019-07-02 11:18:03+00');
      INSERT INTO vulcan2x.block(number, hash, timestamp) VALUES(4, '0x04', '2019-07-02 11:18:04+00');
    `,
    )

    await registerProcessors(services, [extractor1])

    expect(pick(await dumpDB(services.db), 'job')).to.be.deep.eq({
      job: [
        {
          extra_info: null,
          id: 1,
          last_block_id: 4,
          name: 'test-extractor',
          status: 'processing',
        },
      ],
    })

    await registerProcessors(services, [extractor1])

    expect(pick(await dumpDB(services.db), 'job')).to.be.deep.eq({
      job: [
        {
          extra_info: null,
          id: 1,
          last_block_id: 4,
          name: 'test-extractor',
          status: 'processing',
        },
      ],
    })
  })
})
