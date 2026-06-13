// src/infrastructure/remote/devRemoteTaskSource.ts

import type { RemoteTaskDownloadResponse } from './remoteTask.types';

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function fetchDevRemoteTasks(): Promise<RemoteTaskDownloadResponse> {
  const now = new Date().toISOString();

  return {
    downloadedAt: now,
    tasks: [
      {
        remoteId: 'remote_task_001',
        taskNumber: 'RTZ-000001',
        orderCode: 'ORD-REMOTE-001',
        project: 'RAYZATECH RECOVERY',
        sot: 'SOT-REMOTE-001',

        assignedUserId: 'dev_user_001',

        customerName: 'Cliente Descarga Uno',
        customerDocument: '12345678',
        customerPhone: '999111222',

        department: 'Lima',
        province: 'Lima',
        district: 'San Borja',
        address: 'Av. Aviación 1234',
        reference: 'Frente a parque',

        latitude: -12.096,
        longitude: -77.007,

        scheduledDate: todayIsoDate(),
        timeRange: '09:00 - 13:00',

        taskType: 'recovery',
        priority: 'normal',

        status: 'pending',
        observations: 'Tarea descargada desde fuente DEV.',

        version: 1,
        remoteUpdatedAt: now,

        series: [
          {
            remoteId: 'remote_series_001',
            serialNumber: 'DEV-MODEM-000001',
            equipmentType: 'MODEM',
            brand: 'HUAWEI',
            model: 'HG8245',
          },
          {
            remoteId: 'remote_series_002',
            serialNumber: 'DEV-DECO-000001',
            equipmentType: 'DECODIFICADOR',
            brand: 'ARRIS',
            model: 'DCX525',
          },
        ],
      },
      {
        remoteId: 'remote_task_002',
        taskNumber: 'RTZ-000002',
        orderCode: 'ORD-REMOTE-002',
        project: 'RAYZATECH RECOVERY',
        sot: 'SOT-REMOTE-002',

        assignedUserId: 'dev_user_001',

        customerName: 'Cliente Descarga Dos',
        customerDocument: '87654321',
        customerPhone: '999333444',

        department: 'Lima',
        province: 'Lima',
        district: 'Surco',
        address: 'Av. Primavera 456',
        reference: 'Edificio gris',

        latitude: -12.112,
        longitude: -76.99,

        scheduledDate: todayIsoDate(),
        timeRange: '14:00 - 18:00',

        taskType: 'recovery',
        priority: 'high',

        status: 'pending',
        observations: 'Segunda tarea descargada desde fuente DEV.',

        version: 1,
        remoteUpdatedAt: now,

        series: [
          {
            remoteId: 'remote_series_003',
            serialNumber: 'DEV-MODEM-000002',
            equipmentType: 'MODEM',
            brand: 'ZTE',
            model: 'ZXHN-F660',
          },
        ],
      },
    ],
  };
}