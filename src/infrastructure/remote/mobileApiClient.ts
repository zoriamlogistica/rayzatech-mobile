// src/infrastructure/remote/mobileApiClient.ts

import {
  getActiveLocalSession,
  upsertLocalSession,
} from '@/infrastructure/db/repositories/sessionRepository';
import { saveSecureTokens } from '@/infrastructure/security/secureTokenStore';
import { createMobileSupabaseClient } from '@/infrastructure/supabase/mobileSupabaseClient';
import * as FileSystem from 'expo-file-system/legacy';

function getMobileApiBaseUrl(): string {
  const baseUrl = process.env.EXPO_PUBLIC_MOBILE_API_BASE_URL;

  if (!baseUrl || !baseUrl.trim()) {
    throw new Error('MISSING_EXPO_PUBLIC_MOBILE_API_BASE_URL');
  }

  return baseUrl.trim().replace(/\/$/, '');
}

function parseResponseBody(text: string): unknown {
  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function getErrorMessageFromBody(body: unknown, status: number): string {
  if (typeof body === 'object' && body !== null && 'message' in body) {
    return String((body as { message?: unknown }).message);
  }

  if (typeof body === 'object' && body !== null && 'error' in body) {
    return String((body as { error?: unknown }).error);
  }

  if (typeof body === 'string' && body.trim()) {
    return body;
  }

  return `HTTP_${status}`;
}

async function getMobileAccessToken(): Promise<string> {
  const activeSession = await getActiveLocalSession();

  if (
    activeSession?.accessToken &&
    activeSession.accessToken.trim() &&
    activeSession.accessToken !== 'dev_access_token'
  ) {
    return activeSession.accessToken.trim();
  }

  throw new Error('AUTH_SESSION_NOT_ALLOWED:MISSING_REAL_ACCESS_TOKEN');
}

async function refreshMobileSession(): Promise<string> {
  const activeSession = await getActiveLocalSession();

  if (!activeSession?.refreshToken || activeSession.refreshToken === 'dev_refresh_token') {
    throw new Error('TOKEN_EXPIRED:REFRESH_TOKEN_NOT_AVAILABLE');
  }

  const supabase = createMobileSupabaseClient();

  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: activeSession.refreshToken,
  });

  if (error || !data.session) {
    throw new Error(`TOKEN_EXPIRED:${error?.message ?? 'SESSION_REFRESH_FAILED'}`);
  }

  const refreshedSession = data.session;
  const now = new Date().toISOString();

  const nextAccessToken = refreshedSession.access_token;
  const nextRefreshToken =
    refreshedSession.refresh_token || activeSession.refreshToken;

  await upsertLocalSession({
    ...activeSession,
    accessToken: nextAccessToken,
    refreshToken: nextRefreshToken,
    expiresAt: refreshedSession.expires_at
      ? new Date(refreshedSession.expires_at * 1000).toISOString()
      : activeSession.expiresAt,
    lastOnlineValidationAt: now,
    updatedAt: now,
  });

  await saveSecureTokens({
    accessToken: nextAccessToken,
    refreshToken: nextRefreshToken,
  });

  return nextAccessToken;
}

async function requestWithJson<TResponse>(params: {
  method: 'GET' | 'POST';
  path: string;
  payload?: Record<string, unknown>;
  retryAfterRefresh?: boolean;
}): Promise<TResponse> {
  const accessToken = await getMobileAccessToken();
  const baseUrl = getMobileApiBaseUrl();
  const normalizedPath = params.path.startsWith('/')
    ? params.path
    : `/${params.path}`;
  const url = `${baseUrl}${normalizedPath}`;

  const response = await fetch(url, {
    method: params.method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
      ...(params.method === 'POST'
        ? { 'Content-Type': 'application/json' }
        : {}),
    },
    body:
      params.method === 'POST'
        ? JSON.stringify(params.payload ?? {})
        : undefined,
  });

  const text = await response.text();
  const body = parseResponseBody(text);

  if (response.status === 401 && params.retryAfterRefresh !== false) {
    const refreshedToken = await refreshMobileSession();

    const retryResponse = await fetch(url, {
      method: params.method,
      headers: {
        Authorization: `Bearer ${refreshedToken}`,
        Accept: 'application/json',
        ...(params.method === 'POST'
          ? { 'Content-Type': 'application/json' }
          : {}),
      },
      body:
        params.method === 'POST'
          ? JSON.stringify(params.payload ?? {})
          : undefined,
    });

    const retryText = await retryResponse.text();
    const retryBody = parseResponseBody(retryText);

    if (!retryResponse.ok) {
      const message = getErrorMessageFromBody(retryBody, retryResponse.status);
      throw new Error(`MOBILE_API_ERROR:${retryResponse.status}:${message}`);
    }

    return retryBody as TResponse;
  }

  if (!response.ok) {
    const message = getErrorMessageFromBody(body, response.status);
    throw new Error(`MOBILE_API_ERROR:${response.status}:${message}`);
  }

  return body as TResponse;
}

export async function mobileApiGet<TResponse>(path: string): Promise<TResponse> {
  return requestWithJson<TResponse>({
    method: 'GET',
    path,
  });
}

export async function mobileApiPost<TResponse>(
  path: string,
  payload: Record<string, unknown>
): Promise<TResponse> {
  return requestWithJson<TResponse>({
    method: 'POST',
    path,
    payload,
  });
}

export async function mobileApiPostFormData<TResponse>(
  path: string,
  formData: FormData
): Promise<TResponse> {
  let accessToken = await getMobileAccessToken();
  const baseUrl = getMobileApiBaseUrl();
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  const url = `${baseUrl}${normalizedPath}`;

  let response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
    body: formData,
  });

  if (response.status === 401) {
    accessToken = await refreshMobileSession();

    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
      body: formData,
    });
  }

  const text = await response.text();
  const body = parseResponseBody(text);

  if (!response.ok) {
    const message = getErrorMessageFromBody(body, response.status);
    throw new Error(`MOBILE_API_ERROR:${response.status}:${message}`);
  }

  return body as TResponse;
}
export async function mobileApiUploadFile<TResponse>(params: {
  path: string;
  fileUri: string;
  fieldName: string;
  parameters: Record<string, string>;
  mimeType?: string;
}): Promise<TResponse> {
  let accessToken = await getMobileAccessToken();

  const baseUrl = getMobileApiBaseUrl();
  const normalizedPath = params.path.startsWith('/')
    ? params.path
    : `/${params.path}`;
  const url = `${baseUrl}${normalizedPath}`;

  async function uploadWithToken(token: string) {
    return FileSystem.uploadAsync(url, params.fileUri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.MULTIPART,
      fieldName: params.fieldName,
      mimeType: params.mimeType ?? 'image/webp',
      parameters: params.parameters,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
    });
  }

  let result = await uploadWithToken(accessToken);

  if (result.status === 401) {
    accessToken = await refreshMobileSession();
    result = await uploadWithToken(accessToken);
  }

  const body = parseResponseBody(result.body);

  if (result.status < 200 || result.status >= 300) {
    const message = getErrorMessageFromBody(body, result.status);
    throw new Error(`MOBILE_API_ERROR:${result.status}:${message}`);
  }

  return body as TResponse;
}