// src/infrastructure/security/secureTokenStore.ts

import * as SecureStore from 'expo-secure-store';

const ACCESS_TOKEN_KEY = 'rayzatech_access_token';
const REFRESH_TOKEN_KEY = 'rayzatech_refresh_token';

export async function saveSecureTokens(params: {
  accessToken?: string;
  refreshToken?: string;
}): Promise<void> {
  if (params.accessToken) {
    await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, params.accessToken);
  }

  if (params.refreshToken) {
    await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, params.refreshToken);
  }
}

export async function getSecureAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function getSecureRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY);
}

export async function clearSecureTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY);
}