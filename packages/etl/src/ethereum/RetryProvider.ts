import { JsonRpcProvider } from 'ethers/providers'
import { Networkish } from 'ethers/utils'
import { ConnectionInfo, poll } from 'ethers/utils/web'

import { RetryableError } from '../utils/errors'
import { getLogger } from '../utils/logger'
import { delay } from '../utils/promises'

const logger = getLogger('ethereum/RetryProvider')

/**
 * Custom ethers.js provider automatically retrying any errors coming from node
 */
export class RetryProvider extends JsonRpcProvider {
  public maxAttempts: number

  constructor(url: ConnectionInfo | string, attempts: number, network?: Networkish) {
    super(url, network)
    this.maxAttempts = attempts
  }

  public async perform(method: string, params: any): Promise<any> {
    let attempt = 0

    return poll(async () => {
      attempt++

      try {
        return await super.perform(method, params)
      } catch (error) {
        logger.debug(
          `Got ${error.statusCode}, ${JSON.stringify({
            attempts: attempt,
            method,
            params,
            error,
          })}`,
        )

        await this.handleError(attempt, error)
      }
    })
  }

  private async handleError(attempt: number, error: any): Promise<void> {
    if (attempt >= this.maxAttempts) {
      logger.debug('Got error, failing...', JSON.stringify(error))
      throw this.transformError(error)
    } else if (error && error.statusCode) {
      // if we are hitting the api limit retry faster
      logger.debug('Retrying 429...')
      await delay(500)
    } else {
      // just retry if error is not critical
      logger.debug('Retrying...')
      await delay(1000)
    }
  }

  /**
   * Wraps not critical errors in RetryableError
   */
  private transformError(error: any): any {
    if (!error) {
      return error
    }
    // ERROR: One of the blocks specified in filter (fromBlock, toBlock or blockHash) cannot be found
    if (error.code === -32000) {
      return new RetryableError(error.message)
    }
    // ERROR: rate limiting
    if (error.code === 429) {
      return new RetryableError(error.message)
    }
    // ERROR: reorg happened during processing and now when asking for logs alchemy gives weird error msg
    if (error.code === -32602) {
      return new RetryableError(error.message)
    }

    return error
  }
}

// Some of the errors that might occur:

// - INFURA When infura is not fully synced:
// {"code":-32000,"url":"https://mainnet.infura.io/v3/6d6c70e65c77429482df5b64a4d0c943","body":"{\"method\":\"eth_getLogs\",\"params\":[{\"blockHash\":\"0xede4a2e56f94e85cb1bf134ccfd9c992ec8b28167d8586fe9841f58192ae30f4\",\"address\":\"0x39755357759ce0d7f32dc8dc45414cca409ae24e\"}],\"id\":42,\"jsonrpc\":\"2.0\"}","responseText":"{\"jsonrpc\":\"2.0\",\"id\":42,\"error\":{\"code\":-32000,\"message\":\"unknown block\"}}"}

// - INFURA random (?) error?
// {"code":-32603,"url":"https://mainnet.infura.io/v3/6d6c70e65c77429482df5b64a4d0c943","body":"{\"method\":\"eth_getBlockByNumber\",\"params\":[\"0x76b25b\",false],\"id\":42,\"jsonrpc\":\"2.0\"}","responseText":"{\"jsonrpc\":\"2.0\",\"id\":42,\"error\":{\"code\":-32603,\"message\":\"request failed or timed out\"}}"}

// - INFURA query returned more than 1000 results
// {"attempts":8,"method":"getLogs","params":{"filter":{"fromBlock":"0x76ebdb","toBlock":"0x76ec2a","address":"0x39755357759ce0d7f32dc8dc45414cca409ae24e"}},"error":{"code":-32005,"url":"https://mainnet.infura.io/v3/6d6c70e65c77429482df5b64a4d0c943","body":"{\"method\":\"eth_getLogs\",\"params\":[{\"fromBlock\":\"0x76ebdb\",\"toBlock\":\"0x76ec2a\",\"address\":\"0x39755357759ce0d7f32dc8dc45414cca409ae24e\"}],\"id\":42,\"jsonrpc\":\"2.0\"}","responseText":"{\"jsonrpc\":\"2.0\",\"id\":42,\"error\":{\"code\":-32005,\"message\":\"query returned more than 1000 results\"}}"}}
