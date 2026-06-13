// src/domain/auth/auth.types.ts

export type UserRole =
  | 'field_agent'
  | 'supervisor'
  | 'admin'
  | 'super_admin';

export type LocalUser = {
  id: string;
  remoteId?: string;
  fullName?: string;
  email?: string;

  phone?: string;
  address?: string;
  addressReference?: string;
  zone?: string;
  department?: string;
  province?: string;
  district?: string;

  role: UserRole;
  status: 'active' | 'inactive' | 'blocked';
  lastLoginAt?: string;
  createdAt?: string;
  updatedAt?: string;
};

export type LocalSession = {
  id: string;

  userId: string;
  agentId?: string;
  deviceId: string;

  accessToken?: string;
  refreshToken?: string;

  expiresAt?: string;
  lastOnlineValidationAt?: string;
  offlineGraceUntil?: string;

  isActive: boolean;

  createdAt: string;
  updatedAt: string;
};