import { sortBy } from 'lodash';

export function getLast<T>(array: T[]): T | undefined {
  return array[array.length - 1];
}

export function delay(time: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, time));
}

export function findConsecutiveSubsets<T>(_entities: T[], key: keyof T): T[][] {
  const entities = sortBy(_entities, key);
  const subsets: T[][] = [];
  let acc: T[] = [];

  for (const e of entities) {
    const head = getLast(acc);
    // tslint:disable-next-line
    if (!head || e[key] === (head[key] as any) + 1) {
      acc.push(e);
    } else {
      if (head) {
        subsets.push(acc);
        acc = [e];
      }
    }
  }

  if (acc.length > 0) {
    subsets.push(acc);
  }

  return subsets;
}

export function splitArrayInHalf<T>(array: T[]): [T[], T[]] {
  const halfWayThough = Math.floor(array.length / 2);

  const firstHalf = array.slice(0, halfWayThough);
  const secondHalf = array.slice(halfWayThough, array.length);

  return [firstHalf, secondHalf];
}

export function getRangeAsString<T>(array: T[], getValue: (v: T) => any): string {
  if (array.length === 0) {
    return '<...> (empty)';
  }
  const first = array[0];
  const last = getLast(array)!;

  return `<${getValue(first)}...${getValue(last)}> (${array.length})`;
}

interface Range<T> {
  first: T;
  last: T;
}

export function getRange<T, O>(array: T[], getValue: (v: T) => O): Range<O> | undefined {
  if (array.length === 0) {
    return undefined;
  }
  const first = getValue(array[0]);
  const last = getValue(getLast(array)!);

  return {
    first,
    last,
  };
}

/**
 * These are helpers to stop spock during tests from the test code.
 */
export function getSpockBreakout(): boolean {
  return (global as any).SPOCK_BREAKOUT === true;
}

export function setSpockBreakout(): void {
  (global as any).SPOCK_BREAKOUT = true;
}

export function resetSpockBreakout(): void {
  (global as any).SPOCK_BREAKOUT = false;
}

export class RetryableError extends Error {}
