import { sortBy } from 'lodash'

export function getLast<T>(array: T[]): T | undefined {
  return array[array.length - 1]
}

export function findConsecutiveSubsets<T>(_entities: T[], key: keyof T): T[][] {
  const entities = sortBy(_entities, key)
  const subsets: T[][] = []
  let acc: T[] = []

  for (const e of entities) {
    const head = getLast(acc)
    // eslint-disable-next-line
    if (!head || e[key] === (head[key] as any) + 1) {
      acc.push(e)
    } else {
      if (head) {
        subsets.push(acc)
        acc = [e]
      }
    }
  }

  if (acc.length > 0) {
    subsets.push(acc)
  }

  return subsets
}
