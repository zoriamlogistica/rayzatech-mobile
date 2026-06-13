// src/infrastructure/remote/mobileTaskSource.ts

import { mobileApiGet } from './mobileApiClient';
import type {
    RemoteTaskDownloadResponse,
    RemoteTaskDto,
} from './remoteTask.types';

type MobileTaskApiItem = {
  id?: string;
  remoteId?: string;

  taskNumber?: string;
  orderCode?: string;
  project?: string;
  sot?: string;
  scheduledDate?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  timeRange?: string;
  taskType?: string;

  assignedUserId?: string;

  customerName?: string;
  customerDocument?: string;
  customerPhone?: string;
  customerEmail?: string;

  country?: string;
  department?: string;
  province?: string;
  district?: string;
  zone?: string;

  latitude?: number | null;
  longitude?: number | null;
  address?: string;
  reference?: string;
  observations?: string;

  status?: RemoteTaskDto['status'];
  priority?: RemoteTaskDto['priority'];

  createdAt?: string;
  updatedAt?: string;
  lastManagementAt?: string;

  series?: RemoteTaskDto['series'];
};

type MobileTasksApiResponse = {
  profile?: {
    id?: string;
    fullName?: string;
    email?: string;
    role?: string;
  };
  tasks: MobileTaskApiItem[];
  downloadedAt: string;
};

function normalizeMobileTask(task: MobileTaskApiItem): RemoteTaskDto {
  const remoteId = task.remoteId ?? task.id;

  if (!remoteId) {
    throw new Error('MOBILE_TASK_WITHOUT_REMOTE_ID');
  }

  return {
    remoteId,
    taskNumber: task.taskNumber ?? remoteId,
    orderCode: task.orderCode,
    project: task.project,
    sot: task.sot,

    assignedUserId: task.assignedUserId,

    customerName: task.customerName,
    customerDocument: task.customerDocument,
    customerPhone: task.customerPhone,
    customerEmail: task.customerEmail,

    department: task.department,
    province: task.province,
    district: task.district,
    address: task.address,
    reference: task.reference,

    latitude: task.latitude ?? undefined,
    longitude: task.longitude ?? undefined,

    scheduledDate: task.scheduledDate,
    scheduledStart: task.scheduledStart,
    scheduledEnd: task.scheduledEnd,
    timeRange: task.timeRange,

    taskType: task.taskType,
    priority: task.priority ?? 'normal',

    status: task.status ?? 'pending',

    observations: task.observations,

    version: 1,
    remoteUpdatedAt: task.updatedAt ?? task.createdAt ?? new Date().toISOString(),

    series: task.series ?? [],
  };
}

export async function fetchMobileRemoteTasks(): Promise<RemoteTaskDownloadResponse> {
  const response = await mobileApiGet<MobileTasksApiResponse>('/api/mobile/tasks');

  return {
    downloadedAt: response.downloadedAt,
    tasks: response.tasks.map(normalizeMobileTask),
  };
}