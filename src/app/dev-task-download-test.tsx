// src/app/dev-task-download-test.tsx

import { useState } from 'react';
import {
    Alert,
    Button,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { resolveTaskConflictKeepLocal } from '@/application/tasks/taskConflict.service';
import { downloadDevTasksToLocalCache } from '@/application/tasks/taskDownload.service';
import { countPendingSyncItems } from '@/infrastructure/db/repositories/syncQueueRepository';
import { listTaskEvents } from '@/infrastructure/db/repositories/taskEventRepository';
import {
    countTasksByStatus,
    getTaskById,
    listTasks,
    updateTaskStatus,
} from '@/infrastructure/db/repositories/taskRepository';
import { listTaskSeries } from '@/infrastructure/db/repositories/taskSeriesRepository';
import {
    getDevOperationalDataCounts,
    resetDevOperationalData,
} from '@/infrastructure/dev/devDataReset';

const REMOTE_TASK_ID_1 = 'task_remote_task_001';
const REMOTE_TASK_ID_2 = 'task_remote_task_002';

export default function DevTaskDownloadTestScreen() {
  const [output, setOutput] = useState<string>('Esperando prueba de descarga...');

  function log(value: unknown) {
    setOutput(JSON.stringify(value, null, 2));
  }

  async function downloadTasks() {
    try {
      const result = await downloadDevTasksToLocalCache();

      Alert.alert(
        'OK',
        `Descarga DEV finalizada. Recibidas: ${result.remoteTasksReceived}. Insertadas: ${result.inserted}. Actualizadas: ${result.updated}. Omitidas: ${result.skippedDirty}. Conflictos: ${result.conflictsRegistered}. Series: ${result.seriesDownloaded}.`
      );

      log(result);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudieron descargar tareas DEV.');
      log(error);
    }
  }

  async function showCachedTasks() {
    try {
      const tasks = await listTasks();
      const counters = await countTasksByStatus();
      const pendingSyncItems = await countPendingSyncItems();

      log({
        total: tasks.length,
        tasks,
        counters,
        pendingSyncItems,
      });
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudieron listar tareas cacheadas.');
      log(error);
    }
  }

  async function showFirstTaskDetail() {
    try {
      const task = await getTaskById(REMOTE_TASK_ID_1);
      const series = await listTaskSeries(REMOTE_TASK_ID_1);
      const events = await listTaskEvents(REMOTE_TASK_ID_1);

      log({
        task,
        series,
        events,
      });
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudo mostrar detalle de la primera tarea.');
      log(error);
    }
  }

  async function showSecondTaskDetail() {
    try {
      const task = await getTaskById(REMOTE_TASK_ID_2);
      const series = await listTaskSeries(REMOTE_TASK_ID_2);
      const events = await listTaskEvents(REMOTE_TASK_ID_2);

      log({
        task,
        series,
        events,
      });
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudo mostrar detalle de la segunda tarea.');
      log(error);
    }
  }

  async function dirtyFirstTask() {
    try {
      const task = await getTaskById(REMOTE_TASK_ID_1);

      if (!task) {
        Alert.alert('Sin tarea', 'Primero descarga las tareas DEV.');
        log({
          error: 'TASK_NOT_FOUND',
          taskId: REMOTE_TASK_ID_1,
        });
        return;
      }

      await updateTaskStatus({
        taskId: REMOTE_TASK_ID_1,
        nextStatus: 'in_progress',
        syncStatus: 'pending_sync',
      });

      const updatedTask = await getTaskById(REMOTE_TASK_ID_1);

      Alert.alert(
        'OK',
        'Tarea 1 ensuciada localmente. Ahora una nueva descarga debe omitirla.'
      );

      log({
        before: task,
        after: updatedTask,
        expectedNextDownload: {
          skippedDirty: 1,
          conflictsRegistered: 1,
        },
      });
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudo ensuciar la tarea 1.');
      log(error);
    }
  }

  async function resolveFirstTaskConflict() {
    try {
      const result = await resolveTaskConflictKeepLocal(REMOTE_TASK_ID_1);

      Alert.alert('OK', 'Conflicto resuelto conservando cambios locales.');
      log(result);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudo resolver conflicto.');
      log(error);
    }
  }

  async function showDevCounts() {
    try {
      const counts = await getDevOperationalDataCounts();
      log(counts);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudo obtener conteo DEV.');
      log(error);
    }
  }

  async function resetDevData() {
    try {
      const result = await resetDevOperationalData();

      Alert.alert('OK', 'Datos DEV limpiados correctamente.');
      log(result);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudieron limpiar datos DEV.');
      log(error);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>RAYZATECH TASK DOWNLOAD TEST</Text>

      <Text style={styles.subtitle}>
        Prueba técnica de descarga, cache local, conflictos y resolución offline.
      </Text>

      <View style={styles.buttonGroup}>
        <Button title="1. Descargar tareas DEV" onPress={downloadTasks} />
        <Button title="2. Ver tareas cacheadas" onPress={showCachedTasks} />
        <Button title="3. Ver detalle tarea 1" onPress={showFirstTaskDetail} />
        <Button title="4. Ver detalle tarea 2" onPress={showSecondTaskDetail} />
        <Button title="5. Ver conteo DEV" onPress={showDevCounts} />
        <Button title="6. Resetear datos DEV" onPress={resetDevData} />
        <Button title="7. Ensuciar tarea 1 localmente" onPress={dirtyFirstTask} />
        <Button title="8. Resolver conflicto tarea 1 KEEP LOCAL" onPress={resolveFirstTaskConflict} />
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