// src/application/profile/userProfile.service.ts

import type { LocalSession, LocalUser } from '@/domain/auth/auth.types';
import {
    getActiveLocalSession,
    getLocalUserById,
} from '@/infrastructure/db/repositories/sessionRepository';

export type LocalUserProfile = {
  user: LocalUser | null;
  session: LocalSession | null;

  fullName: string;
  email: string;
  role: string;
  status: string;

  userId?: string;
  remoteId?: string;
  agentId?: string;
  deviceId?: string;

  lastLoginAt?: string;
  lastOnlineValidationAt?: string;
  offlineGraceUntil?: string;
  expiresAt?: string;

  hasActiveSession: boolean;
};

export async function getCurrentLocalUserProfile(): Promise<LocalUserProfile> {
  const session = await getActiveLocalSession();

  if (!session) {
    return {
      user: null,
      session: null,
      fullName: 'Sin sesión activa',
      email: '-',
      role: '-',
      status: 'auth_required',
      hasActiveSession: false,
    };
  }

  const user = await getLocalUserById(session.userId);

  return {
    user,
    session,

    fullName: user?.fullName ?? 'Usuario sin nombre',
    email: user?.email ?? '-',
    role: user?.role ?? '-',
    status: user?.status ?? 'unknown',

    userId: user?.id ?? session.userId,
    remoteId: user?.remoteId,
    agentId: session.agentId,
    deviceId: session.deviceId,

    lastLoginAt: user?.lastLoginAt,
    lastOnlineValidationAt: session.lastOnlineValidationAt,
    offlineGraceUntil: session.offlineGraceUntil,
    expiresAt: session.expiresAt,

    hasActiveSession: session.isActive,
  };
}