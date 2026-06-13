// src/infrastructure/db/repositories/sessionRepository.ts

import type { LocalSession, LocalUser } from '@/domain/auth/auth.types';
import { getDatabase } from '../database';

type UserRow = {
  id: string;
  remote_id: string | null;
  full_name: string | null;
  email: string | null;

  phone: string | null;
  address: string | null;
  address_reference: string | null;
  zone: string | null;
  department: string | null;
  province: string | null;
  district: string | null;

  role: LocalUser['role'];
  status: LocalUser['status'];
  last_login_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type SessionRow = {
  id: string;
  user_id: string;
  agent_id: string | null;
  device_id: string;
  access_token: string | null;
  refresh_token: string | null;
  expires_at: string | null;
  last_online_validation_at: string | null;
  offline_grace_until: string | null;
  is_active: number;
  created_at: string;
  updated_at: string;
};

function mapUserRow(row: UserRow): LocalUser {
  return {
    id: row.id,
    remoteId: row.remote_id ?? undefined,
    fullName: row.full_name ?? undefined,
    email: row.email ?? undefined,

    phone: row.phone ?? undefined,
    address: row.address ?? undefined,
    addressReference: row.address_reference ?? undefined,
    zone: row.zone ?? undefined,
    department: row.department ?? undefined,
    province: row.province ?? undefined,
    district: row.district ?? undefined,

    role: row.role,
    status: row.status,
    lastLoginAt: row.last_login_at ?? undefined,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
  };
}

function mapSessionRow(row: SessionRow): LocalSession {
  return {
    id: row.id,
    userId: row.user_id,
    agentId: row.agent_id ?? undefined,
    deviceId: row.device_id,
    accessToken: row.access_token ?? undefined,
    refreshToken: row.refresh_token ?? undefined,
    expiresAt: row.expires_at ?? undefined,
    lastOnlineValidationAt: row.last_online_validation_at ?? undefined,
    offlineGraceUntil: row.offline_grace_until ?? undefined,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function upsertLocalUser(user: LocalUser): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `
      INSERT INTO users (
  id,
  remote_id,
  full_name,
  email,
  phone,
  address,
  address_reference,
  zone,
  department,
  province,
  district,
  role,
  status,
  last_login_at,
  created_at,
  updated_at
)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT(id) DO UPDATE SET
  remote_id = excluded.remote_id,
  full_name = excluded.full_name,
  email = excluded.email,
  phone = excluded.phone,
  address = excluded.address,
  address_reference = excluded.address_reference,
  zone = excluded.zone,
  department = excluded.department,
  province = excluded.province,
  district = excluded.district,
  role = excluded.role,
  status = excluded.status,
  last_login_at = excluded.last_login_at,
  updated_at = excluded.updated_at;
    `,
    [
  user.id,
  user.remoteId ?? null,
  user.fullName ?? null,
  user.email ?? null,
  user.phone ?? null,
  user.address ?? null,
  user.addressReference ?? null,
  user.zone ?? null,
  user.department ?? null,
  user.province ?? null,
  user.district ?? null,
  user.role,
  user.status,
  user.lastLoginAt ?? null,
  user.createdAt ?? null,
  user.updatedAt ?? null,
]
  );
}

export async function getLocalUserById(userId: string): Promise<LocalUser | null> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<UserRow>(
    `
      SELECT *
      FROM users
      WHERE id = ?
      LIMIT 1;
    `,
    [userId]
  );

  return row ? mapUserRow(row) : null;
}

export async function upsertLocalSession(session: LocalSession): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `
      INSERT INTO sessions (
        id,
        user_id,
        agent_id,
        device_id,
        access_token,
        refresh_token,
        expires_at,
        last_online_validation_at,
        offline_grace_until,
        is_active,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        user_id = excluded.user_id,
        agent_id = excluded.agent_id,
        device_id = excluded.device_id,
        access_token = excluded.access_token,
        refresh_token = excluded.refresh_token,
        expires_at = excluded.expires_at,
        last_online_validation_at = excluded.last_online_validation_at,
        offline_grace_until = excluded.offline_grace_until,
        is_active = excluded.is_active,
        updated_at = excluded.updated_at;
    `,
    [
      session.id,
      session.userId,
      session.agentId ?? null,
      session.deviceId,
      session.accessToken ?? null,
      session.refreshToken ?? null,
      session.expiresAt ?? null,
      session.lastOnlineValidationAt ?? null,
      session.offlineGraceUntil ?? null,
      session.isActive ? 1 : 0,
      session.createdAt,
      session.updatedAt,
    ]
  );
}

export async function getActiveLocalSession(): Promise<LocalSession | null> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<SessionRow>(
    `
      SELECT *
      FROM sessions
      WHERE is_active = 1
      ORDER BY updated_at DESC
      LIMIT 1;
    `
  );

  return row ? mapSessionRow(row) : null;
}

export async function deactivateAllLocalSessions(): Promise<void> {
  const db = await getDatabase();

  const now = new Date().toISOString();

  await db.runAsync(
    `
      UPDATE sessions
      SET
        is_active = 0,
        updated_at = ?;
    `,
    [now]
  );
}

export async function clearLocalAuthData(): Promise<void> {
  const db = await getDatabase();

  await db.execAsync(`
    DELETE FROM sessions;
    DELETE FROM users;
  `);
}