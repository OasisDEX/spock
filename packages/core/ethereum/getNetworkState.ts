import { Provider } from 'ethers/providers';

export interface NetworkState {
  latestEthereumBlockOnStart: number;
}

export async function getNetworkState(provider: Provider): Promise<NetworkState> {
  return {
    latestEthereumBlockOnStart: await provider.getBlockNumber(),
  };
}
