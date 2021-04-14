/**
 * These are helpers to stop spock during tests from the test code.
 */
export function getSpockBreakout(): boolean {
  return (global as any).SPOCK_BREAKOUT === true
}

export function setSpockBreakout(): void {
  ;(global as any).SPOCK_BREAKOUT = true
}

export function resetSpockBreakout(): void {
  ;(global as any).SPOCK_BREAKOUT = false
}
