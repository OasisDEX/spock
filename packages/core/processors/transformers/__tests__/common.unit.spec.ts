import { handleDsNoteEvents } from '../common';

const dsChiefAbi = require('./ds-chief.json');

describe('handleDsNoteEvents', () => {
  it('should work', async () => {
    const services = undefined as any;
    const logs = [
      {
        id: 2076842,
        block_id: 1775847,
        log_index: 61,
        address: '0x8e2a84d6ade1e7fffee039a35ef5f19f13057152',
        data:
          '0x00000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000024d8ccd0f30000000000000000000000000000000000000000000000000897f58f02ea24e7',
        topics:
          '{0xd8ccd0f300000000000000000000000000000000000000000000000000000000,0x0000000000000000000000000bd9f5ff1d2c35bef94d7bed48d4fdeb9c261c97,0x0000000000000000000000000000000000000000000000000897f58f02ea24e7,0x0000000000000000000000000000000000000000000000000000000000000000}',
        tx_id: 1593810,
      },
    ];
    const handlers = {
      'free(uint256)': jest.fn(),
    };

    await handleDsNoteEvents(services, dsChiefAbi, logs, handlers);

    expect(handlers['free(uint256)']).toMatchInlineSnapshot(`
[MockFunction] {
  "calls": Array [
    Array [
      undefined,
      Object {
        "log": Object {
          "address": "0x8e2a84d6ade1e7fffee039a35ef5f19f13057152",
          "block_id": 1775847,
          "data": "0x00000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000024d8ccd0f30000000000000000000000000000000000000000000000000897f58f02ea24e7",
          "id": 2076842,
          "log_index": 61,
          "topics": "{0xd8ccd0f300000000000000000000000000000000000000000000000000000000,0x0000000000000000000000000bd9f5ff1d2c35bef94d7bed48d4fdeb9c261c97,0x0000000000000000000000000000000000000000000000000897f58f02ea24e7,0x0000000000000000000000000000000000000000000000000000000000000000}",
          "tx_id": 1593810,
        },
        "note": Object {
          "caller": "0x0bd9f5ff1d2c35bef94d7bed48d4fdeb9c261c97",
          "ethValue": "64",
          "name": "free(uint256)",
          "params": Object {
            "wad": "619233468364760295",
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
});
