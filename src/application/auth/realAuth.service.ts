// src/application/auth/realAuth.service.ts

import type { LocalSession, LocalUser } from '@/domain/auth/auth.types';

import {
  deactivateAllLocalSessions,
  upsertLocalSession,
  upsertLocalUser,
} from '@/infrastructure/db/repositories/sessionRepository';
import { saveSecureTokens } from '@/infrastructure/security/secureTokenStore';
import { createMobileSupabaseClient } from '@/infrastructure/supabase/mobileSupabaseClient';

function nowIso(): string {
  return new Date().toISOString();
}

function addDaysIso(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

function mapPanelRoleToLocalRole(role?: string): LocalUser['role'] {
  if (role === 'super_admin') {
    return 'super_admin';
  }

  if (role === 'admin') {
    return 'admin';
  }

  if (role === 'supervisor') {
    return 'supervisor';
  }

  return 'field_agent';
}

export async function loginWithEmailPassword(params: {
  email: string;
  password: string;
}): Promise<{
  user: LocalUser;
  session: LocalSession;
}> {
  const now = nowIso();

  const mobileSupabase = createMobileSupabaseClient();
  const authResult = await mobileSupabase.auth.signInWithPassword({
    email: params.email.trim(),
    password: params.password,
  });

  if (authResult.error) {
    throw new Error(`LOGIN_FAILED:${authResult.error.message}`);
  }

  const supabaseUser = authResult.data.user;
  const supabaseSession = authResult.data.session;

  if (!supabaseUser || !supabaseSession) {
    throw new Error('LOGIN_FAILED:SESSION_NOT_RETURNED');
  }

  const accessToken = supabaseSession.access_token;
  const refreshToken = supabaseSession.refresh_token;

  const profileResponse = await fetch(
    `${process.env.EXPO_PUBLIC_MOBILE_API_BASE_URL}/api/mobile/me`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!profileResponse.ok) {
    throw new Error(`LOGIN_PROFILE_FAILED:${profileResponse.status}`);
  }

  const profile = (await profileResponse.json()) as {
  id?: string;
  authUserId?: string;
  role?: string;
  fullName?: string;
  email?: string;
  isActive?: boolean;

  phone?: string | null;
  address?: string | null;
  addressReference?: string | null;
  zone?: string | null;
  department?: string | null;
  province?: string | null;
  district?: string | null;
};

  if (profile.role !== 'field_user') {
    throw new Error('LOGIN_FORBIDDEN:ONLY_FIELD_USER_ALLOWED');
  }

  const localUser: LocalUser = {
  id: supabaseUser.id,
  remoteId: profile.id ?? supabaseUser.id,
  fullName: profile.fullName ?? supabaseUser.email ?? 'Agente',
  email: profile.email ?? supabaseUser.email ?? params.email.trim(),

  phone: profile.phone ?? undefined,
  address: profile.address ?? undefined,
  addressReference: profile.addressReference ?? undefined,
  zone: profile.zone ?? undefined,
  department: profile.department ?? undefined,
  province: profile.province ?? undefined,
  district: profile.district ?? undefined,

  role: mapPanelRoleToLocalRole(profile.role),
  status: 'active',
  lastLoginAt: now,
  createdAt: now,
  updatedAt: now,
};

  const localSession: LocalSession = {
    id: `session_${supabaseUser.id}`,
    userId: localUser.id,
    agentId: profile.id ?? supabaseUser.id,
    deviceId: 'mobile_device',
    accessToken,
    refreshToken,
    expiresAt: new Date(supabaseSession.expires_at! * 1000).toISOString(),
    lastOnlineValidationAt: now,
    offlineGraceUntil: addDaysIso(30),
    isActive: true,
    createdAt: now,
    updatedAt: now,
  };

  await deactivateAllLocalSessions();
  await upsertLocalUser(localUser);
  await upsertLocalSession(localSession);
  await saveSecureTokens({
    accessToken,
    refreshToken,
  });

  return {
    user: localUser,
    session: localSession,
  };
}