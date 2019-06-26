import {
  getRequiredString,
  getRequiredNumber,
  Env,
  loadExternalConfig,
} from '../core/utils/configUtils';

export type ApiConfig = ReturnType<typeof getApiConfig>;

export const getApiConfig = (env: Env, configPath: string) => {
  const externalConfig = loadExternalConfig(configPath);

  return {
    db: {
      database: getRequiredString(env, 'VL_DB_DATABASE'),
      user: getRequiredString(env, 'VL_DB_USER'),
      password: getRequiredString(env, 'VL_DB_PASSWORD'),
      host: getRequiredString(env, 'VL_DB_HOST'),
      port: getRequiredNumber(env, 'VL_DB_PORT'),
    },
    api: {
      port: 3001,
      ...externalConfig.api,
    },
  };
};
