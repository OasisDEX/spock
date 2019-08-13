import { Provider } from 'ethers/providers';
import { Network } from 'ethers/utils';

export interface NetworkState {
  latestEthereumBlockOnStart: number;
  networkName: Network;
}

export async function getNetworkState(provider: Provider): Promise<NetworkState> {
  return {
    latestEthereumBlockOnStart: await provider.getBlockNumber(),
    networkName: await provider.getNetwork(),
  };
}

export function isGanache(networkState: NetworkState): boolean {
  return networkState.networkName.name === 'unknown';
}
