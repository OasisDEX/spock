import { Dictionary, MarkRequired, DeepPartial } from 'ts-essentials';
import { Env, getRequiredString, getRequiredNumber } from './utils/configUtils';
import { BlockExtractor, BlockTransformer, Processor } from './processors/types';

export interface SpockConfig {
  startingBlock: number;
  lastBlock?: number;
  extractors: BlockExtractor[];
  transformers: BlockTransformer[];
  migrations: Dictionary<string>;

  // unique number that will be used to acquire lock on database
  processDbLock: number;
  blockGenerator: {
    batch: number;
  };
  extractorWorker: {
    batch: number;
    reorgBuffer: number;
  };
  transformerWorker: {
    batch: number;
  };
  processorsWorker: {
    retriesOnErrors: number;
  };
  statsWorker: {
    enabled: boolean;
    interval: number; // in minutes
  };
  chain: {
    host: string;
    name: string;
    retries: number;
    alternativeHosts?: string[];
  };
  db: {
    database: string;
    user: string;
    password: string;
    host: string;
    port: number;
  };
  sentry?: {
    dsn: string;
    environment: string;
  };
}

export type UserProvidedSpockConfig = DeepPartial<SpockConfig> &
  Pick<SpockConfig, 'startingBlock' | 'lastBlock' | 'extractors' | 'transformers' | 'migrations'>;

export type ExternalVulcan2xConfig = MarkRequired<
  Partial<SpockConfig>,
  'startingBlock' | 'extractors' | 'transformers'
>;

export const getDefaultConfig = (env: Env) => {
  return {
    processDbLock: 0x1337, // unique number that will be used to acquire lock on database
    blockGenerator: {
      batch: 40,
    },
    extractorWorker: {
      batch: 400,
      reorgBuffer: 500, // when to switch off batch processing
    },
    transformerWorker: {
      batch: 1000,
    },
    processorsWorker: {
      retriesOnErrors: 10,
    },
    statsWorker: {
      enabled: true,
      interval: 10, // get stats every 10 minutes
    },
    chain: {
      host: getRequiredString(env, 'VL_CHAIN_HOST'),
      name: getRequiredString(env, 'VL_CHAIN_NAME'),
      retries: 15, // retry for ~1 block time ~15 seconds
    },
    db: {
      database: getRequiredString(env, 'VL_DB_DATABASE'),
      user: getRequiredString(env, 'VL_DB_USER'),
      password: getRequiredString(env, 'VL_DB_PASSWORD'),
      host: getRequiredString(env, 'VL_DB_HOST'),
      port: getRequiredNumber(env, 'VL_DB_PORT'),
    },
    sentry: env.SENTRY_DSN && {
      dsn: getRequiredString(env, 'SENTRY_DSN'),
      environment: getRequiredString(env, 'SENTRY_ENV'),
    },
  };
};

export function isProd(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function getAllProcessors(config: SpockConfig): Processor[] {
  return [...config.extractors, ...config.transformers];
}
