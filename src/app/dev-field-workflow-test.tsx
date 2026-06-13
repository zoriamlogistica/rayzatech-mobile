// src/app/dev-field-workflow-test.tsx

import { useState } from 'react';
import {
  Alert,
  Button,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { classifyFieldError } from '@/application/errors/fieldError.service';
import { appLogger } from '@/application/logging/appLogger.service';
import { downloadDevTasksToLocalCache } from '@/application/tasks/taskDownload.service';
import {
  captureFakeEvidenceForTaskOffline,
  completeTaskOffline,
  markSeriesNotRecoveredOffline,
  recoverSeriesOffline,
  startTaskOffline,
} from '@/application/tasks/taskOperations.service';
import {
  getAgentTaskSummary,
  getTaskDetailSnapshot,
} from '@/application/tasks/taskQuery.service';
import {
  countPendingSyncItems,
  getSyncQueueCounters,
} from '@/infrastructure/db/repositories/syncQueueRepository';
import {
  getDevOperationalDataCounts,
  resetDevOperationalData,
} from '@/infrastructure/dev/devDataReset';
import { uploadPendingEvidencesDev } from '@/infrastructure/upload/evidenceUploadService';
import {
  clearDevSuccessfulSyncItems,
  getPendingSyncPreview,
  runDevSyncSimulation,
} from '@/sync/syncEngine';

const FIELD_TASK_ID = 'task_remote_task_001';
const FIELD_SERIES_ID_1 = 'series_remote_series_001';
const FIELD_SERIES_ID_2 = 'series_remote_series_002';

export default function DevFieldWorkflowTestScreen() {
  const [output, setOutput] = useState<string>(
    'Esperando prueba de flujo real de campo...'
  );

  function log(value: unknown) {
    setOutput(JSON.stringify(value, null, 2));
  }

  async function handleFieldError(error: unknown) {
    const fieldError = classifyFieldError(error);

    console.error(error);

    await appLogger.error({
      scope: 'FIELD_WORKFLOW_TEST',
      message: fieldError.message,
      error,
      payload: {
        fieldError,
      },
      taskId: FIELD_TASK_ID,
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

  async function resetAllDevData() {
    try {
      const result = await resetDevOperationalData();

      Alert.alert('OK', 'Datos DEV limpiados.');
      log(result);
    } catch (error) {
      await handleFieldError(error);
    }
  }

  async function downloadTasks() {
    try {
      const result = await downloadDevTasksToLocalCache();

      Alert.alert(
        'OK',
        `Descarga finalizada. Recibidas: ${result.remoteTasksReceived}. Insertadas: ${result.inserted}. Actualizadas: ${result.updated}.`
      );

      log(result);
    } catch (error) {
      await handleFieldError(error);
    }
  }

  async function showFieldTaskSnapshot() {
    try {
      const snapshot = await getTaskDetailSnapshot(FIELD_TASK_ID);
      log(snapshot);
    } catch (error) {
      await handleFieldError(error);
    }
  }

  async function startDownloadedTask() {
    try {
      const result = await startTaskOffline(FIELD_TASK_ID);

      Alert.alert('OK', 'Tarea descargada iniciada offline.');
      log(result);
    } catch (error) {
      await handleFieldError(error);
    }
  }

  async function recoverFirstSeries() {
    try {
      const result = await recoverSeriesOffline({
        taskId: FIELD_TASK_ID,
        seriesId: FIELD_SERIES_ID_1,
        serialNumber: 'DEV-MODEM-000001',        
        observation: 'Serie recuperada desde flujo real de campo.',
      });

      Alert.alert('OK', 'Primera serie recuperada.');
      log(result);
    } catch (error) {
      await handleFieldError(error);
    }
  }

  async function markSecondSeriesNotRecovered() {
    try {
      const result = await markSeriesNotRecoveredOffline({
        taskId: FIELD_TASK_ID,
        seriesId: FIELD_SERIES_ID_2,
        serialNumber: 'DEV-DECO-000001',
        reason: 'not_found',
        observation: 'Serie no encontrada durante flujo real de campo.',
      });

      Alert.alert('OK', 'Segunda serie marcada como no recuperada.');
      log(result);
    } catch (error) {
      await handleFieldError(error);
    }
  }

  async function captureEvidence() {
    try {
      const result = await captureFakeEvidenceForTaskOffline({
        taskId: FIELD_TASK_ID,
        evidenceType: 'recovery_proof',
      });

      Alert.alert('OK', 'Evidencia capturada.');
      log(result);
    } catch (error) {
      await handleFieldError(error);
    }
  }

  async function uploadEvidence() {
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

  async function completeDownloadedTask() {
    try {
      const result = await completeTaskOffline(FIELD_TASK_ID);

      Alert.alert('OK', 'Tarea descargada completada offline.');
      log(result);
    } catch (error) {
      await handleFieldError(error);
    }
  }

  async function showAgentSummary() {
    try {
      const summary = await getAgentTaskSummary();
      log(summary);
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

  async function showPendingSyncQueue() {
  try {
    const pendingItems = await getPendingSyncPreview(100);
    const pendingCount = await countPendingSyncItems();
    const counters = await getSyncQueueCounters();

    log({
      pendingCount,
      counters,
      totalPreview: pendingItems.length,
      items: pendingItems,
    });
  } catch (error) {
    await handleFieldError(error);
  }
}

  async function runSuccessfulSync() {
    try {
      const result = await runDevSyncSimulation({
        limit: 100,
        forceFail: false,
      });

      Alert.alert(
        'OK',
        `Sync DEV exitoso. Success: ${result.success}. Failed: ${result.failed}. Remaining: ${result.remainingPending}.`
      );

      log(result);
    } catch (error) {
      await handleFieldError(error);
    }
  }

  async function runFailedSync() {
    try {
      const result = await runDevSyncSimulation({
        limit: 100,
        forceFail: true,
      });

      Alert.alert(
        'OK',
        `Sync DEV fallido simulado. Failed: ${result.failed}. Remaining: ${result.remainingPending}.`
      );

      log(result);
    } catch (error) {
      await handleFieldError(error);
    }
  }

  async function clearSuccessfulSync() {
    try {
      await clearDevSuccessfulSyncItems();

      const pendingSyncItems = await countPendingSyncItems();

      Alert.alert('OK', 'Items sincronizados exitosamente limpiados.');

      log({
        clearedSuccessfulSyncItems: true,
        pendingSyncItems,
      });
    } catch (error) {
      await handleFieldError(error);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>RAYZATECH FIELD WORKFLOW TEST</Text>

      <Text style={styles.subtitle}>
        Prueba técnica de flujo real usando tarea descargada, cacheada, operada offline y sincronizada.
      </Text>

      <View style={styles.buttonGroup}>
        <Button title="1. Resetear datos DEV" onPress={resetAllDevData} />
        <Button title="2. Descargar tareas DEV" onPress={downloadTasks} />
        <Button title="3. Ver snapshot tarea descargada 1" onPress={showFieldTaskSnapshot} />
        <Button title="4. Iniciar tarea descargada offline" onPress={startDownloadedTask} />
        <Button title="5. Recuperar primera serie" onPress={recoverFirstSeries} />
        <Button title="6. Marcar segunda serie no recuperada" onPress={markSecondSeriesNotRecovered} />
        <Button title="7. Capturar evidencia" onPress={captureEvidence} />
        <Button title="8. Subir evidencias pendientes DEV" onPress={uploadEvidence} />
        <Button title="9. Completar tarea descargada" onPress={completeDownloadedTask} />
        <Button title="10. Ver resumen agente" onPress={showAgentSummary} />
        <Button title="11. Ver conteo DEV" onPress={showDevCounts} />

        <Button title="12. Ver cola sync pendiente" onPress={showPendingSyncQueue} />
        <Button title="13. Ejecutar sync DEV exitoso" onPress={runSuccessfulSync} />
        <Button title="14. Ejecutar sync DEV fallido" onPress={runFailedSync} />
        <Button title="15. Limpiar sync exitosos" onPress={clearSuccessfulSync} />
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