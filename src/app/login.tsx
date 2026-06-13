// src/app/login.tsx

import { router } from 'expo-router';
import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';

import { loginWithEmailPassword } from '@/application/auth/realAuth.service';
import { classifyFieldError } from '@/application/errors/fieldError.service';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function login() {
    if (!email.trim()) {
      Alert.alert('Correo requerido', 'Ingresa tu correo para iniciar sesión.');
      return;
    }

    if (!password.trim()) {
      Alert.alert(
        'Contraseña requerida',
        'Ingresa tu contraseña para iniciar sesión.'
      );
      return;
    }

    try {
      setIsSubmitting(true);

      await loginWithEmailPassword({
        email,
        password,
      });

      router.replace('/agent-dashboard');
    } catch (error) {
      const fieldError = classifyFieldError(error);

      Alert.alert(fieldError.title, fieldError.message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.card}>
        <Image
          source={require('../../assets/images/icon.png')}
          style={styles.logo}
          resizeMode="contain"
        />

        <Text style={styles.title}>RAYZATECH</Text>
        <Text style={styles.subtitle}>Acceso de agente de campo</Text>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Correo</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="agente@empresa.com"
              placeholderTextColor="#999"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isSubmitting}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Contraseña</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="Ingresa tu contraseña"
              placeholderTextColor="#999"
              secureTextEntry
              editable={!isSubmitting}
            />
          </View>

          <Pressable
            style={[
              styles.loginButton,
              isSubmitting ? styles.loginButtonDisabled : null,
            ]}
            onPress={login}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginButtonText}>Iniciar sesión</Text>
            )}
          </Pressable>
        </View>

        <Text style={styles.footerText}>By Rayza-Tech · v1.6</Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    padding: 22,
    justifyContent: 'center',
    backgroundColor: '#f5f7f6',
  },
  card: {
    padding: 22,
    borderRadius: 24,
    backgroundColor: '#fff',
    gap: 14,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    elevation: 3,
  },
  logo: {
    width: 82,
    height: 82,
    alignSelf: 'center',
    borderRadius: 22,
  },
  title: {
    fontSize: 28,
    fontWeight: '900',
    color: '#137333',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#666',
    textAlign: 'center',
    marginBottom: 8,
  },
  form: {
    gap: 12,
  },
  field: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '900',
    color: '#333',
  },
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: '#d9e5dd',
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: '700',
    color: '#111',
    backgroundColor: '#fbfdfc',
  },
  loginButton: {
    minHeight: 52,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#137333',
    marginTop: 6,
  },
  loginButtonDisabled: {
    opacity: 0.65,
  },
  loginButtonText: {
    fontSize: 16,
    fontWeight: '900',
    color: '#fff',
  },
  footerText: {
    marginTop: 8,
    fontSize: 11,
    fontWeight: '800',
    color: '#777',
    textAlign: 'center',
  },
});