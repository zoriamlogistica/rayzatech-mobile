// src/app/dev-task-management-workflow-test.tsx

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
  createRescheduledManagementWorkflowOffline,
  createSuccessfulManagementWorkflowOffline,
  createUnsuccessfulManagementWorkflowOffline,
} from '@/application/tasks/taskManagementWorkflow.service';
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

export default function DevTaskManagementWorkflowTestScreen() {
  const [output, setOutput] = useState<string>(
    'Esperando prueba de workflow de gestión...'
  );

  function log(value: unknown) {
    setOutput(JSON.stringify(value, null, 2));
  }

  async function handleError(error: unknown) {
    const fieldError = classifyFieldError(error);

    console.error(error);

    await appLogger.error({
      scope: 'DEV_TASK_MANAGEMENT_WORKFLOW_TEST',
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

  async function createSuccessfulWorkflow() {
    try {
      const result = await createSuccessfulManagementWorkflowOffline({
        taskId: TASK_ID,
        observation:
          'Gestión exitosa workflow DEV con equipo recuperado y evidencias.',
        managedBy: 'dev_agent_001',
        captureGeneralEvidence: true,
        devices: [
          {
            serialNumber: `WF-SERIE-${Date.now()}`,
            deviceType: 'modem',            
            hasCharger: true,
            hasPowerSupply: true,
            hasRemoteControl: false,
            hasNetworkCable: false,
            hasOtherAccessory: false,
            deviceObservation: 'Equipo recuperado desde workflow DEV.',
            captureLabelEvidence: true,
          },
        ],
      });

      Alert.alert(
        'OK',
        `Gestión exitosa creada. Equipos: ${result.recoveredDevices.length}.`
      );

      log(result);
    } catch (error) {
      await handleError(error);
    }
  }

  async function createUnsuccessfulWorkflow() {
    try {
      const result = await createUnsuccessfulManagementWorkflowOffline({
        taskId: TASK_ID,
        reason: 'Cliente ausente',
        observation: 'Cliente ausente. Se registró fachada DEV.',
        managedBy: 'dev_agent_001',
        captureHouseFrontEvidence: true,
      });

      Alert.alert('OK', 'Gestión no exitosa workflow creada.');
      log(result);
    } catch (error) {
      await handleError(error);
    }
  }

  async function createRescheduledWorkflow() {
    try {
      const result = await createRescheduledManagementWorkflowOffline({
        taskId: TASK_ID,
        reason: 'Cliente solicita reprogramación',
        observation: 'Cliente solicita nueva visita.',
        rescheduleDate: '2026-06-01',
        rescheduleTimeRange: '09:00 - 13:00',
        managedBy: 'dev_agent_001',
        captureHouseFrontEvidence: true,
      });

      Alert.alert('OK', 'Gestión reprogramada workflow creada.');
      log(result);
    } catch (error) {
      await handleError(error);
    }
  }

  async function showSnapshot() {
    try {
      const snapshot = await getTaskDetailSnapshot(TASK_ID);

      log({
        task: snapshot.task,
        managementCounters: snapshot.managementCounters,
        managementHistory: snapshot.managementHistory,
        recoveredDeviceCounters: snapshot.recoveredDeviceCounters,
        recoveredDevices: snapshot.recoveredDevices,
        evidenceCounters: snapshot.evidenceCounters,
        gpsCounters: snapshot.gpsCounters,
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
      <Text style={styles.title}>RAYZATECH MANAGEMENT WORKFLOW TEST</Text>

      <Text style={styles.subtitle}>
        Prueba técnica del flujo real de gestión con GPS, evidencias, equipos e
        historial.
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
          title="3. Crear workflow exitoso"
          onPress={createSuccessfulWorkflow}
        />

        <Button
          title="4. Crear workflow no exitoso"
          onPress={createUnsuccessfulWorkflow}
        />

        <Button
          title="5. Crear workflow reprogramado"
          onPress={createRescheduledWorkflow}
        />

        <Button title="6. Ver snapshot/historial" onPress={showSnapshot} />
        <Button title="7. Ver cola sync" onPress={showSyncQueue} />
        <Button title="8. Ejecutar sync DEV exitoso" onPress={runSuccessfulSync} />
        <Button title="9. Ver snapshot/historial" onPress={showSnapshot} />
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