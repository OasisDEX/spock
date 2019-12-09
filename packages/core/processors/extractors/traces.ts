import { TransactionalServices } from '../../types';
import * as rp from 'request-promise-native';
import { silenceError, matchUniqueKeyError } from './common';

type Trace = object;

export async function getTrace(services: TransactionalServices, txHash: string): Promise<Trace[]> {
  const nodeURL = services.config.chain.host;

  const rawTrace = await customRPCCall(nodeURL, {
    method: 'trace_replayTransaction',
    params: [txHash, ['trace']],
    id: 1,
    jsonrpc: '2.0',
  });

  return rawTrace.result.trace;
}

async function customRPCCall(host: string, payload: object): Promise<any> {
  const options = {
    method: 'POST',
    uri: host,
    body: payload,
    json: true,
  };

  return rp(options);
}

export async function addTrace(
  services: TransactionalServices,
  txId: number,
  traceObject: object,
): Promise<void> {
  await services.tx
    .none(
      `
    INSERT INTO vulcan2x.traces (tx_id, trace_blob) 
    VALUES(\${txId}, \${traceObject}) 
    ON CONFLICT DO NOTHING
  `,
      {
        txId: txId,
        traceObject: traceObject,
      },
    )
    .catch(silenceError(matchUniqueKeyError));
}
