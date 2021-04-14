import { expect } from 'chai'
import { addTx, matchMissingForeignKeyError, matchUniqueKeyError } from '../../src/extractors/common'
import { createDB, withConnection } from '@oasisdex/spock-etl/dist/db/db'
import { ethers } from 'ethers'
import { TransactionalServices } from '@oasisdex/spock-etl/dist/services/types'
import { BlockModel } from '@oasisdex/spock-etl/dist/db/models/Block'

import { prepareDB, getTestConfig, networkState } from '@oasisdex/spock-test-utils'

const testConfig = getTestConfig()

describe('extractors/common matchMissingForeignKeyError', () => {
  it('should work', async () => {
    const transaction: Partial<ethers.utils.Transaction> = {
      hash: 'hash',
      to: 'to',
      from: 'from',
      data: '0x',
      value: 1 as any,
      gasLimit: 1 as any,
      gasPrice: 1 as any,
    }
    const block: Partial<BlockModel> = {
      id: 1,
    }

    const dbCtx = createDB(testConfig.db)
    await prepareDB(dbCtx.db, testConfig)

    await dbCtx.db.tx(async (tx) => {
      const services: TransactionalServices = {
        tx,
        columnSets: undefined as any,
        pg: dbCtx.pg,
        config: testConfig,
        provider: undefined as any,
        networkState,
        processorsState: {},
      }

      try {
        await addTx(services, transaction as any, block as any)
      } catch (e) {
        expect(matchMissingForeignKeyError(e)).to.be.true
      }
    })
  })
})

describe('extractors/common matchUniqueKeyError', () => {
  it('should work', async () => {
    const dbCtx = createDB(testConfig.db)
    await prepareDB(dbCtx.db, testConfig)

    await withConnection(dbCtx.db, async (c) => {
      try {
        await c.none(`INSERT INTO vulcan2x.block(number, hash, timestamp) VALUES(1, 'abc', now())`)
        await c.none(`INSERT INTO vulcan2x.block(number, hash, timestamp) VALUES(2, 'abc', now())`)

        // previous line should throw
        expect(true).to.be.false
      } catch (e) {
        expect(matchUniqueKeyError(e)).to.be.true
      }
    })
  })
})
