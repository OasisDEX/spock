import { extname, isAbsolute, join } from 'path'

/**
 * Loads external module. Transpiles it if needed.
 */
export function loadExternalModule(_path: string): any {
  const path = normalizePath(_path)

  if (extname(path) === '.ts') {
    // if we are loading TS file transpile it on the fly
    require('ts-node').register()
  }
  // eslint-disable-next-line
  const module = require(path)

  if (!module.default) {
    throw new Error("Couldn't find default export!")
  }

  return module.default
}

export function normalizePath(rawPath: string): string {
  if (isAbsolute(rawPath)) {
    return rawPath
  }
  return join(process.cwd(), rawPath)
}
