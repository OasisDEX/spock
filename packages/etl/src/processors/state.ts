import serializeError from 'serialize-error'
import { Dictionary } from 'ts-essentials'

import { Services } from '../services/types'
import { Processor } from './types'

export interface ProcessorState {
  errors: any[]
}

export type ProcessorsState = Dictionary<ProcessorState>

export function getInitialProcessorsState(processors: Processor[]): ProcessorsState {
  const processorsState: ProcessorsState = {}

  for (const processor of processors) {
    processorsState[processor.name] = { errors: [] }
  }

  return processorsState
}

export function clearProcessorState(services: Services, processor: Processor): void {
  services.processorsState[processor.name].errors = []
}

export function addProcessorError(services: Services, processor: Processor, error: any): void {
  services.processorsState[processor.name].errors.push(serializeError(error))
}

export function getProcessorErrors(services: Services, processor: Processor): any[] {
  return services.processorsState[processor.name].errors
}
