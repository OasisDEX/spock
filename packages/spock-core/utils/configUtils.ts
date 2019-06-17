import { Vulcan2xConfig, getDefaultConfig } from '../config';
import { isAbsolute, join } from 'path';

export function loadConfig(): Vulcan2xConfig {
  const rawPath = process.argv[2];
  if (!rawPath) {
    throw new Error('You need to provide config as a first argument!');
  }
  const configPath = parseConfigPath(rawPath);

  const configModule = require(configPath);

  if (!configModule.default) {
    throw new Error('Couldnt find default export!');
  }

  const externalConfig = configModule.default;

  const config: Vulcan2xConfig = {
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
