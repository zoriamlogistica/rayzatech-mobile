// src/application/bootstrap/appBootstrap.service.ts

import type { AuthSessionSnapshot } from '@/application/auth/authSession.service';
import {
    assertCanUseAppOffline,
    getAuthSessionSnapshot,
} from '@/application/auth/authSession.service';
import { getDatabaseInfo, openDatabase } from '@/infrastructure/db/database';

export type AppBootstrapStatus =
  | 'ready'
  | 'auth_required'
  | 'database_error'
  | 'auth_error';

export type AppBootstrapResult = {
  status: AppBootstrapStatus;
  database?: {
    name: string;
    currentVersion: number;
    latestVersion: number;
    status: string;
  };
  auth?: AuthSessionSnapshot;
  error?: string;
  bootstrappedAt: string;
};

function nowIso(): string {
  return new Date().toISOString();
}

export async function bootstrapApp(): Promise<AppBootstrapResult> {
  try {
    await openDatabase();

    const database = await getDatabaseInfo();

    const authSnapshot = await getAuthSessionSnapshot();

    if (authSnapshot.status === 'missing') {
      return {
        status: 'auth_required',
        database,
        auth: authSnapshot,
        bootstrappedAt: nowIso(),
      };
    }

    try {
      const allowedAuth = await assertCanUseAppOffline();

      return {
        status: 'ready',
        database,
        auth: allowedAuth,
        bootstrappedAt: nowIso(),
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      return {
        status: 'auth_error',
        database,
        auth: authSnapshot,
        error: message,
        bootstrappedAt: nowIso(),
      };
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    return {
      status: 'database_error',
      error: message,
      bootstrappedAt: nowIso(),
    };
  }
}