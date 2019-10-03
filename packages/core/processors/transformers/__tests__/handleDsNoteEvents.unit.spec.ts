import { handleDsNoteEvents } from '../common';

const dsChiefAbi = require('./abis/ds-chief.json');
const flapperAbi = require('./abis/flapper.json');

describe('handleDsNoteEvents', () => {
  // tend(uint256,uint256,uint256) event from localnode (ganache)
  it('works with ver 2 logs', async () => {
    const services = undefined as any;
    const logs = [
      {
        id: 2076842,
        block_id: 1,
        log_index: 61,
        address: '0x2bc79a37c58c67f592ac10528246deb1b577eee1',
        data:
          '0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000e04b43ed1200000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000022b1c8c1227a00000000000000000000000000001b5e7e08ca3a8f6987819baecbe2280000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000',
        topics:
          '{0x4b43ed1200000000000000000000000000000000000000000000000000000000,0x000000000000000000000000e6ac5629b9ade2132f42887fbbc3a3860afbd07b,0x0000000000000000000000000000000000000000000000000000000000000001,0x0000000000000000000000000000000000000000000000022b1c8c1227a00000}',
        tx_id: 1593810,
      },
    ];
    const handlers = {
      'tend(uint256,uint256,uint256)': jest.fn(),
    };

    await handleDsNoteEvents(services, flapperAbi, logs, handlers, 2);

    expect(handlers['tend(uint256,uint256,uint256)']).toMatchInlineSnapshot(`
[MockFunction] {
  "calls": Array [
    Array [
      undefined,
      Object {
        "log": Object {
          "address": "0x2bc79a37c58c67f592ac10528246deb1b577eee1",
          "block_id": 1,
          "data": "0x000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000e04b43ed1200000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000022b1c8c1227a00000000000000000000000000001b5e7e08ca3a8f6987819baecbe2280000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000",
          "id": 2076842,
          "log_index": 61,
          "topics": "{0x4b43ed1200000000000000000000000000000000000000000000000000000000,0x000000000000000000000000e6ac5629b9ade2132f42887fbbc3a3860afbd07b,0x0000000000000000000000000000000000000000000000000000000000000001,0x0000000000000000000000000000000000000000000000022b1c8c1227a00000}",
          "tx_id": 1593810,
        },
        "note": Object {
          "args": Array [
            BigNumber {
              "_hex": "0x01",
            },
            BigNumber {
              "_hex": "0x022b1c8c1227a00000",
            },
            BigNumber {
              "_hex": "0x01b5e7e08ca3a8f6987819baecbe22800000000000",
            },
          ],
          "caller": "0xe6ac5629b9ade2132f42887fbbc3a3860afbd07b",
          "ethValue": undefined,
          "name": "tend(uint256,uint256,uint256)",
          "params": Object {
            "bid": BigNumber {
              "_hex": "0x01b5e7e08ca3a8f6987819baecbe22800000000000",
            },
            "id": BigNumber {
              "_hex": "0x01",
            },
            "lot": BigNumber {
              "_hex": "0x022b1c8c1227a00000",
            },
          },
        },
      },
    ],
  ],
  "results": Array [
    Object {
      "type": "return",
      "value": undefined,
    },
  ],
}
`);
  });

  //based on https://kovan.etherscan.io/tx/0x785136de8358f8c2a6ec8209633511447703c567a757bf3e857f7d2fd7b068ec#eventlog
  it('should work with ver 1 logs', async () => {
    const services = undefined as any;
    const logs = [
      {
        id: 2076842,
        block_id: 1,
        log_index: 0,
        address: '0xbbffc76e94b34f72d96d054b31f6424249c1337d',
        data:
          '0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000024dd4670640000000000000000000000000000000000000000000000000de0b6b3a7640000',
        topics:
          '{0xdd46706400000000000000000000000000000000000000000000000000000000,0x0000000000000000000000007af825793449f92a96fa4223e7e6486e3a5da31d,0x0000000000000000000000000000000000000000000000000de0b6b3a7640000,0x0000000000000000000000000000000000000000000000000000000000000000}',
        tx_id: 1593810,
      },
    ];
    const handlers = {
      'lock(uint256)': jest.fn(),
    };

    await handleDsNoteEvents(services, dsChiefAbi, logs, handlers);

    expect(handlers['lock(uint256)']).toMatchInlineSnapshot(`
[MockFunction] {
  "calls": Array [
    Array [
      undefined,
      Object {
        "log": Object {
          "address": "0xbbffc76e94b34f72d96d054b31f6424249c1337d",
          "block_id": 1,
          "data": "0x000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000024dd4670640000000000000000000000000000000000000000000000000de0b6b3a7640000",
          "id": 2076842,
          "log_index": 0,
          "topics": "{0xdd46706400000000000000000000000000000000000000000000000000000000,0x0000000000000000000000007af825793449f92a96fa4223e7e6486e3a5da31d,0x0000000000000000000000000000000000000000000000000de0b6b3a7640000,0x0000000000000000000000000000000000000000000000000000000000000000}",
          "tx_id": 1593810,
        },
        "note": Object {
          "args": Array [
            BigNumber {
              "_hex": "0x0de0b6b3a7640000",
            },
          ],
          "caller": "0x7af825793449f92a96fa4223e7e6486e3a5da31d",
          "ethValue": "0",
          "name": "lock(uint256)",
          "params": Object {
            "wad": BigNumber {
              "_hex": "0x0de0b6b3a7640000",
            },
          },
        },
      },
    ],
  ],
  "results": Array [
    Object {
      "type": "return",
      "value": undefined,
    },
  ],
}
`);
  });

  it('wont crash with non DSNote events', async () => {
    // based on Transfer on DAI
    // https://etherscan.io/tx/0xa6e61000fb6d76771c5312d482bc54b6cd2ef894c459ba7bb2e67d08029fa7d9#eventlog
    const services = undefined as any;
    const logs = [
      {
        id: 2076842,
        block_id: 1,
        log_index: 0,
        address: '0x89d24A6b4CcB1B6fAA2625fE562bDD9a23260359',
        data: '00000000000000000000000000000000000000000000002b6dc429fe060b7800',
        topics:
          '{0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef,0x0000000000000000000000003a32292c53bf42b6317334392bf0272da2983252,0x000000000000000000000000a57bd00134b2850b2a1c55860c9e9ea100fdd6cf}',
        tx_id: 1,
      },
    ];
    const handlers = {
      'lock(uint256)': jest.fn(),
    };

    await handleDsNoteEvents(services, dsChiefAbi, logs, handlers);

    expect(handlers['lock(uint256)']).toMatchInlineSnapshot(`[MockFunction]`);
  });
});
