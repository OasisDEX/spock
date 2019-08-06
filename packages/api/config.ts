import {
  getRequiredString,
  getRequiredNumber,
  Env,
  loadExternalConfig,
} from '../core/utils/configUtils';

export interface ApiConfig {
  api: {
    whitelisting: {
      enabled: boolean;
      whitelistedQueriesDir: string;
      bypassSecret: string;
    };
    responseCaching: {
      enabled: boolean;
      duration: string;
    };
    port: number;
  };
  db: {
    database: string;
    user: string;
    password: string;
    host: string;
    port: number;
  };
}

export function getApiConfig(env: Env, configPath: string): ApiConfig {
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
      whitelisting: {
        enabled: !!process.env.VL_GRAPHQL_WHITELISTING_ENABLED,
        ...externalConfig.api.whitelisting,
      },
      responseCaching: {
        enabled: !!process.env.VL_GRAPHQL_CACHING_ENABLED,
        duration: process.env.VL_GRAPHQL_CACHING_DURATION || '15 seconds',
        ...externalConfig.api.responseCaching,
      },
    },
  };
}
