// src/app/dev-task-ops-test.tsx

import { classifyFieldError } from '@/application/errors/fieldError.service';
import {
  captureFakeEvidenceForTaskOffline,
  captureGpsForTaskOffline,
  completeTaskOffline,
  markSeriesNotRecoveredOffline,
  recoverSeriesOffline,
  startTaskOffline,
} from '@/application/tasks/taskOperations.service';
import type { Task } from '@/domain/tasks/task.types';
import type { TaskSeries } from '@/domain/tasks/taskSeries.types';
import {
  countEvidencesByTask,
  listEvidencesByTask,
} from '@/infrastructure/db/repositories/evidenceRepository';
import { countGpsPointsByTask } from '@/infrastructure/db/repositories/gpsRepository';
import { countPendingSyncItems } from '@/infrastructure/db/repositories/syncQueueRepository';
import { listTaskEvents } from '@/infrastructure/db/repositories/taskEventRepository';
import {
  countTasksByStatus,
  getTaskById,
  upsertTask,
} from '@/infrastructure/db/repositories/taskRepository';
import {
  countSeriesByTask,
  listTaskSeries,
  upsertTaskSeries,
} from '@/infrastructure/db/repositories/taskSeriesRepository';
import {
  getDevOperationalDataCounts,
  resetDevOperationalData,
} from '@/infrastructure/dev/devDataReset';
import { uploadPendingEvidencesDev } from '@/infrastructure/upload/evidenceUploadService';
import { useState } from 'react';

