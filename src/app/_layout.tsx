// src/app/_layout.tsx

import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider,
  router,
  usePathname,
} from 'expo-router';

import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  AppState,
  Button,
  Text,
  View,
  useColorScheme,
} from 'react-native';

import {
  runAutoSyncOnce,
  startAutoSyncOnNetworkReconnect,
  stopAutoSyncOnNetworkReconnect,
} from '@/sync/autoSyncService';

import {
  bootstrapApp,
  type AppBootstrapResult,
} from '@/application/bootstrap/appBootstrap.service';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnimatedSplashOverlay } from '@/components/animated-icon';

function AppRoot({ children }: { children: ReactNode }) {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {children}
    </GestureHandlerRootView>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const pathname = usePathname();
  const isLoginRoute = pathname === '/login';

  const [bootstrapResult, setBootstrapResult] =
    useState<AppBootstrapResult | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  async function runBootstrap() {
    try {
      setIsBootstrapping(true);

      const result = await bootstrapApp();

      // console.log('[RAYZATECH BOOTSTRAP]', result);

      setBootstrapResult(result);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);

      setBootstrapResult({
        status: 'database_error',
        error: message,
        bootstrappedAt: new Date().toISOString(),
      });
    } finally {
      setIsBootstrapping(false);
    }
  }


  useEffect(() => {
    runBootstrap();
  }, []);

  useEffect(() => {
  if (!bootstrapResult) {
    return;
  }

  if (bootstrapResult.status !== 'ready') {
    stopAutoSyncOnNetworkReconnect();
    return;
  }

  startAutoSyncOnNetworkReconnect();

  runAutoSyncOnce().catch((error) => {
    console.error('[AUTO_SYNC_BOOT_ERROR]', error);
  });

  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      runAutoSyncOnce().catch((error) => {
        console.error('[AUTO_SYNC_APP_ACTIVE_ERROR]', error);
      });
    }
  });

  return () => {
    subscription.remove();
    stopAutoSyncOnNetworkReconnect();
  };
}, [bootstrapResult]);

  useEffect(() => {
  if (!bootstrapResult) {
    return;
  }

  if (bootstrapResult.status !== 'auth_required') {
    return;
  }

  if (pathname === '/login') {
    return;
  }

  router.replace('/login' as never);
}, [bootstrapResult, pathname]);

  if (isBootstrapping || !bootstrapResult) {
    return (
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
          }}
        >
          <ActivityIndicator size="large" />

          <Text
            style={{
              marginTop: 16,
              fontSize: 15,
              textAlign: 'center',
              opacity: 0.8,
            }}
          >
            Inicializando RAYZATECH...
          </Text>
        </View>
      </ThemeProvider>
    );
  }

  if (bootstrapResult.status === 'auth_required') {
  return (
    <AppRoot>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <Stack
          screenOptions={{
            headerShown: false,
          }}
        />
      </ThemeProvider>
    </AppRoot>
  );
}

  if (bootstrapResult.status !== 'ready') {
    return (
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            padding: 24,
            gap: 12,
          }}
        >
          <Text
            style={{
              fontSize: 20,
              fontWeight: '800',
              textAlign: 'center',
            }}
          >
            Error de arranque
          </Text>

          <Text
            style={{
              fontSize: 14,
              textAlign: 'center',
              opacity: 0.8,
            }}
          >
            La app no puede iniciar correctamente.
          </Text>

          <Text
            selectable
            style={{
              fontSize: 12,
              textAlign: 'center',
              opacity: 0.7,
            }}
          >
            Estado: {bootstrapResult.status}
            {'\n'}
            Error: {bootstrapResult.error ?? 'Sin detalle'}
          </Text>

          <Button title="Reintentar" onPress={runBootstrap} />
        </View>
      </ThemeProvider>
    );
  }

  return (
  <AppRoot>
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />

      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </ThemeProvider>
  </AppRoot>
);

}