// src/application/logging/appLogger.service.ts

import {
    insertLocalLog,
    type LocalLog,
    type LocalLogLevel,
} from '@/infrastructure/db/repositories/localLogRepository';

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

function normalizeError(error: unknown): {
  errorName?: string;
  errorMessage?: string;
  errorStack?: string;
} {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
      errorStack: error.stack,
    };
  }

  if (typeof error === 'string') {
    return {
      errorName: 'StringError',
      errorMessage: error,
    };
  }

  try {
    return {
      errorName: 'UnknownError',
      errorMessage: JSON.stringify(error),
    };
  } catch {
    return {
      errorName: 'UnknownError',
      errorMessage: 'Error could not be serialized',
    };
  }
}

export type AppLogInput = {
  scope: string;
  message: string;
  payload?: Record<string, unknown>;
  error?: unknown;
  taskId?: string;
  userId?: string;
};

async function writeLog(
  level: LocalLogLevel,
  input: AppLogInput
): Promise<void> {
  const normalizedError = input.error
    ? normalizeError(input.error)
    : {
        errorName: undefined,
        errorMessage: undefined,
        errorStack: undefined,
      };

  const log: LocalLog = {
    id: makeId('log'),
    level,
    scope: input.scope,
    message: input.message,
    payload: input.payload,
    errorName: normalizedError.errorName,
    errorMessage: normalizedError.errorMessage,
    errorStack: normalizedError.errorStack,
    taskId: input.taskId,
    userId: input.userId,
    createdAt: nowIso(),
  };

  await insertLocalLog(log);
}

export const appLogger = {
  debug(input: AppLogInput): Promise<void> {
    return writeLog('debug', input);
  },

  info(input: AppLogInput): Promise<void> {
    return writeLog('info', input);
  },

  warn(input: AppLogInput): Promise<void> {
    return writeLog('warn', input);
  },

  error(input: AppLogInput): Promise<void> {
    return writeLog('error', input);
  },
};

export async function logAndRethrow(input: AppLogInput): Promise<never> {
  await appLogger.error(input);

  if (input.error instanceof Error) {
    throw input.error;
  }

  throw new Error(input.message);
}