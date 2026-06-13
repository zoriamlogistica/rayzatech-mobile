// src/app/dev-field-error-test.tsx

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

export default function DevFieldErrorTestScreen() {
  const [output, setOutput] = useState<string>(
    'Esperando prueba de clasificación de errores...'
  );

  function log(value: unknown) {
    setOutput(JSON.stringify(value, null, 2));
  }

  function testEvidenceRequired() {
    const result = classifyFieldError(
      new Error('OPERATIONAL_RULE_FAILED:EVIDENCE_REQUIRED')
    );

    Alert.alert(result.title, result.message);
    log(result);
  }

  function testGpsRequired() {
    const result = classifyFieldError(
      new Error('OPERATIONAL_RULE_FAILED:GPS_REQUIRED')
    );

    Alert.alert(result.title, result.message);
    log(result);
  }

  function testPendingSeries() {
    const result = classifyFieldError(
      new Error('OPERATIONAL_RULE_FAILED:PENDING_SERIES:2')
    );

    Alert.alert(result.title, result.message);
    log(result);
  }

  function testLocationPermissionDenied() {
    const result = classifyFieldError(new Error('LOCATION_PERMISSION_DENIED'));

    Alert.alert(result.title, result.message);
    log(result);
  }

  function testAuthMissing() {
    const result = classifyFieldError(
      new Error('AUTH_SESSION_NOT_ALLOWED:missing')
    );

    Alert.alert(result.title, result.message);
    log(result);
  }

  function testEvidenceFileMissing() {
    const result = classifyFieldError(new Error('LOCAL_FILE_NOT_FOUND'));

    Alert.alert(result.title, result.message);
    log(result);
  }

  function testSyncFailure() {
    const result = classifyFieldError(new Error('DEV_SYNC_FORCED_FAILURE'));

    Alert.alert(result.title, result.message);
    log(result);
  }

  function testDatabaseError() {
    const result = classifyFieldError(
      new Error("NativeDatabase.prepareAsync rejected: no column named payload")
    );

    Alert.alert(result.title, result.message);
    log(result);
  }

  function testNetworkError() {
    const result = classifyFieldError(new Error('NO_INTERNET'));

    Alert.alert(result.title, result.message);
    log(result);
  }

  function testUnknownError() {
    const result = classifyFieldError(new Error('SOMETHING_RANDOM_FAILED'));

    Alert.alert(result.title, result.message);
    log(result);
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>RAYZATECH FIELD ERROR TEST</Text>

      <Text style={styles.subtitle}>
        Prueba técnica de clasificación de errores reales de campo.
      </Text>

      <View style={styles.buttonGroup}>
        <Button title="1. Error evidencia requerida" onPress={testEvidenceRequired} />
        <Button title="2. Error GPS requerido" onPress={testGpsRequired} />
        <Button title="3. Error series pendientes" onPress={testPendingSeries} />
        <Button title="4. Error permiso ubicación" onPress={testLocationPermissionDenied} />
        <Button title="5. Error sesión no válida" onPress={testAuthMissing} />
        <Button title="6. Error archivo evidencia faltante" onPress={testEvidenceFileMissing} />
        <Button title="7. Error sync fallido" onPress={testSyncFailure} />
        <Button title="8. Error base local" onPress={testDatabaseError} />
        <Button title="9. Error red" onPress={testNetworkError} />
        <Button title="10. Error desconocido" onPress={testUnknownError} />
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