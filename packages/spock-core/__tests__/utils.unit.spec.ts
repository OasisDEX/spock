import { findConsecutiveSubsets } from '../utils';

describe('findConsecutiveSubsets', () => {
  it('should work', () => {
    const input = [{ id: 0 }, { id: 1 }, { id: 3 }, { id: 6 }, { id: 5 }, { id: 6 }];
    const subsets = findConsecutiveSubsets(input, 'id');

    expect(subsets).toMatchInlineSnapshot(`
Array [
  Array [
    Object {
      "id": 0,
    },
    Object {
      "id": 1,
    },
  ],
  Array [
    Object {
      "id": 3,
    },
  ],
  Array [
    Object {
      "id": 5,
    },
    Object {
      "id": 6,
    },
  ],
  Array [
    Object {
      "id": 6,
    },
  ],
]
`);
  });

  it('should work with unordered list', () => {
    const input = [{ id: 6 }, { id: 5 }, { id: 4 }, { id: 3 }, { id: 2 }, { id: 1 }];
    const subsets = findConsecutiveSubsets(input, 'id');

    expect(subsets).toMatchInlineSnapshot(`
Array [
  Array [
    Object {
      "id": 1,
    },
    Object {
      "id": 2,
    },
    Object {
      "id": 3,
    },
    Object {
      "id": 4,
    },
    Object {
      "id": 5,
    },
    Object {
      "id": 6,
    },
  ],
]
`);
  });

  it('should work with empty set', () => {
    const input: any[] = [];
    const subsets = findConsecutiveSubsets(input, 'id');

    expect(subsets).toMatchInlineSnapshot(`Array []`);
  });

  it('should work with single value', () => {
    const input = [{ id: 0 }];
    const subsets = findConsecutiveSubsets(input, 'id');

    expect(subsets).toMatchInlineSnapshot(`
Array [
  Array [
    Object {
      "id": 0,
    },
  ],
]
`);
  });
});
