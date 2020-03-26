import { ethers } from 'ethers';
import { Block } from 'ethers/providers';
import { pick } from 'lodash';

import { blockGenerator } from '../src/blockGenerator';
import { dumpDB, createTestServices, destroyTestServices } from 'spock-test-utils';
import { Services } from '../src/types';
import { createProviders, getRandomProvider } from '../src/services';
import { expect } from 'chai';

describe('Block generator', () => {
  let services: Services;
  afterEach(async () => {
    destroyTestServices(services);
  });

  it('should work with reorgs', async () => {
    // @todo do not use getRandomProvider
    createProviders({
      chain: {
        host: 'http://localhost/not-existing',
        name: 'mainnet',
        retries: 0,
      },
    } as any);
    const provider = getRandomProvider();

    provider.getBlock = async (blockNumber: number): Promise<Block> => {
      const block = blocks[blockPointer++];
      if (block && block.number !== blockNumber) {
        throw new Error('Error in fixtures!');
      }
      return block as any;
    };

    services = await createTestServices({ provider });

    const blocks: Array<Partial<ethers.providers.Block>> = [
      {
        hash: '0x00',
        number: 0,
        parentHash: '0x0000',
        timestamp: 0,
      },
      {
        hash: '0x01',
        number: 1,
        parentHash: '0x00',
        timestamp: 1,
      },
      {
        hash: '0x02',
        number: 2,
        parentHash: '0x 01',
        timestamp: 2,
      },
      {
        hash: '0x03',
        number: 3,
        parentHash: '0x002',
        timestamp: 3,
      },
      {
        hash: '0x01',
        number: 1,
        parentHash: '0x00',
        timestamp: 1,
      },
      {
        hash: '0x002',
        number: 2,
        parentHash: '0x01',
        timestamp: 2,
      },
      {
        hash: '0x003',
        number: 3,
        parentHash: '0x002',
        timestamp: 3,
      },
      {
        hash: '0x004',
        number: 4,
        parentHash: '0x003',
        timestamp: 4,
      },
    ];
    let blockPointer = 0;

    await blockGenerator(services, 0, 4);

    expect(pick(await dumpDB(services.db), 'blocks')).to.be.deep.eq({
      blocks: [
        {
          hash: '0x00',
          id: 1,
          number: 0,
          timestamp: new Date('1970-01-01T00:00:00.000Z'),
        },
        {
          hash: '0x01',
          id: 3,
          number: 1,
          timestamp: new Date('1970-01-01T00:00:01.000Z'),
        },
        {
          hash: '0x002',
          id: 4,
          number: 2,
          timestamp: new Date('1970-01-01T00:00:02.000Z'),
        },
        {
          hash: '0x003',
          id: 5,
          number: 3,
          timestamp: new Date('1970-01-01T00:00:03.000Z'),
        },
        {
          hash: '0x004',
          id: 6,
          number: 4,
          timestamp: new Date('1970-01-01T00:00:04.000Z'),
        },
      ],
    });
  });
});
