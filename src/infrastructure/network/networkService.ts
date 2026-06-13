// src/infrastructure/network/networkService.ts

import NetInfo, {
    NetInfoState,
    NetInfoSubscription,
} from '@react-native-community/netinfo';

export type NetworkConnectionType =
  | 'none'
  | 'unknown'
  | 'cellular'
  | 'wifi'
  | 'ethernet'
  | 'bluetooth'
  | 'vpn'
  | 'other';

export type NetworkStatus = {
  isConnected: boolean;
  isInternetReachable: boolean;
  type: NetworkConnectionType;
  isWifi: boolean;
  isCellular: boolean;
  checkedAt: string;
};

function mapNetInfoState(state: NetInfoState): NetworkStatus {
  return {
    isConnected: state.isConnected === true,
    isInternetReachable: state.isInternetReachable === true,
    type: state.type as NetworkConnectionType,
    isWifi: state.type === 'wifi',
    isCellular: state.type === 'cellular',
    checkedAt: new Date().toISOString(),
  };
}

export async function getCurrentNetworkStatus(): Promise<NetworkStatus> {
  const state = await NetInfo.fetch();

  return mapNetInfoState(state);
}

export function subscribeToNetworkStatus(
  callback: (status: NetworkStatus) => void
): NetInfoSubscription {
  return NetInfo.addEventListener((state) => {
    callback(mapNetInfoState(state));
  });
}

export function canAttemptSync(status: NetworkStatus): boolean {
  return status.isConnected && status.isInternetReachable;
}