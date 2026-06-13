// src/app/dev-db-test.tsx

import { useState } from 'react';
import {
  Alert,
  Button,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { Evidence } from '@/domain/evidence/evidence.types';
import type { GpsPoint } from '@/domain/gps/gps.types';
import type { SyncQueueItem } from '@/domain/sync/sync.types';
import type { Task } from '@/domain/tasks/task.types';
import type { TaskEvent } from '@/domain/tasks/taskEvent.types';
import type { TaskSeries } from '@/domain/tasks/taskSeries.types';

import {
  countEvidencesByTask,
  insertEvidence,
  listEvidencesByTask,
} from '@/infrastructure/db/repositories/evidenceRepository';
import {
  countGpsPointsByTask,
  insertGpsPoint,
  listGpsPointsByTask,
} from '@/infrastructure/db/repositories/gpsRepository';
import {
  countPendingSyncItems,
  enqueueSyncItem,
} from '@/infrastructure/db/repositories/syncQueueRepository';
import { insertTaskEvent } from '@/infrastructure/db/repositories/taskEventRepository';
import {
  countTasksByStatus,
  getTaskById,
  listTasks,
  updateTaskStatus,
  upsertTask,
} from '@/infrastructure/db/repositories/taskRepository';
import {
  countSeriesByTask,
  listTaskSeries,
  markSeriesRecovered,
  upsertTaskSeries,
} from '@/infrastructure/db/repositories/taskSeriesRepository';
import {
  captureCurrentLocation,
  getLocationQualityLabel,
  shouldRequireLocationRetry,
  shouldWarnAboutLowAccuracy,
} from '@/infrastructure/gps/locationService';
import {
  canAttemptSync,
  getCurrentNetworkStatus,
} from '@/infrastructure/network/networkService';
import { createFakeEvidenceFile } from '@/infrastructure/storage/evidenceStorage';
import {
  addAutoSyncListener,
  getAutoSyncState,
  runAutoSyncOnce,
  startAutoSyncOnNetworkReconnect,
  stopAutoSyncOnNetworkReconnect,
  type AutoSyncEvent,
} from '@/sync/autoSyncService';
import {
  clearDevSuccessfulSyncItems,
  getPendingSyncPreview,
  runDevSyncSimulation,
} from '@/sync/syncEngine';

function nowIso(): string {
  return new Date().toISOString();
}

function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.floor(Math.random() * 100000)}`;
}

const TEST_TASK_ID = 'local_test_task_001';
const TEST_SERIES_ID_1 = 'series_test_001';
const TEST_SERIES_ID_2 = 'series_test_002';
const TEST_EVIDENCE_ID = 'evidence_test_001';

export default function DevDbTestScreen() {
  const [output, setOutput] = useState<string>('Esperando prueba...');
  const [autoSyncEvents, setAutoSyncEvents] = useState<AutoSyncEvent[]>([]);

  function log(value: unknown) {
    setOutput(JSON.stringify(value, null, 2));
  }

  async function createTestTask() {
    try {
      const now = nowIso();

      const task: Task = {
        id: TEST_TASK_ID,
        taskNumber: 'TAREA-LOCAL-001',
        orderCode: 'ORD-TEST-001',
        project: 'RAYZATECH RECOVERY',
        sot: 'SOT-PRUEBA-001',
        assignedUserId: 'agent_test_001',
        customerName: 'Cliente de Prueba',
        customerDocument: '00000000',
        customerPhone: '999999999',
        department: 'Lima',
        province: 'Lima',
        district: 'San Isidro',
        address: 'Av. Prueba 123',
        reference: 'Frente a referencia de prueba',
        latitude: -12.096,
        longitude: -77.037,
        scheduledDate: now.slice(0, 10),
        timeRange: '09:00 - 13:00',
        taskType: 'recovery',
        priority: 'normal',
        status: 'pending',
        observations: 'Tarea creada localmente para prueba offline.',
        version: 1,
        localUpdatedAt: now,
        syncStatus: 'pending_sync',
        isDirty: true,
        isLocked: false,
        createdAt: now,
        updatedAt: now,
      };

      await upsertTask(task);

      const event: TaskEvent = {
        id: makeId('event'),
        taskId: TEST_TASK_ID,
        eventType: 'TASK_DOWNLOADED',
        description: 'Tarea de prueba creada localmente.',
        payload: {
          source: 'dev-db-test',
          offlineTest: true,
        },
        occurredAt: now,
        syncStatus: 'pending_sync',
        createdAt: now,
      };

      await insertTaskEvent(event);

      const syncItem: SyncQueueItem = {
        id: makeId('sync'),
        entityType: 'task',
        entityId: TEST_TASK_ID,
        operation: 'CREATE',
        payload: {
          taskId: TEST_TASK_ID,
          action: 'CREATE_TEST_TASK',
        },
        status: 'pending',
        priority: 1,
        attemptCount: 0,
        maxAttempts: 10,
        createdAt: now,
        updatedAt: now,
      };

      await enqueueSyncItem(syncItem);

      Alert.alert('OK', 'Tarea local creada correctamente.');
      await showTask();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudo crear la tarea local.');
      log(error);
    }
  }

  async function showTask() {
    try {
      const task = await getTaskById(TEST_TASK_ID);
      log(task);
    } catch (error) {
      console.error(error);
      log(error);
    }
  }

  async function showAllTasks() {
    try {
      const tasks = await listTasks();
      log(tasks);
    } catch (error) {
      console.error(error);
      log(error);
    }
  }

  async function markInProgress() {
    try {
      const now = nowIso();

      await updateTaskStatus({
        taskId: TEST_TASK_ID,
        nextStatus: 'in_progress',
      });

      const event: TaskEvent = {
        id: makeId('event'),
        taskId: TEST_TASK_ID,
        eventType: 'TASK_STARTED',
        fromStatus: 'pending',
        toStatus: 'in_progress',
        description: 'Agente inició la tarea en modo offline.',
        payload: {
          offlineAction: true,
        },
        occurredAt: now,
        syncStatus: 'pending_sync',
        createdAt: now,
      };

      await insertTaskEvent(event);

      await enqueueSyncItem({
        id: makeId('sync'),
        entityType: 'task',
        entityId: TEST_TASK_ID,
        operation: 'UPDATE',
        payload: {
          taskId: TEST_TASK_ID,
          status: 'in_progress',
        },
        status: 'pending',
        priority: 1,
        attemptCount: 0,
        maxAttempts: 10,
        createdAt: now,
        updatedAt: now,
      });

      Alert.alert('OK', 'Tarea marcada como iniciada offline.');
      await showTask();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudo cambiar el estado.');
      log(error);
    }
  }

  async function markCompleted() {
    try {
      const now = nowIso();

      await updateTaskStatus({
        taskId: TEST_TASK_ID,
        nextStatus: 'completed',
      });

      const event: TaskEvent = {
        id: makeId('event'),
        taskId: TEST_TASK_ID,
        eventType: 'TASK_COMPLETED',
        fromStatus: 'in_progress',
        toStatus: 'completed',
        description: 'Agente completó la tarea en modo offline.',
        payload: {
          offlineAction: true,
        },
        occurredAt: now,
        syncStatus: 'pending_sync',
        createdAt: now,
      };

      await insertTaskEvent(event);

      await enqueueSyncItem({
        id: makeId('sync'),
        entityType: 'task',
        entityId: TEST_TASK_ID,
        operation: 'UPDATE',
        payload: {
          taskId: TEST_TASK_ID,
          status: 'completed',
        },
        status: 'pending',
        priority: 1,
        attemptCount: 0,
        maxAttempts: 10,
        createdAt: now,
        updatedAt: now,
      });

      Alert.alert('OK', 'Tarea marcada como completada offline.');
      await showTask();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudo completar la tarea.');
      log(error);
    }
  }

  async function showCounters() {
    try {
      const byStatus = await countTasksByStatus();
      const pendingSync = await countPendingSyncItems();

      log({
        tasksByStatus: byStatus,
        pendingSyncItems: pendingSync,
      });
    } catch (error) {
      console.error(error);
      log(error);
    }
  }

  async function createTestSeries() {
    try {
      const now = nowIso();

      const seriesList: TaskSeries[] = [
        {
          id: TEST_SERIES_ID_1,
          taskId: TEST_TASK_ID,
          serialNumber: 'SN-000001',
          equipmentType: 'MODEM',
          brand: 'HUAWEI',
          model: 'HG8245',
          expected: true,
          recovered: false,
          recoveryStatus: 'pending',
          version: 1,
          syncStatus: 'pending_sync',
          isDirty: true,
          createdAt: now,
          updatedAt: now,
          localUpdatedAt: now,
        },
        {
          id: TEST_SERIES_ID_2,
          taskId: TEST_TASK_ID,
          serialNumber: 'SN-000002',
          equipmentType: 'DECODIFICADOR',
          brand: 'ARRIS',
          model: 'DCX525',
          expected: true,
          recovered: false,
          recoveryStatus: 'pending',
          version: 1,
          syncStatus: 'pending_sync',
          isDirty: true,
          createdAt: now,
          updatedAt: now,
          localUpdatedAt: now,
        },
      ];

      for (const series of seriesList) {
        await upsertTaskSeries(series);
      }

      await enqueueSyncItem({
        id: makeId('sync'),
        entityType: 'task_series',
        entityId: TEST_TASK_ID,
        operation: 'CREATE',
        payload: {
          taskId: TEST_TASK_ID,
          count: seriesList.length,
          action: 'CREATE_TEST_SERIES',
        },
        status: 'pending',
        priority: 2,
        attemptCount: 0,
        maxAttempts: 10,
        createdAt: now,
        updatedAt: now,
      });

      Alert.alert('OK', 'Series de prueba creadas.');
      await showSeries();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudieron crear las series.');
      log(error);
    }
  }

  async function showSeries() {
    try {
      const series = await listTaskSeries(TEST_TASK_ID);
      log(series);
    } catch (error) {
      console.error(error);
      log(error);
    }
  }

  async function recoverFirstSeries() {
    try {
      const now = nowIso();

      await markSeriesRecovered({
        seriesId: TEST_SERIES_ID_1,
        observation: 'Serie recuperada en prueba offline.',
      });

      const event: TaskEvent = {
        id: makeId('event'),
        taskId: TEST_TASK_ID,
        eventType: 'SERIAL_RECOVERED',
        description: 'Serie SN-000001 recuperada offline.',
        payload: {
          serialNumber: 'SN-000001',
        },
        occurredAt: now,
        syncStatus: 'pending_sync',
        createdAt: now,
      };

      await insertTaskEvent(event);

      await enqueueSyncItem({
        id: makeId('sync'),
        entityType: 'task_series',
        entityId: TEST_SERIES_ID_1,
        operation: 'UPDATE',
        payload: {
          seriesId: TEST_SERIES_ID_1,
          recoveryStatus: 'recovered',
        },
        status: 'pending',
        priority: 2,
        attemptCount: 0,
        maxAttempts: 10,
        createdAt: now,
        updatedAt: now,
      });

      Alert.alert('OK', 'Primera serie marcada como recuperada.');
      await showSeries();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudo recuperar la serie.');
      log(error);
    }
  }

  async function showSeriesCounters() {
    try {
      const counters = await countSeriesByTask(TEST_TASK_ID);
      log(counters);
    } catch (error) {
      console.error(error);
      log(error);
    }
  }

  async function createFakeEvidence() {
    try {
      const now = nowIso();

      const fakeFile = await createFakeEvidenceFile({
        taskId: TEST_TASK_ID,
        evidenceId: TEST_EVIDENCE_ID,
      });

      const evidence: Evidence = {
        id: TEST_EVIDENCE_ID,
        taskId: TEST_TASK_ID,
        evidenceType: 'recovery_proof',
        localUri: fakeFile.localUri,
        fileName: fakeFile.fileName,
        mimeType: fakeFile.mimeType,
        sizeBytes: fakeFile.sizeBytes,
        latitude: -12.096,
        longitude: -77.037,
        accuracy: 25,
        capturedAt: now,
        uploadStatus: 'local_only',
        syncStatus: 'pending_sync',
        createdAt: now,
        updatedAt: now,
      };

      await insertEvidence(evidence);

      const event: TaskEvent = {
        id: makeId('event'),
        taskId: TEST_TASK_ID,
        eventType: 'EVIDENCE_CAPTURED',
        description: 'Evidencia simulada creada localmente.',
        payload: {
          evidenceId: TEST_EVIDENCE_ID,
          evidenceType: 'recovery_proof',
          localUri: fakeFile.localUri,
        },
        latitude: -12.096,
        longitude: -77.037,
        accuracy: 25,
        occurredAt: now,
        syncStatus: 'pending_sync',
        createdAt: now,
      };

      await insertTaskEvent(event);

      await enqueueSyncItem({
        id: makeId('sync'),
        entityType: 'evidence',
        entityId: TEST_EVIDENCE_ID,
        operation: 'UPLOAD',
        payload: {
          evidenceId: TEST_EVIDENCE_ID,
          taskId: TEST_TASK_ID,
          localUri: fakeFile.localUri,
          evidenceType: 'recovery_proof',
        },
        status: 'pending',
        priority: 3,
        attemptCount: 0,
        maxAttempts: 10,
        createdAt: now,
        updatedAt: now,
      });

      Alert.alert('OK', 'Evidencia simulada creada localmente.');
      await showEvidences();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudo crear la evidencia simulada.');
      log(error);
    }
  }

  async function showEvidences() {
    try {
      const evidences = await listEvidencesByTask(TEST_TASK_ID);
      log(evidences);
    } catch (error) {
      console.error(error);
      log(error);
    }
  }

  async function showEvidenceCounters() {
    try {
      const counters = await countEvidencesByTask(TEST_TASK_ID);
      log(counters);
    } catch (error) {
      console.error(error);
      log(error);
    }
  }

  async function captureGpsPoint() {
    try {
      const capturedLocation = await captureCurrentLocation();
      const now = nowIso();

      const eventId = makeId('event');
      const gpsPointId = makeId('gps');

      const event: TaskEvent = {
        id: eventId,
        taskId: TEST_TASK_ID,
        eventType: 'GPS_CAPTURED',
        description: 'GPS capturado manualmente desde pantalla técnica.',
        payload: {
          quality: getLocationQualityLabel(capturedLocation.accuracy),
          warnLowAccuracy: shouldWarnAboutLowAccuracy(capturedLocation.accuracy),
          requireRetry: shouldRequireLocationRetry(capturedLocation.accuracy),
        },
        latitude: capturedLocation.latitude,
        longitude: capturedLocation.longitude,
        accuracy: capturedLocation.accuracy,
        occurredAt: capturedLocation.capturedAt,
        syncStatus: 'pending_sync',
        createdAt: now,
      };

      await insertTaskEvent(event);

      const gpsPoint: GpsPoint = {
        id: gpsPointId,
        taskId: TEST_TASK_ID,
        taskEventId: eventId,
        latitude: capturedLocation.latitude,
        longitude: capturedLocation.longitude,
        accuracy: capturedLocation.accuracy,
        altitude: capturedLocation.altitude,
        speed: capturedLocation.speed,
        heading: capturedLocation.heading,
        provider: capturedLocation.provider,
        mocked: capturedLocation.mocked,
        capturedAt: capturedLocation.capturedAt,
        syncStatus: 'pending_sync',
        createdAt: now,
      };

      await insertGpsPoint(gpsPoint);

      await enqueueSyncItem({
        id: makeId('sync'),
        entityType: 'gps_point',
        entityId: gpsPointId,
        operation: 'CREATE',
        payload: {
          gpsPointId,
          taskId: TEST_TASK_ID,
          latitude: capturedLocation.latitude,
          longitude: capturedLocation.longitude,
          accuracy: capturedLocation.accuracy,
          mocked: capturedLocation.mocked,
        },
        status: 'pending',
        priority: 4,
        attemptCount: 0,
        maxAttempts: 10,
        createdAt: now,
        updatedAt: now,
      });

      Alert.alert('OK', 'GPS capturado y guardado localmente.');
      log({
        gpsPoint,
        quality: getLocationQualityLabel(capturedLocation.accuracy),
        warnLowAccuracy: shouldWarnAboutLowAccuracy(capturedLocation.accuracy),
        requireRetry: shouldRequireLocationRetry(capturedLocation.accuracy),
      });
    } catch (error) {
      console.error(error);
      Alert.alert(
        'Error',
        'No se pudo capturar GPS. Revisa permisos de ubicación.'
      );
      log(error);
    }
  }

  async function showGpsPoints() {
    try {
      const gpsPoints = await listGpsPointsByTask(TEST_TASK_ID);
      log(gpsPoints);
    } catch (error) {
      console.error(error);
      log(error);
    }
  }

  async function showGpsCounters() {
    try {
      const counters = await countGpsPointsByTask(TEST_TASK_ID);
      log(counters);
    } catch (error) {
      console.error(error);
      log(error);
    }
  }

  async function showPendingSyncQueue() {
    try {
      const pendingItems = await getPendingSyncPreview(100);

      log({
        total: pendingItems.length,
        items: pendingItems,
      });
    } catch (error) {
      console.error(error);
      log(error);
    }
  }

  async function simulateSuccessfulSync() {
    try {
      const result = await runDevSyncSimulation({
        limit: 100,
        forceFail: false,
      });

      Alert.alert(
        'OK',
        `Sync simulado finalizado. Success: ${result.success}. Failed: ${result.failed}.`
      );

      log(result);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudo ejecutar sync simulado.');
      log(error);
    }
  }

  async function simulateFailedSync() {
    try {
      const result = await runDevSyncSimulation({
        limit: 100,
        forceFail: true,
      });

      Alert.alert(
        'OK',
        `Sync fallido simulado. Failed: ${result.failed}. Remaining: ${result.remainingPending}.`
      );

      log(result);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudo simular fallo de sync.');
      log(error);
    }
  }

  async function clearSyncedItems() {
    try {
      await clearDevSuccessfulSyncItems();

      const pendingSync = await countPendingSyncItems();

      Alert.alert('OK', 'Items sincronizados eliminados de la cola.');

      log({
        cleared: true,
        pendingSyncItems: pendingSync,
      });
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudo limpiar la cola.');
      log(error);
    }
  }

  async function showNetworkStatus() {
    try {
      const networkStatus = await getCurrentNetworkStatus();

      log({
        networkStatus,
        canAttemptSync: canAttemptSync(networkStatus),
      });
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudo obtener estado de red.');
      log(error);
    }
  }

  async function syncOnlyIfOnline() {
    try {
      const networkStatus = await getCurrentNetworkStatus();

      if (!canAttemptSync(networkStatus)) {
        Alert.alert(
          'Sin conexión',
          'No se ejecutó sync porque no hay internet disponible.'
        );

        log({
          skipped: true,
          reason: 'NO_INTERNET',
          networkStatus,
        });

        return;
      }

      const result = await runDevSyncSimulation({
        limit: 100,
        forceFail: false,
      });

      Alert.alert(
        'OK',
        `Sync con internet simulado. Success: ${result.success}. Failed: ${result.failed}.`
      );

      log({
        networkStatus,
        syncResult: result,
      });
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudo ejecutar sync condicionado por red.');
      log(error);
    }
  }

  async function runAutoSyncOnceFromButton() {
    try {
      const result = await runAutoSyncOnce();

      Alert.alert(
        'OK',
        result
          ? `Auto-sync ejecutado. Success: ${result.success}. Failed: ${result.failed}.`
          : 'Auto-sync no se ejecutó. Revisa salida.'
      );

      log({
        autoSyncState: getAutoSyncState(),
        result,
      });
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudo ejecutar auto-sync.');
      log(error);
    }
  }

  function startAutoSyncFromButton() {
    const unsubscribe = addAutoSyncListener((event) => {
      setAutoSyncEvents((current) => [event, ...current].slice(0, 10));
    });

    startAutoSyncOnNetworkReconnect();

    Alert.alert('OK', 'Auto-sync por reconexión iniciado.');

    log({
      autoSyncState: getAutoSyncState(),
      note: 'Listener attached for this test screen.',
      unsubscribeAvailable: typeof unsubscribe === 'function',
    });
  }

  function stopAutoSyncFromButton() {
    stopAutoSyncOnNetworkReconnect();

    Alert.alert('OK', 'Auto-sync detenido.');

    log({
      autoSyncState: getAutoSyncState(),
    });
  }

  function showAutoSyncStateFromButton() {
    log({
      autoSyncState: getAutoSyncState(),
      recentEvents: autoSyncEvents,
    });
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>RAYZATECH DB TEST</Text>

      <Text style={styles.subtitle}>
        Pantalla técnica temporal para probar SQLite offline.
      </Text>

      <View style={styles.buttonGroup}>
        <Button title="1. Crear tarea local" onPress={createTestTask} />
        <Button title="2. Ver tarea" onPress={showTask} />
        <Button title="3. Listar tareas" onPress={showAllTasks} />
        <Button title="4. Marcar INICIADA offline" onPress={markInProgress} />
        <Button title="5. Marcar COMPLETADA offline" onPress={markCompleted} />
        <Button title="6. Ver contadores / sync pendiente" onPress={showCounters} />

        <Button title="7. Crear series de prueba" onPress={createTestSeries} />
        <Button title="8. Ver series" onPress={showSeries} />
        <Button title="9. Recuperar primera serie" onPress={recoverFirstSeries} />
        <Button title="10. Contadores de series" onPress={showSeriesCounters} />

        <Button title="11. Crear evidencia simulada" onPress={createFakeEvidence} />
        <Button title="12. Ver evidencias" onPress={showEvidences} />
        <Button title="13. Contadores de evidencias" onPress={showEvidenceCounters} />

        <Button title="14. Capturar GPS real" onPress={captureGpsPoint} />
        <Button title="15. Ver GPS capturados" onPress={showGpsPoints} />
        <Button title="16. Contadores GPS" onPress={showGpsCounters} />

        <Button title="17. Ver cola pendiente" onPress={showPendingSyncQueue} />
        <Button title="18. Simular sync exitoso" onPress={simulateSuccessfulSync} />
        <Button title="19. Simular sync fallido" onPress={simulateFailedSync} />
        <Button title="20. Limpiar items sincronizados" onPress={clearSyncedItems} />

        <Button title="21. Ver estado de red" onPress={showNetworkStatus} />
        <Button title="22. Sync solo si hay internet" onPress={syncOnlyIfOnline} />

        <Button title="23. Ejecutar auto-sync una vez" onPress={runAutoSyncOnceFromButton} />
        <Button title="24. Iniciar auto-sync por reconexión" onPress={startAutoSyncFromButton} />
        <Button title="25. Detener auto-sync" onPress={stopAutoSyncFromButton} />
        <Button title="26. Ver estado auto-sync" onPress={showAutoSyncStateFromButton} />
      </View>

      <Text style={styles.outputTitle}>Salida:</Text>

      <Text selectable style={styles.output}>
        {output}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 16,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.7,
  },
  buttonGroup: {
    gap: 12,
  },
  outputTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 16,
  },
  output: {
    fontFamily: 'monospace',
    fontSize: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
  },
});