import { appLogger } from '@/application/logging/appLogger.service';
import {
  Alert,
  Button,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

function nowIso(): string {
  return new Date().toISOString();
}

const OPS_TASK_ID = 'ops_test_task_001';
const OPS_SERIES_ID_1 = 'ops_series_test_001';
const OPS_SERIES_ID_2 = 'ops_series_test_002';

export default function DevTaskOpsTestScreen() {
  const [output, setOutput] = useState<string>('Esperando prueba operativa...');

  function log(value: unknown) {
    setOutput(JSON.stringify(value, null, 2));
  }

  async function handleFieldError(error: unknown) {
  const fieldError = classifyFieldError(error);

  console.error(error);

  await appLogger.error({
    scope: 'TASK_OPS_SCREEN',
    message: fieldError.message,
    error,
    payload: {
      fieldError,
    },
  });

  Alert.alert(fieldError.title, fieldError.message);

  log({
    fieldError,
    originalError:
      error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : error,
  });
}

  async function seedOperationalTask() {
    try {
      const now = nowIso();

      const task: Task = {
        id: OPS_TASK_ID,
        taskNumber: 'OPS-TAREA-001',
        orderCode: 'OPS-ORD-001',
        project: 'RAYZATECH RECOVERY',
        sot: 'OPS-SOT-001',
        assignedUserId: 'agent_ops_001',

        customerName: 'Cliente Operativo de Prueba',
        customerDocument: '11111111',
        customerPhone: '988888888',

        department: 'Lima',
        province: 'Lima',
        district: 'Miraflores',
        address: 'Av. Operativa 456',
        reference: 'Referencia operativa de prueba',

        latitude: -12.121,
        longitude: -77.03,

        scheduledDate: now.slice(0, 10),
        timeRange: '10:00 - 14:00',

        taskType: 'recovery',
        priority: 'normal',

        status: 'pending',
        observations: 'Tarea seed para probar taskOperations.service.',

        version: 1,
        localUpdatedAt: now,

        syncStatus: 'pending_sync',
        isDirty: true,
        isLocked: false,

        createdAt: now,
        updatedAt: now,
      };

      await upsertTask(task);

      const seriesList: TaskSeries[] = [
        {
          id: OPS_SERIES_ID_1,
          taskId: OPS_TASK_ID,
          serialNumber: 'OPS-SN-000001',
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
          id: OPS_SERIES_ID_2,
          taskId: OPS_TASK_ID,
          serialNumber: 'OPS-SN-000002',
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

      Alert.alert('OK', 'Tarea operativa y series creadas.');
      await showOperationalSnapshot();
    } catch (error) {
      await handleFieldError(error);
    }
  }

  async function startOperationalTask() {
    try {
      const result = await startTaskOffline(OPS_TASK_ID);

      Alert.alert('OK', 'Tarea iniciada usando taskOperations.service.');
      log(result);
    } catch (error) {
      await handleFieldError(error);
    }
  }

  async function recoverFirstOperationalSeries() {
    try {
      const result = await recoverSeriesOffline({
        taskId: OPS_TASK_ID,
        seriesId: OPS_SERIES_ID_1,
        serialNumber: 'OPS-SN-000001',        
        observation: 'Serie recuperada desde servicio operativo.',
      });

      Alert.alert('OK', 'Serie recuperada usando taskOperations.service.');
      log(result);
    } catch (error) {
      await handleFieldError(error);
    }
  }

  async function markSecondSeriesNotRecovered() {
    try {
      const result = await markSeriesNotRecoveredOffline({
        taskId: OPS_TASK_ID,
        seriesId: OPS_SERIES_ID_2,
        serialNumber: 'OPS-SN-000002',
        reason: 'not_found',
        observation: 'Serie no encontrada durante prueba operativa.',
      });

      Alert.alert('OK', 'Serie marcada como no recuperada.');
      log(result);
    } catch (error) {
      await handleFieldError(error);
    }
  }

  async function captureOperationalEvidence() {
    try {
      const result = await captureFakeEvidenceForTaskOffline({
        taskId: OPS_TASK_ID,
        evidenceType: 'recovery_proof',
      });

      Alert.alert('OK', 'Evidencia operativa capturada.');
      log(result);
    } catch (error) {
      await handleFieldError(error);
    }
  }

  async function captureOperationalGps() {
    try {
      const result = await captureGpsForTaskOffline(OPS_TASK_ID);

      Alert.alert('OK', 'GPS capturado usando taskOperations.service.');
      log(result);
    } catch (error) {
      await handleFieldError(error);
    }
  }

  async function completeOperationalTask() {
    try {
      const result = await completeTaskOffline(OPS_TASK_ID);

      Alert.alert('OK', 'Tarea completada usando taskOperations.service.');
      log(result);
    } catch (error) {
      await handleFieldError(error);
    }
  }

  async function uploadPendingEvidences() {
    try {
      const result = await uploadPendingEvidencesDev({
        limit: 25,
      });

      Alert.alert(
        'OK',
        `Upload DEV finalizado. Uploaded: ${result.uploaded}. Failed: ${result.failed}.`
      );

      log(result);
    } catch (error) {
      await handleFieldError(error);
    }
  }

  async function showOperationalSnapshot() {
    try {
      const task = await getTaskById(OPS_TASK_ID);
      const series = await listTaskSeries(OPS_TASK_ID);
      const seriesCounters = await countSeriesByTask(OPS_TASK_ID);
      const gpsCounters = await countGpsPointsByTask(OPS_TASK_ID);
      const evidenceCounters = await countEvidencesByTask(OPS_TASK_ID);
      const evidences = await listEvidencesByTask(OPS_TASK_ID);
      const events = await listTaskEvents(OPS_TASK_ID);
      const taskCounters = await countTasksByStatus();
      const pendingSyncItems = await countPendingSyncItems();

      log({
        task,
        series,
        seriesCounters,
        gpsCounters,
        evidenceCounters,
        evidences,
        events,
        taskCounters,
        pendingSyncItems,
      });
    } catch (error) {
      await handleFieldError(error);
    }
  }

  async function showDevCounts() {
    try {
      const counts = await getDevOperationalDataCounts();
      log(counts);
    } catch (error) {
      await handleFieldError(error);
    }
  }

  async function resetDevData() {
    try {
      const result = await resetDevOperationalData();

      Alert.alert('OK', 'Datos DEV limpiados correctamente.');
      log(result);
    } catch (error) {
      await handleFieldError(error);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>RAYZATECH TASK OPS TEST</Text>

      <Text style={styles.subtitle}>
        Prueba técnica del servicio operativo offline con errores clasificados.
      </Text>

      <View style={styles.buttonGroup}>
        <Button title="1. Crear seed operativo" onPress={seedOperationalTask} />
        <Button title="2. Iniciar tarea offline" onPress={startOperationalTask} />
        <Button title="3. Recuperar primera serie" onPress={recoverFirstOperationalSeries} />
        <Button title="4. Marcar segunda serie no recuperada" onPress={markSecondSeriesNotRecovered} />
        <Button title="5. Capturar evidencia operativa" onPress={captureOperationalEvidence} />
        <Button title="6. Capturar GPS operativo" onPress={captureOperationalGps} />
        <Button title="7. Completar tarea offline" onPress={completeOperationalTask} />
        <Button title="8. Subir evidencias pendientes DEV" onPress={uploadPendingEvidences} />
        <Button title="9. Ver snapshot operativo" onPress={showOperationalSnapshot} />

        <Button title="10. Ver conteo DEV" onPress={showDevCounts} />
        <Button title="11. Resetear datos DEV" onPress={resetDevData} />
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