import { isAbsolute, join, extname } from 'path';
import { Dictionary } from 'ts-essentials';

import { SpockConfig, getDefaultConfig } from '../config';

export function loadConfig(): SpockConfig {
  const rawPath = process.argv[3];
  if (!rawPath) {
    throw new Error('You need to provide config as a first argument!');
  }

  const externalConfig = loadExternalConfig(rawPath);

  return mergeConfig(externalConfig);
}

export function loadExternalConfig(path: string): any {
  const configPath = parseConfigPath(path);

  if (extname(configPath) === '.ts') {
    // if we are loading TS file transpile it on the fly
    require('ts-node').register();
  }
  const configModule = require(configPath);

  if (!configModule.default) {
    throw new Error('Couldnt find default export!');
  }

  return configModule.default;
}

export function mergeConfig(externalConfig: any): SpockConfig {
  const config: SpockConfig = {
    ...getDefaultConfig(process.env),
    ...externalConfig,
  } as any;

  return config;
}

export function parseConfigPath(rawPath: string): string {
  if (isAbsolute(rawPath)) {
    return rawPath;
  }
  return join(process.cwd(), rawPath);
}

export function getRequiredString(env: Env, name: string): string {
  const value = env[name];
  if (value === undefined) {
    throw new Error(`Required env var ${name} missing`);
  }

  return value;
}

export function getRequiredNumber(env: Env, name: string): number {
  const string = getRequiredString(env, name);
  const number = parseInt(string);
  if (isNaN(number)) {
    throw new Error(`Couldn't parse ${name} as number`);
  }

  return number;
}

export type Env = Dictionary<string | undefined>;
