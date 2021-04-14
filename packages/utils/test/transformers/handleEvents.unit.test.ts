import { handleEvents } from '../../src/transformers/common'
import { PersistedLog } from '../../src/extractors/rawEventDataExtractor'
import { expect } from 'chai'
const abi = require('./abis/polling-emitter.json')

describe('handleEvents', () => {
  it('decodes events', async () => {
    const services = undefined as any

    const logToDecode: PersistedLog = {
      block_id: 4015004,
      log_index: 105,
      address: '0xf9be8f0945acddeedaa64dfca5fe9629d0cf8e5d',
      data: '0x',
      topics:
        '{0xea66f58e474bc09f580000e81f31b334d171db387d0c6098ba47bd897741679b,0x00000000000000000000000014341f81df14ca86e1420ec9e6abd343fb1c5bfc,0x0000000000000000000000000000000000000000000000000000000000000022,0x0000000000000000000000000000000000000000000000000000000000000001}',
      tx_id: 456385,
    }

    let _info: any
    await handleEvents(services, abi, [logToDecode], {
      async Voted(_: any, info: any): Promise<void> {
        _info = info
      },
    })

    expect(_info.event.address).to.be.eq('0xf9be8f0945acddeedaa64dfca5fe9629d0cf8e5d')
  })
})
