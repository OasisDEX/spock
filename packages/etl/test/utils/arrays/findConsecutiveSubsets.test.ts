import { expect } from 'chai'

import { findConsecutiveSubsets } from '../../../src/utils/arrays'

describe('findConsecutiveSubsets', () => {
  it('should work', () => {
    const input = [{ id: 0 }, { id: 1 }, { id: 3 }, { id: 6 }, { id: 5 }, { id: 6 }]
    const subsets = findConsecutiveSubsets(input, 'id')

    expect(subsets).to.be.deep.eq([[{ id: 0 }, { id: 1 }], [{ id: 3 }], [{ id: 5 }, { id: 6 }], [{ id: 6 }]])
  })

  it('should work with unordered list', () => {
    const input = [{ id: 6 }, { id: 5 }, { id: 4 }, { id: 3 }, { id: 2 }, { id: 1 }]
    const subsets = findConsecutiveSubsets(input, 'id')

    expect(subsets).to.be.deep.eq([[{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }, { id: 6 }]])
  })

  it('should work with empty set', () => {
    const input: any[] = []
    const subsets = findConsecutiveSubsets(input, 'id')

    expect(subsets).to.be.deep.eq([])
  })

  it('should work with single value', () => {
    const input = [{ id: 0 }]
    const subsets = findConsecutiveSubsets(input, 'id')

    expect(subsets).to.be.deep.eq([[{ id: 0 }]])
  })
})
