// src/app/dev-task-management-test.tsx

import { router, type Href } from 'expo-router';
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
    createRescheduledManagementOffline,
    createSuccessfulManagementOffline,
    createUnsuccessfulManagementOffline,
    listManagementHistoryForTask,
} from '@/application/tasks/taskManagement.service';
import { getTaskDetailSnapshot } from '@/application/tasks/taskQuery.service';
import { getSyncQueueCounters } from '@/infrastructure/db/repositories/syncQueueRepository';
import {
    getDevOperationalDataCounts,
    resetDevOperationalData,
} from '@/infrastructure/dev/devDataReset';
import {
    getPendingSyncPreview,
    runDevSyncSimulation,
} from '@/sync/syncEngine';

const TASK_ID = 'task_remote_task_001';

export default function DevTaskManagementTestScreen() {
  const [output, setOutput] = useState<string>(
    'Esperando prueba de gestiones...'
  );

  function log(value: unknown) {
    setOutput(JSON.stringify(value, null, 2));
  }

  async function handleError(error: unknown) {
    const fieldError = classifyFieldError(error);

    console.error(error);

    await appLogger.error({
      scope: 'DEV_TASK_MANAGEMENT_TEST',
      message: fieldError.message,
      error,
      taskId: TASK_ID,
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

  async function resetData() {
    try {
      const result = await resetDevOperationalData();

      Alert.alert('OK', 'Datos DEV limpiados.');
      log(result);
    } catch (error) {
      await handleError(error);
    }
  }

  async function downloadTasks() {
    try {
      const result = await downloadDevTasksToLocalCache();

      Alert.alert(
        'OK',
        `Tareas descargadas. Recibidas: ${result.remoteTasksReceived}.`
      );

      log(result);
    } catch (error) {
      await handleError(error);
    }
  }

  async function createSuccessfulManagement() {
    try {
      const result = await createSuccessfulManagementOffline({
        taskId: TASK_ID,
        observation: 'Gestión exitosa creada desde prueba DEV.',
        latitude: -12.046374,
        longitude: -77.042793,
        accuracy: 15,
        mocked: false,
        managedBy: 'dev_agent_001',
      });

      Alert.alert('OK', 'Gestión exitosa creada.');
      log(result);
    } catch (error) {
      await handleError(error);
    }
  }

  async function createUnsuccessfulManagement() {
    try {
      const result = await createUnsuccessfulManagementOffline({
        taskId: TASK_ID,
        reason: 'Cliente ausente',
        observation: 'Cliente no se encontró en domicilio.',
        latitude: -12.046374,
        longitude: -77.042793,
        accuracy: 18,
        mocked: false,
        managedBy: 'dev_agent_001',
      });

      Alert.alert('OK', 'Gestión no exitosa creada.');
      log(result);
    } catch (error) {
      await handleError(error);
    }
  }

  async function createRescheduledManagement() {
    try {
      const result = await createRescheduledManagementOffline({
        taskId: TASK_ID,
        reason: 'Cliente solicita reprogramación',
        observation: 'Cliente solicita visita en otro horario.',
        latitude: -12.046374,
        longitude: -77.042793,
        accuracy: 20,
        mocked: false,
        generalEvidenceId: undefined,
        rescheduleDate: '2026-06-01',
        rescheduleTimeRange: '09:00 - 13:00',
        managedBy: 'dev_agent_001',
      });

      Alert.alert('OK', 'Gestión reprogramada creada.');
      log(result);
    } catch (error) {
      await handleError(error);
    }
  }

  async function listHistory() {
    try {
      const history = await listManagementHistoryForTask(TASK_ID);
      const snapshot = await getTaskDetailSnapshot(TASK_ID);

      log({
        history,
        managementCounters: snapshot.managementCounters,
        managementHistory: snapshot.managementHistory,
        task: snapshot.task,
      });
    } catch (error) {
      await handleError(error);
    }
  }

  async function showSyncQueue() {
    try {
      const counters = await getSyncQueueCounters();
      const preview = await getPendingSyncPreview(100);

      log({
        counters,
        preview,
      });
    } catch (error) {
      await handleError(error);
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
        `Sync ejecutado. Success: ${result.success}. Finalized: ${result.finalized}.`
      );

      log(result);
    } catch (error) {
      await handleError(error);
    }
  }

  async function showDevCounts() {
    try {
      const counts = await getDevOperationalDataCounts();
      log(counts);
    } catch (error) {
      await handleError(error);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>RAYZATECH TASK MANAGEMENT TEST</Text>

      <Text style={styles.subtitle}>
        Prueba técnica del historial de gestiones por tarea.
      </Text>

      <View style={styles.box}>
        <Text style={styles.boxTitle}>Task ID de prueba</Text>
        <Text selectable style={styles.mono}>
          {TASK_ID}
        </Text>
        <Text style={styles.smallText}>
          Primero descarga tareas DEV para que exista esta tarea local.
        </Text>
      </View>

      <View style={styles.buttonGroup}>
        <Button title="1. Resetear datos DEV" onPress={resetData} />
        <Button title="2. Descargar tareas DEV" onPress={downloadTasks} />
        <Button
          title="3. Crear gestión exitosa"
          onPress={createSuccessfulManagement}
        />
        <Button
          title="4. Crear gestión no exitosa"
          onPress={createUnsuccessfulManagement}
        />
        <Button
          title="5. Crear gestión reprogramada"
          onPress={createRescheduledManagement}
        />
        <Button title="6. Ver historial" onPress={listHistory} />
        <Button title="7. Ver cola sync" onPress={showSyncQueue} />
        <Button title="8. Ejecutar sync DEV exitoso" onPress={runSuccessfulSync} />
        <Button title="9. Ver historial" onPress={listHistory} />
        <Button title="10. Ver conteo DEV" onPress={showDevCounts} />
        <Button
        title="Inicio"
        onPress={() => router.push('/agent-dashboard' as unknown as Href)}
        />
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
    fontWeight: '900',
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.75,
    lineHeight: 20,
  },
  box: {
    padding: 14,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    backgroundColor: '#fff',
    gap: 6,
  },
  boxTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  mono: {
    fontFamily: 'monospace',
    fontSize: 12,
  },
  smallText: {
    fontSize: 12,
    opacity: 0.75,
    lineHeight: 17,
  },
  buttonGroup: {
    gap: 10,
  },
  outputTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginTop: 12,
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