// src/app/dev-log-test.tsx

import { useState } from 'react';
import {
    Alert,
    Button,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import { appLogger } from '@/application/logging/appLogger.service';
import {
    clearLocalLogs,
    countLocalLogs,
    listLocalLogs,
    listLocalLogsByLevel,
} from '@/infrastructure/db/repositories/localLogRepository';

export default function DevLogTestScreen() {
  const [output, setOutput] = useState<string>('Esperando prueba de logs...');

  function log(value: unknown) {
    setOutput(JSON.stringify(value, null, 2));
  }

  async function createInfoLog() {
    try {
      await appLogger.info({
        scope: 'DEV_LOG_TEST',
        message: 'Log informativo de prueba creado correctamente.',
        payload: {
          module: 'dev-log-test',
          action: 'createInfoLog',
        },
      });

      Alert.alert('OK', 'Log info creado.');
      await showLogCounts();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudo crear log info.');
      log(error);
    }
  }

  async function createWarnLog() {
    try {
      await appLogger.warn({
        scope: 'DEV_LOG_TEST',
        message: 'Log warning de prueba.',
        payload: {
          module: 'dev-log-test',
          action: 'createWarnLog',
          warningCode: 'DEV_WARNING',
        },
      });

      Alert.alert('OK', 'Log warning creado.');
      await showLogCounts();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudo crear log warning.');
      log(error);
    }
  }

  async function createErrorLog() {
    try {
      const fakeError = new Error('Error simulado para auditoría local.');

      await appLogger.error({
        scope: 'DEV_LOG_TEST',
        message: 'Log error de prueba.',
        error: fakeError,
        payload: {
          module: 'dev-log-test',
          action: 'createErrorLog',
          errorCode: 'DEV_ERROR_SIMULATED',
        },
      });

      Alert.alert('OK', 'Log error creado.');
      await showLogCounts();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudo crear log error.');
      log(error);
    }
  }

  async function showRecentLogs() {
    try {
      const logs = await listLocalLogs(50);
      log({
        total: logs.length,
        logs,
      });
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudieron listar logs.');
      log(error);
    }
  }

  async function showErrorLogs() {
    try {
      const logs = await listLocalLogsByLevel('error', 50);
      log({
        total: logs.length,
        logs,
      });
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudieron listar errores.');
      log(error);
    }
  }

  async function showLogCounts() {
    try {
      const counts = await countLocalLogs();
      log(counts);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudo contar logs.');
      log(error);
    }
  }

  async function clearLogs() {
    try {
      await clearLocalLogs();

      Alert.alert('OK', 'Logs locales limpiados.');
      await showLogCounts();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudieron limpiar logs.');
      log(error);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>RAYZATECH LOG TEST</Text>

      <Text style={styles.subtitle}>
        Prueba técnica de logs locales para auditoría offline.
      </Text>

      <View style={styles.buttonGroup}>
        <Button title="1. Crear log INFO" onPress={createInfoLog} />
        <Button title="2. Crear log WARN" onPress={createWarnLog} />
        <Button title="3. Crear log ERROR" onPress={createErrorLog} />
        <Button title="4. Ver logs recientes" onPress={showRecentLogs} />
        <Button title="5. Ver logs ERROR" onPress={showErrorLogs} />
        <Button title="6. Ver conteo de logs" onPress={showLogCounts} />
        <Button title="7. Limpiar logs" onPress={clearLogs} />
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