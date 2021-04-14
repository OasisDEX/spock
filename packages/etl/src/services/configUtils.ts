import { mapValues, merge } from 'lodash'
import { dirname, isAbsolute, join } from 'path'
import { Dictionary } from 'ts-essentials'

import { loadExternalModule } from '../utils/modules'
import { getDefaultConfig, SpockConfig, spockConfigSchema } from './config'

export function loadConfig(externalConfigPath: string): SpockConfig {
  const externalCfg = fixConfigPaths(externalConfigPath, loadExternalModule(externalConfigPath))

  const mergedConfig = mergeConfig(externalCfg)

  return mergedConfig
}

export function mergeConfig(externalCfg: any): SpockConfig {
  const defaultCfg = getDefaultConfig(process.env)

  const finalConfig = merge({}, defaultCfg, externalCfg) as any
  return spockConfigSchema.parse(finalConfig)
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
