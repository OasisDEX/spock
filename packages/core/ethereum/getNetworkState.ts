import { JsonRpcProvider } from 'ethers/providers';

export interface NetworkState {
  latestEthereumBlockOnStart: number;
}

export async function getNetworkState(provider: JsonRpcProvider): Promise<NetworkState> {
  return {
    latestEthereumBlockOnStart: await provider.getBlockNumber(),
  };
}
