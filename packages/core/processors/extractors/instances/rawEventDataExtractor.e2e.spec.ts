import { servicesFixture } from '../../../../test/common';
import { getPersistedLogs } from './rawEventDataExtractor';
import { BlockModel } from '../../../db/models/Block';

describe('rawEventDataExtractor', () => {
  describe('getPersistedLogs', () => {
    it('works with empty address list', async () => {
      const services = await servicesFixture();

      const blocks: BlockModel[] = [{ id: 0, hash: '0', number: 0, timestamp: '0' }];

      await services.db.tx(async tx => {
        const localServices = { ...services, tx };

        await getPersistedLogs(localServices, [], blocks);
      });
    });
  });
});
