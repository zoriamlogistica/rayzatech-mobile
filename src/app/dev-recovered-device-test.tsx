// src/app/dev-recovered-device-test.tsx

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
import {
  addRecoveredDeviceOffline,
  getMaxRecoveredDevicesPerTask,
  getRecoveredDeviceCountersForTask,
  listRecoveredDevicesForTask,
  removeRecoveredDeviceOffline,
  updateRecoveredDeviceOffline,
} from '@/application/tasks/recoveredDevice.service';
import { downloadDevTasksToLocalCache } from '@/application/tasks/taskDownload.service';
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

export default function DevRecoveredDeviceTestScreen() {
  const [output, setOutput] = useState<string>(
    'Esperando prueba de equipos recuperados...'
  );
  const [lastDeviceId, setLastDeviceId] = useState<string | null>(null);

  function log(value: unknown) {
    setOutput(JSON.stringify(value, null, 2));
  }

  async function handleError(error: unknown) {
    const fieldError = classifyFieldError(error);

    console.error(error);

    await appLogger.error({
      scope: 'DEV_RECOVERED_DEVICE_TEST',
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

      setLastDeviceId(null);

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

  async function addDevice() {
    try {
      const result = await addRecoveredDeviceOffline({
        taskId: TASK_ID,
        serialNumber: `SERIE-REC-${Date.now()}`,
        deviceType: 'modem',        
        hasCharger: true,
        hasRemoteControl: false,
        hasPowerSupply: true,
        hasNetworkCable: false,
        hasOtherAccessory: false,
        deviceObservation: 'Equipo registrado desde prueba DEV.',
      });

      setLastDeviceId(result.device.id);

      Alert.alert('OK', 'Equipo recuperado agregado.');
      log(result);
    } catch (error) {
      await handleError(error);
    }
  }

  async function updateLastDevice() {
    try {
      if (!lastDeviceId) {
        Alert.alert('Sin equipo', 'Primero agrega un equipo recuperado.');
        return;
      }

      const result = await updateRecoveredDeviceOffline({
        id: lastDeviceId,
        condition: 'incomplete',
        hasRemoteControl: true,
        hasNetworkCable: true,
        deviceObservation:
          'Equipo actualizado: se añadió control y cable de red.',
      });

      Alert.alert('OK', 'Equipo recuperado actualizado.');
      log(result);
    } catch (error) {
      await handleError(error);
    }
  }

  async function removeLastDevice() {
    try {
      if (!lastDeviceId) {
        Alert.alert('Sin equipo', 'Primero agrega un equipo recuperado.');
        return;
      }

      const result = await removeRecoveredDeviceOffline(lastDeviceId);

      setLastDeviceId(null);

      Alert.alert('OK', 'Equipo recuperado eliminado.');
      log(result);
    } catch (error) {
      await handleError(error);
    }
  }

  async function listDevices() {
    try {
      const devices = await listRecoveredDevicesForTask(TASK_ID);
      const counters = await getRecoveredDeviceCountersForTask(TASK_ID);
      const maxAllowed = getMaxRecoveredDevicesPerTask();

      log({
        taskId: TASK_ID,
        maxAllowed,
        counters,
        devices,
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
      <Text style={styles.title}>RAYZATECH RECOVERED DEVICE TEST</Text>

      <Text style={styles.subtitle}>
        Prueba técnica de equipos recuperados reales registrados en campo.
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
        <Button title="3. Agregar equipo recuperado" onPress={addDevice} />
        <Button title="4. Actualizar último equipo" onPress={updateLastDevice} />
        <Button title="5. Listar equipos recuperados" onPress={listDevices} />
        <Button title="6. Ver cola sync" onPress={showSyncQueue} />
        <Button title="7. Ejecutar sync DEV exitoso" onPress={runSuccessfulSync} />
        <Button title="8. Listar equipos recuperados" onPress={listDevices} />
        <Button title="9. Eliminar último equipo" onPress={removeLastDevice} />
        <Button title="10. Ver conteo DEV" onPress={showDevCounts} />
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