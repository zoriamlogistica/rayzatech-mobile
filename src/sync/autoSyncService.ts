// src/sync/autoSyncService.ts

import type { NetInfoSubscription } from '@react-native-community/netinfo';

import { downloadDevTasksToLocalCache } from '@/application/tasks/taskDownload.service';
import { countPendingSyncItems } from '@/infrastructure/db/repositories/syncQueueRepository';
import {
  canAttemptSync,
  getCurrentNetworkStatus,
  subscribeToNetworkStatus,
  type NetworkStatus,
} from '@/infrastructure/network/networkService';
import { runDevSyncSimulation, type SyncEngineResult } from './syncEngine';

export type AutoSyncEvent =
  | {
      type: 'NETWORK_CHANGED';
      networkStatus: NetworkStatus;
      checkedAt: string;
    }
  | {
      type: 'SYNC_SKIPPED';
      reason: string;
      pendingItems?: number;
      networkStatus?: NetworkStatus;
      checkedAt: string;
    }
  | {
      type: 'SYNC_STARTED';
      pendingItems: number;
      networkStatus: NetworkStatus;
      checkedAt: string;
    }
  | {
      type: 'SYNC_FINISHED';
      result: SyncEngineResult | null;
      downloaded?: {
        remoteTasksReceived?: number;
        inserted?: number;
        updated?: number;
        skippedDirty?: number;
      };
      checkedAt: string;
    }
  | {
      type: 'SYNC_ERROR';
      error: string;
      checkedAt: string;
    };

export type AutoSyncListener = (event: AutoSyncEvent) => void;

let networkSubscription: NetInfoSubscription | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;
let listeners: AutoSyncListener[] = [];

let isAutoSyncStarted = false;
let isAutoSyncRunning = false;
let lastAutoSyncAt: string | null = null;

const MIN_SYNC_INTERVAL_MS = 60_000;
const PERIODIC_SYNC_INTERVAL_MS = 180_000;

function emit(event: AutoSyncEvent): void {
  for (const listener of listeners) {
    listener(event);
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function canRunByInterval(): boolean {
  if (!lastAutoSyncAt) {
    return true;
  }

  const last = new Date(lastAutoSyncAt).getTime();
  const now = Date.now();

  return now - last >= MIN_SYNC_INTERVAL_MS;
}

export function addAutoSyncListener(listener: AutoSyncListener): () => void {
  listeners.push(listener);

  return () => {
    listeners = listeners.filter((current) => current !== listener);
  };
}

export async function runAutoSyncOnce(): Promise<SyncEngineResult | null> {
  if (isAutoSyncRunning) {
    emit({
      type: 'SYNC_SKIPPED',
      reason: 'AUTO_SYNC_ALREADY_RUNNING',
      checkedAt: nowIso(),
    });

    return null;
  }

  const networkStatus = await getCurrentNetworkStatus();

  if (!canAttemptSync(networkStatus)) {
    emit({
      type: 'SYNC_SKIPPED',
      reason: 'NO_INTERNET',
      networkStatus,
      checkedAt: nowIso(),
    });

    return null;
  }

  if (!canRunByInterval()) {
    const pendingItems = await countPendingSyncItems();

    emit({
      type: 'SYNC_SKIPPED',
      reason: 'MIN_INTERVAL_NOT_REACHED',
      pendingItems,
      networkStatus,
      checkedAt: nowIso(),
    });

    return null;
  }

  isAutoSyncRunning = true;

  let pendingItems = await countPendingSyncItems();

  emit({
    type: 'SYNC_STARTED',
    pendingItems,
    networkStatus,
    checkedAt: nowIso(),
  });

  try {
    const downloadResult = await downloadDevTasksToLocalCache();

    pendingItems = await countPendingSyncItems();

    let syncResult: SyncEngineResult | null = null;

    if (pendingItems > 0) {
      syncResult = await runDevSyncSimulation({
        limit: 100,
        forceFail: false,
      });
    }

    lastAutoSyncAt = nowIso();

    emit({
      type: 'SYNC_FINISHED',
      result: syncResult,
      downloaded: {
        remoteTasksReceived: downloadResult.remoteTasksReceived,
        inserted: downloadResult.inserted,
        updated: downloadResult.updated,
        skippedDirty: downloadResult.skippedDirty,
      },
      checkedAt: nowIso(),
    });

    return syncResult;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    emit({
      type: 'SYNC_ERROR',
      error: message,
      checkedAt: nowIso(),
    });

    return null;
  } finally {
    isAutoSyncRunning = false;
  }
}

export function startAutoSyncOnNetworkReconnect(): void {
  if (isAutoSyncStarted) {
    return;
  }

  isAutoSyncStarted = true;

  networkSubscription = subscribeToNetworkStatus((networkStatus) => {
    emit({
      type: 'NETWORK_CHANGED',
      networkStatus,
      checkedAt: nowIso(),
    });

    if (canAttemptSync(networkStatus)) {
      runAutoSyncOnce().catch((error) => {
        const message = error instanceof Error ? error.message : String(error);

        emit({
          type: 'SYNC_ERROR',
          error: message,
          checkedAt: nowIso(),
        });
      });
    }
  });

  intervalId = setInterval(() => {
    runAutoSyncOnce().catch((error) => {
      const message = error instanceof Error ? error.message : String(error);

      emit({
        type: 'SYNC_ERROR',
        error: message,
        checkedAt: nowIso(),
      });
    });
  }, PERIODIC_SYNC_INTERVAL_MS);
}

export function stopAutoSyncOnNetworkReconnect(): void {
  if (networkSubscription) {
    networkSubscription();
    networkSubscription = null;
  }

  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }

  isAutoSyncStarted = false;
}

export function getAutoSyncState(): {
  isAutoSyncStarted: boolean;
  isAutoSyncRunning: boolean;
  lastAutoSyncAt: string | null;
} {
  return {
    isAutoSyncStarted,
    isAutoSyncRunning,
    lastAutoSyncAt,
  };
}