// src/app/dev-menu.tsx

import { router, type Href } from 'expo-router';
import { Button, ScrollView, StyleSheet, Text, View } from 'react-native';

type DevRoute = {
  title: string;
  description: string;
  path: string;
};

const DEV_ROUTES: DevRoute[] = [
  {
  title: 'Task Management Workflow Test',
  description: 'Gestión con GPS, evidencias, equipos e historial.',
  path: '/dev-task-management-workflow-test',
},
  {
  title: 'Task Management Test',
  description: 'Historial de gestiones por tarea.',
  path: '/dev-task-management-test',
},
  {
    title: 'Auth Test',
    description: 'Sesión local, SecureStore y validación offline.',
    path: '/dev-auth-test',
  },
  {
    title: 'Task Download Test',
    description: 'Descarga DEV, cache local y conflictos.',
    path: '/dev-task-download-test',
  },
  {
    title: 'Task Query Test',
    description: 'Consultas locales para futura UI de tareas.',
    path: '/dev-task-query-test',
  },
  {
    title: 'Field Workflow Test',
    description: 'Flujo completo: descarga, operación, evidencia y sync.',
    path: '/dev-field-workflow-test',
  },
  {
    title: 'Recovered Device Test',
    description: 'Equipos recuperados reales registrados en campo.',
    path: '/dev-recovered-device-test',
  },
  {
    title: 'Task Ops Test',
    description: 'Servicio operativo offline con reglas y errores clasificados.',
    path: '/dev-task-ops-test',
  },
  {
    title: 'DB Test',
    description: 'Pruebas base SQLite, GPS, evidencia, sync y red.',
    path: '/dev-db-test',
  },
  {
    title: 'Log Test',
    description: 'Logs locales auditables.',
    path: '/dev-log-test',
  },
  {
    title: 'Field Error Test',
    description: 'Clasificación de errores reales de campo.',
    path: '/dev-field-error-test',
  },
];

export default function DevMenuScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>RAYZATECH DEV MENU</Text>

      <Text style={styles.subtitle}>
        Menú técnico temporal para acceder a pantallas de prueba sin cambiar
        index.tsx manualmente.
      </Text>

      <View style={styles.warningBox}>
        <Text style={styles.warningTitle}>Uso interno</Text>
        <Text style={styles.warningText}>
          Esta pantalla es solo para desarrollo. No forma parte de la UI final
          del agente.
        </Text>
      </View>

      <View style={styles.routesContainer}>
        {DEV_ROUTES.map((item) => (
          <View key={item.path} style={styles.card}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardDescription}>{item.description}</Text>

            <Button
              title={`Abrir ${item.title}`}
              onPress={() => router.push(item.path as unknown as Href)}
            />
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
  },
  subtitle: {
    fontSize: 14,
    opacity: 0.75,
    lineHeight: 20,
  },
  warningBox: {
    padding: 12,
    borderWidth: 1,
    borderColor: '#f5b301',
    borderRadius: 10,
    backgroundColor: '#fff8dc',
    gap: 4,
  },
  warningTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  warningText: {
    fontSize: 13,
    lineHeight: 18,
  },
  routesContainer: {
    gap: 12,
  },
  card: {
    padding: 14,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 12,
    gap: 8,
    backgroundColor: '#fff',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
  },
  cardDescription: {
    fontSize: 13,
    opacity: 0.75,
    lineHeight: 18,
  },
});