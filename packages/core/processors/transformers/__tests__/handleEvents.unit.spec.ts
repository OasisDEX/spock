import { handleEvents } from '../common';
import { PersistedLog } from '../../extractors/instances/rawEventDataExtractor';
const abi = require('./abis/polling-emitter.json');

describe('handleEvents', () => {
  it('decodes events', async () => {
    const services = undefined as any;

    const logToDecode: PersistedLog = {
      block_id: 4015004,
      log_index: 105,
      address: '0xf9be8f0945acddeedaa64dfca5fe9629d0cf8e5d',
      data: '0x',
      topics:
        '{0xea66f58e474bc09f580000e81f31b334d171db387d0c6098ba47bd897741679b,0x00000000000000000000000014341f81df14ca86e1420ec9e6abd343fb1c5bfc,0x0000000000000000000000000000000000000000000000000000000000000022,0x0000000000000000000000000000000000000000000000000000000000000001}',
      tx_id: 456385,
    };

    let _info: any;
    await handleEvents(services, abi, [logToDecode], {
      async Voted(_: any, info: any): Promise<void> {
        _info = info;
      },
    });

    expect(_info.event).toMatchInlineSnapshot(`
Object {
  "address": "0xf9be8f0945acddeedaa64dfca5fe9629d0cf8e5d",
  "args": Array [
    "0x14341f81dF14cA86E1420eC9e6Abd343Fb1c5bfC",
    BigNumber {
      "_hex": "0x22",
    },
    BigNumber {
      "_hex": "0x01",
    },
  ],
  "name": "Voted",
  "params": Object {
    "optionId": BigNumber {
      "_hex": "0x01",
    },
    "pollId": BigNumber {
      "_hex": "0x22",
    },
    "voter": "0x14341f81dF14cA86E1420eC9e6Abd343Fb1c5bfC",
  },
}
`);
  });
});
