import { getLast } from '../../../src/utils/arrays'
import { expect } from 'chai'

describe('getLast', () => {
  it('works with empty array', () => {
    const input = [] as any[]

    expect(getLast(input)).to.be.eq(undefined)
  })

  it('works with non empty array', () => {
    const input = [1, 2, 3]

    expect(getLast(input)).to.be.eq(3)
  })
})
