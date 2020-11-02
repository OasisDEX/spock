import { Dictionary, DeepPartial } from 'ts-essentials'
import * as z from 'zod'
import { Env, getRequiredString, getRequiredNumber } from './configUtils'
import { Processor } from '../processors/types'

const AnyFunc: z.Schema<(...args: any[]) => any> = z.any().refine((o) => o instanceof Function)

const extractorSchema = z.object({
  name: z.string(),
  startingBlock: z.number().optional(),
  extractorDependencies: z.array(z.string()).optional(),
  disablePerfBoost: z.boolean().optional(),
  extract: AnyFunc,
  getData: AnyFunc,
})

const transformerSchema = z.object({
  name: z.string(),
  startingBlock: z.number().optional(),
  dependencies: z.array(z.string()),
  transformerDependencies: z.array(z.string()).optional(),
  transform: AnyFunc,
})

const blockGeneratorSchema = z.object({
  batch: z.number(),
})

const extractorWorkerSchema = z.object({
  batch: z.number(),
  reorgBuffer: z.number(),
})

const transformerWorkerSchema = z.object({
  batch: z.number(),
})

const processorsWorkerSchema = z.object({
  retriesOnErrors: z.number(),
})

const statsWorkerSchema = z.object({
  enabled: z.boolean(),
  interval: z.number(), // in minutes
})

export const spockConfigSchema = z.object({
  startingBlock: z.number(),
  lastBlock: z.number().optional(),
  extractors: z.array(extractorSchema),
  transformers: z.array(transformerSchema),
  migrations: z.any(),
  onStart: AnyFunc,

  processDbLock: z.number(),
  blockGenerator: blockGeneratorSchema,
  extractorWorker: extractorWorkerSchema,
  transformerWorker: transformerWorkerSchema,
  processorsWorker: processorsWorkerSchema,
  statsWorker: statsWorkerSchema,

  chain: z.object({
    host: z.string(),
    name: z.string(),
    retries: z.number(),
  }),
  db: z.union([
    z.object({
      database: z.string(),
      user: z.string(),
      password: z.string(),
      host: z.string(),
      port: z.number(),
    }),
    z.record(z.string()),
  ]),
  sentry: z
    .object({
      dsn: z.string(),
      environment: z.string(),
    })
    .optional(),
})

export type SpockConfig = z.infer<typeof spockConfigSchema>
type t1 = SpockConfig['extractors'][number]

// Config type that should be used as an input for spock. It can have any additional fields (hence & Dictionary<any>)
export type UserProvidedSpockConfig = DeepPartial<SpockConfig> &
  Pick<SpockConfig, 'startingBlock' | 'lastBlock' | 'extractors' | 'transformers' | 'migrations'> &
  Dictionary<any>

export function getDefaultConfig(env: Env): DeepPartial<SpockConfig> {
  return {
    processDbLock: 0x1337, // unique number that will be used to acquire lock on database
    blockGenerator: {
      batch: 40,
    },
    extractorWorker: {
      batch: 400,
      reorgBuffer: 100, // when to switch off batch processing, set to 0 to turn always process in batches
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
  }
}

export function isProd(): boolean {
  return process.env.NODE_ENV === 'production'
}

export function getAllProcessors(config: SpockConfig): Processor[] {
  return [...config.extractors, ...config.transformers] as any
}
