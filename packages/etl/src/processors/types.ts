import { TransactionalServices, LocalServices } from '../types'
import { BlockModel } from '../db/models/Block'

export interface BlockExtractor {
  name: string
  startingBlock?: number // note: block number not id
  extractorDependencies?: string[]
  disablePerfBoost?: boolean

  // @note: blocks are always consecutive
  // get data from node to database
  extract: (services: TransactionalServices, blocks: BlockModel[]) => Promise<void>

  // get data from database
  getData(services: LocalServices, blocks: BlockModel[]): Promise<any>
}

export interface BlockTransformer {
  name: string
  startingBlock?: number // note: block number not id
  dependencies: string[]
  transformerDependencies?: string[]
  transform(service: LocalServices, data: any[]): Promise<void>
}

export type Processor = BlockTransformer | BlockExtractor

export function isExtractor(p: Processor): p is BlockExtractor {
  return !!(p as any).extract
}

export type JobType = 'extract' | 'transform'
