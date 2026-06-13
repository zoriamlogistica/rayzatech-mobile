// src/app/dev-task-query-test.tsx

import { useState } from 'react';
import {
    Alert,
    Button,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { downloadDevTasksToLocalCache } from '@/application/tasks/taskDownload.service';
import {
    getAgentTaskSummary,
    getTaskDetailSnapshot,
    listCachedTasks,
    listInProgressCachedTasks,
    listPendingCachedTasks,
    listTodayCachedTasks,
    searchCachedTasks,
} from '@/application/tasks/taskQuery.service';
import {
    getDevOperationalDataCounts,
    resetDevOperationalData,
} from '@/infrastructure/dev/devDataReset';

const REMOTE_TASK_ID_1 = 'task_remote_task_001';
const REMOTE_TASK_ID_2 = 'task_remote_task_002';

export default function DevTaskQueryTestScreen() {
  const [output, setOutput] = useState<string>(
    'Esperando prueba de consultas locales...'
  );

  function log(value: unknown) {
    setOutput(JSON.stringify(value, null, 2));
  }

  async function seedDownloadTasks() {
    try {
      const result = await downloadDevTasksToLocalCache();

      Alert.alert(
        'OK',
        `Tareas descargadas. Recibidas: ${result.remoteTasksReceived}. Insertadas: ${result.inserted}. Actualizadas: ${result.updated}.`
      );

      log(result);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudieron descargar tareas.');
      log(error);
    }
  }

  async function showAllCachedTasks() {
    try {
      const tasks = await listCachedTasks();

      log({
        total: tasks.length,
        tasks,
      });
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudieron listar tareas.');
      log(error);
    }
  }

  async function showTodayTasks() {
    try {
      const tasks = await listTodayCachedTasks();

      log({
        total: tasks.length,
        tasks,
      });
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudieron listar tareas de hoy.');
      log(error);
    }
  }

  async function showPendingTasks() {
    try {
      const tasks = await listPendingCachedTasks();

      log({
        total: tasks.length,
        tasks,
      });
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudieron listar pendientes.');
      log(error);
    }
  }

  async function showInProgressTasks() {
    try {
      const tasks = await listInProgressCachedTasks();

      log({
        total: tasks.length,
        tasks,
      });
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudieron listar en progreso.');
      log(error);
    }
  }

  async function searchByCustomer() {
    try {
      const tasks = await searchCachedTasks('Cliente Descarga');

      log({
        search: 'Cliente Descarga',
        total: tasks.length,
        tasks,
      });
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudo buscar por cliente.');
      log(error);
    }
  }

  async function searchByDistrict() {
    try {
      const tasks = await searchCachedTasks('Surco');

      log({
        search: 'Surco',
        total: tasks.length,
        tasks,
      });
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudo buscar por distrito.');
      log(error);
    }
  }

  async function showTaskOneDetail() {
    try {
      const snapshot = await getTaskDetailSnapshot(REMOTE_TASK_ID_1);
      log(snapshot);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudo ver detalle tarea 1.');
      log(error);
    }
  }

  async function showTaskTwoDetail() {
    try {
      const snapshot = await getTaskDetailSnapshot(REMOTE_TASK_ID_2);
      log(snapshot);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudo ver detalle tarea 2.');
      log(error);
    }
  }

  async function showAgentSummary() {
    try {
      const summary = await getAgentTaskSummary();
      log(summary);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudo obtener resumen.');
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

      Alert.alert('OK', 'Datos DEV limpiados.');
      log(result);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudieron limpiar datos DEV.');
      log(error);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>RAYZATECH TASK QUERY TEST</Text>

      <Text style={styles.subtitle}>
        Prueba técnica de consultas locales para futura UI de tareas.
      </Text>

      <View style={styles.buttonGroup}>
        <Button title="1. Descargar tareas DEV" onPress={seedDownloadTasks} />
        <Button title="2. Listar todas cacheadas" onPress={showAllCachedTasks} />
        <Button title="3. Listar tareas de hoy" onPress={showTodayTasks} />
        <Button title="4. Listar pendientes" onPress={showPendingTasks} />
        <Button title="5. Listar en progreso" onPress={showInProgressTasks} />
        <Button title="6. Buscar por cliente" onPress={searchByCustomer} />
        <Button title="7. Buscar por distrito Surco" onPress={searchByDistrict} />
        <Button title="8. Ver detalle tarea 1" onPress={showTaskOneDetail} />
        <Button title="9. Ver detalle tarea 2" onPress={showTaskTwoDetail} />
        <Button title="10. Ver resumen agente" onPress={showAgentSummary} />
        <Button title="11. Ver conteo DEV" onPress={showDevCounts} />
        <Button title="12. Resetear datos DEV" onPress={resetDevData} />
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