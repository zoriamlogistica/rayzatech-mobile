// src/application/auth/authSession.service.ts

import type { LocalSession, LocalUser } from '@/domain/auth/auth.types';

import {
    clearLocalAuthData,
    deactivateAllLocalSessions,
    getActiveLocalSession,
    getLocalUserById,
    upsertLocalSession,
    upsertLocalUser,
} from '@/infrastructure/db/repositories/sessionRepository';
import {
    clearSecureTokens,
    getSecureAccessToken,
    getSecureRefreshToken,
    saveSecureTokens,
} from '@/infrastructure/security/secureTokenStore';

export type AuthSessionStatus =
  | 'valid'
  | 'expired'
  | 'offline_grace_valid'
  | 'offline_grace_expired'
  | 'missing';

export type AuthSessionSnapshot = {
  status: AuthSessionStatus;
  session: LocalSession | null;
  user: LocalUser | null;
  hasSecureAccessToken: boolean;
  hasSecureRefreshToken: boolean;
  checkedAt: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

function addDaysIso(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function addHoursIso(hours: number): string {
  const date = new Date();
  date.setHours(date.getHours() + hours);
  return date.toISOString();
}

function isFutureDate(value?: string): boolean {
  if (!value) {
    return false;
  }

  return new Date(value).getTime() > Date.now();
}

export async function createDevAuthSession(): Promise<AuthSessionSnapshot> {
  const now = nowIso();

  const user: LocalUser = {
    id: 'dev_user_001',
    remoteId: 'remote_dev_user_001',
    fullName: 'Agente DEV RAYZATECH',
    email: 'agente.dev@rayzatech.local',
    role: 'field_agent',
    status: 'active',
    lastLoginAt: now,
    createdAt: now,
    updatedAt: now,
  };

  const session: LocalSession = {
    id: 'dev_session_001',
    userId: user.id,
    agentId: 'dev_agent_001',
    deviceId: 'dev_android_emulator',
    accessToken: 'dev_access_token',
    refreshToken: 'dev_refresh_token',
    expiresAt: addHoursIso(8),
    lastOnlineValidationAt: now,
    offlineGraceUntil: addDaysIso(30),
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  await deactivateAllLocalSessions();
  await upsertLocalUser(user);
  await upsertLocalSession(session);

  await saveSecureTokens({
    accessToken: session.accessToken,
    refreshToken: session.refreshToken,
  });

  return getAuthSessionSnapshot();
}

export async function getAuthSessionSnapshot(): Promise<AuthSessionSnapshot> {
  const session = await getActiveLocalSession();

  if (!session) {
    return {
      status: 'missing',
      session: null,
      user: null,
      hasSecureAccessToken: false,
      hasSecureRefreshToken: false,
      checkedAt: nowIso(),
    };
  }

  const user = await getLocalUserById(session.userId);
  const secureAccessToken = await getSecureAccessToken();
  const secureRefreshToken = await getSecureRefreshToken();

  const accessTokenValid = isFutureDate(session.expiresAt);
  const offlineGraceValid = isFutureDate(session.offlineGraceUntil);

  let status: AuthSessionStatus;

  if (accessTokenValid) {
    status = 'valid';
  } else if (offlineGraceValid) {
    status = 'offline_grace_valid';
  } else if (session.offlineGraceUntil) {
    status = 'offline_grace_expired';
  } else {
    status = 'expired';
  }

  return {
    status,
    session,
    user,
    hasSecureAccessToken: Boolean(secureAccessToken),
    hasSecureRefreshToken: Boolean(secureRefreshToken),
    checkedAt: nowIso(),
  };
}

export async function assertCanUseAppOffline(): Promise<AuthSessionSnapshot> {
  const snapshot = await getAuthSessionSnapshot();

  if (
    snapshot.status === 'valid' ||
    snapshot.status === 'offline_grace_valid'
  ) {
    return snapshot;
  }

  throw new Error(`AUTH_SESSION_NOT_ALLOWED:${snapshot.status}`);
}

export async function logoutLocalSession(): Promise<void> {
  await deactivateAllLocalSessions();
  await clearSecureTokens();
}

export async function hardClearLocalAuth(): Promise<void> {
  await deactivateAllLocalSessions();
  await clearSecureTokens();
  await clearLocalAuthData();
}