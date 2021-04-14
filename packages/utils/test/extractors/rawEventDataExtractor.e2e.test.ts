import { getPersistedLogs } from '../../src/extractors/rawEventDataExtractor'
import { BlockModel } from '@oasisdex/spock-etl/dist/db/models/Block'

import { destroyTestServices, createTestServices } from '@oasisdex/spock-test-utils'
import { Services } from '@oasisdex/spock-etl/dist/services/types'

describe('rawEventDataExtractor', () => {
  describe('getPersistedLogs', () => {
    let services: Services

    afterEach(async () => {
      await destroyTestServices(services)
    })

    it('works with empty address list', async () => {
      services = await createTestServices()

      const blocks: BlockModel[] = [{ id: 0, hash: '0', number: 0, timestamp: '0' }]

      await services.db.tx(async (tx) => {
        const localServices = { ...services, tx }

        await getPersistedLogs(localServices, [], blocks)
      })
    })
  })
})
