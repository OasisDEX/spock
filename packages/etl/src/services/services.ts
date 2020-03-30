import { Provider } from 'ethers/providers'

import { RetryProvider } from '../ethereum/RetryProvider'
import { createDB } from '../db/db'
import { SpockConfig, getAllProcessors } from './config'
import { Services, TransactionalServices } from './types'
import { getNetworkState } from '../ethereum/getNetworkState'
import { getInitialProcessorsState } from '../processors/state'

export async function createServices(config: SpockConfig): Promise<Services> {
  const db = createDB(config.db)
  const provider = createProvider(config)
  const networkState = await getNetworkState(provider)
  const processorsState = getInitialProcessorsState(getAllProcessors(config))

  return {
    provider,
    ...db,
    config,
    networkState,
    processorsState,
  }
}

export async function withTx<T>(services: Services, op: (tx: TransactionalServices) => Promise<T>): Promise<T> {
  return await services.db.tx(async (tx) => {
    const txServices: TransactionalServices = {
      ...services,
      tx,
    }

    return await op(txServices)
  })
}

export function createProvider(config: SpockConfig): Provider {
  return new RetryProvider(config.chain.host, config.chain.retries)
}
