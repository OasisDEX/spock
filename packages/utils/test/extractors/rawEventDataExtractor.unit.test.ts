import { makeRawLogExtractors } from '../../src/extractors/rawEventDataExtractor'
import { expect } from 'chai'

describe('makeRawLogExtractors', () => {
  it('works with mixed address list with starting block', () => {
    const def = [
      '0x4a6bc4e803c62081ffebcc8d227b5a87a58f1f8f',
      { address: '0x0511674a67192fe51e86fe55ed660eb4f995bdd6', startingBlock: 10 },
    ]
    const extractors = makeRawLogExtractors(def)

    expect(extractors.length).to.be.deep.eq(2)
    expect(extractors[0].name).to.be.deep.eq('raw_log_0x4a6bc4e803c62081ffebcc8d227b5a87a58f1f8f_extractor')
    expect(extractors[0].startingBlock).to.be.deep.eq(undefined)
    expect(extractors[1].name).to.be.deep.eq('raw_log_0x0511674a67192fe51e86fe55ed660eb4f995bdd6_extractor')
    expect(extractors[1].startingBlock).to.be.deep.eq(10)
  })
})
