// src/app/dev-auth-test.tsx

import { useState } from 'react';
import {
    Alert,
    Button,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';

import {
    assertCanUseAppOffline,
    createDevAuthSession,
    getAuthSessionSnapshot,
    hardClearLocalAuth,
    logoutLocalSession,
} from '@/application/auth/authSession.service';

export default function DevAuthTestScreen() {
  const [output, setOutput] = useState<string>('Esperando prueba de auth...');

  function log(value: unknown) {
    setOutput(JSON.stringify(value, null, 2));
  }

  async function createSession() {
    try {
      const snapshot = await createDevAuthSession();

      Alert.alert('OK', 'Sesión DEV creada correctamente.');
      log(snapshot);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudo crear sesión DEV.');
      log(error);
    }
  }

  async function showSession() {
    try {
      const snapshot = await getAuthSessionSnapshot();
      log(snapshot);
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudo obtener sesión.');
      log(error);
    }
  }

  async function validateOfflineAccess() {
    try {
      const snapshot = await assertCanUseAppOffline();

      Alert.alert('OK', `Acceso permitido: ${snapshot.status}`);
      log(snapshot);
    } catch (error) {
      console.error(error);
      Alert.alert('Acceso bloqueado', 'La sesión no permite uso offline.');
      log(error);
    }
  }

  async function logout() {
    try {
      await logoutLocalSession();

      Alert.alert('OK', 'Sesión desactivada y tokens borrados.');
      await showSession();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudo cerrar sesión.');
      log(error);
    }
  }

  async function hardClear() {
    try {
      await hardClearLocalAuth();

      Alert.alert('OK', 'Auth local limpiado completamente.');
      await showSession();
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'No se pudo limpiar auth local.');
      log(error);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>RAYZATECH AUTH TEST</Text>

      <Text style={styles.subtitle}>
        Prueba técnica de sesión persistente offline.
      </Text>

      <View style={styles.buttonGroup}>
        <Button title="1. Crear sesión DEV" onPress={createSession} />
        <Button title="2. Ver sesión activa" onPress={showSession} />
        <Button title="3. Validar acceso offline" onPress={validateOfflineAccess} />
        <Button title="4. Cerrar sesión local" onPress={logout} />
        <Button title="5. Limpiar auth local completo" onPress={hardClear} />
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