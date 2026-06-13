# RAYZATECH Mobile — Architecture Status

## Estado general

La app móvil Android de campo se está construyendo bajo arquitectura offline-first, priorizando estabilidad operacional antes que UI.

El objetivo es que el agente pueda trabajar en calle con mala señal o sin internet, manteniendo:

- tareas cacheadas localmente
- evidencias fotográficas locales
- GPS por eventos críticos
- series recuperadas/no recuperadas
- cola de sincronización
- reintentos controlados
- logs locales auditables
- manejo claro de errores de campo
- protección contra sobrescritura de cambios offline

---

## Stack móvil actual

- Expo SDK 56
- React Native
- Expo Router
- SQLite local con `expo-sqlite`
- SecureStore para tokens
- FileSystem legacy para evidencias locales
- NetInfo para estado de red
- Expo Location para GPS
- TypeScript estricto con `npx tsc --noEmit`

---

## Base local SQLite

### Tablas principales

- `users`
- `sessions`
- `tasks`
- `task_series`
- `task_events`
- `evidences`
- `gps_points`
- `sync_queue`
- `sync_attempts`
- `local_logs`
- `catalogs`
- `app_metadata`
- `schema_migrations`

### Migraciones aplicadas

- v1: esquema inicial
- v2: sync queue
- v3: índices
- v4: columnas extendidas para logs locales

Estado esperado:

```txt
currentVersion: 4
latestVersion: 4
status: ready