import { isAbsolute, join, dirname } from 'path'
import { Dictionary } from 'ts-essentials'

import { SpockConfig, getDefaultConfig } from './config'
import { mapValues, merge } from 'lodash'
import { loadExternalModule } from '../utils/modules'

export function loadConfig(externalConfigPath: string): SpockConfig {
  const externalCfg = fixConfigPaths(externalConfigPath, loadExternalModule(externalConfigPath))

  const defaultCfg = getDefaultConfig(process.env)

  return merge({}, defaultCfg, externalCfg) as any
}

/**
 * Turn any relative paths in the config to absolute ones
 */
function fixConfigPaths(configPath: string, config: any): any {
  const newMigrations = mapValues(config.migrations, (path) => {
    if (isAbsolute(path)) {
      return path
    } else {
      return join(dirname(configPath), path)
    }
  })

  config.migrations = newMigrations

  return config
}

export function getRequiredString(env: Env, name: string): string {
  const value = env[name]
  if (value === undefined) {
    throw new Error(`Required env var ${name} missing`)
  }

  return value
}

export function getRequiredNumber(env: Env, name: string): number {
  const string = getRequiredString(env, name)
  const number = parseInt(string)
  if (isNaN(number)) {
    throw new Error(`Couldn't parse ${name} as number`)
  }

  return number
}

export type Env = Dictionary<string | undefined>
