import { SpockConfig, getDefaultConfig } from '../config';
import { isAbsolute, join, extname } from 'path';

export function loadConfig(): SpockConfig {
  const rawPath = process.argv[3];
  if (!rawPath) {
    throw new Error('You need to provide config as a first argument!');
  }
  const configPath = parseConfigPath(rawPath);

  if (extname(configPath) === '.ts') {
    // if we are loading TS file transpile it on the fly
    require('ts-node').register();
  }
  const configModule = require(configPath);

  if (!configModule.default) {
    throw new Error('Couldnt find default export!');
  }

  const externalConfig = configModule.default;

  const config: SpockConfig = {
    ...getDefaultConfig(process.env),
    ...externalConfig,
  } as any;

  return config;
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
