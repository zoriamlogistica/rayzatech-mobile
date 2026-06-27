// src/infrastructure/db/repositories/taskRepository.ts

import type { SyncStatus, Task, TaskStatus } from '@/domain/tasks/task.types';
import { getDatabase } from '../database';

type TaskRow = {
  id: string;
  remote_id: string | null;

  task_number: string | null;
  order_code: string | null;
  project: string | null;
  sot: string | null;
  route_number: string | null;
  guide_number: string | null;
  field_operation_type: Task['fieldOperationType'] | null;
  last_mile_task_type: Task['lastMileTaskType'] | null;
  service_area: string | null;
  contact_data: string | null;
  package_count: number | null;
  delivery_instructions: string | null;
  merchandise_condition: string | null;
  liquidation_status: Task['liquidationStatus'] | null;
  has_pending_liquidation: number | null;

  assigned_user_id: string | null;

  customer_name: string | null;
  customer_document: string | null;
  customer_phone: string | null;
  customer_email: string | null;

  department: string | null;
  province: string | null;
  district: string | null;
  address: string | null;
  reference: string | null;

  latitude: number | null;
  longitude: number | null;

  scheduled_date: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  time_range: string | null;

  task_type: string | null;
  priority: Task['priority'];

  status: TaskStatus;
  previous_status: TaskStatus | null;

  observations: string | null;
  operator_notes: string | null;
  internal_notes: string | null;

  version: number;
  remote_updated_at: string | null;
  local_updated_at: string;

  sync_status: SyncStatus;
  is_dirty: number;
  is_locked: number;
  lock_reason: string | null;

  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

function mapRowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    remoteId: row.remote_id ?? undefined,

    taskNumber: row.task_number ?? undefined,
    orderCode: row.order_code ?? undefined,
    project: row.project ?? undefined,
    sot: row.sot ?? undefined,
    routeNumber: row.route_number ?? undefined,
    guideNumber: row.guide_number ?? undefined,
    fieldOperationType: row.field_operation_type ?? undefined,
    lastMileTaskType: row.last_mile_task_type ?? undefined,
    serviceArea: row.service_area ?? undefined,
    contactData: row.contact_data ?? undefined,
    packageCount: row.package_count ?? undefined,
    deliveryInstructions: row.delivery_instructions ?? undefined,
    merchandiseCondition: row.merchandise_condition ?? undefined,
    liquidationStatus: row.liquidation_status ?? undefined,
    hasPendingLiquidation: row.has_pending_liquidation === 1,

    assignedUserId: row.assigned_user_id ?? undefined,

    customerName: row.customer_name ?? undefined,
    customerDocument: row.customer_document ?? undefined,
    customerPhone: row.customer_phone ?? undefined,
    customerEmail: row.customer_email ?? undefined,

    department: row.department ?? undefined,
    province: row.province ?? undefined,
    district: row.district ?? undefined,
    address: row.address ?? undefined,
    reference: row.reference ?? undefined,

    latitude: row.latitude ?? undefined,
    longitude: row.longitude ?? undefined,

    scheduledDate: row.scheduled_date ?? undefined,
    scheduledStart: row.scheduled_start ?? undefined,
    scheduledEnd: row.scheduled_end ?? undefined,
    timeRange: row.time_range ?? undefined,

    taskType: row.task_type ?? undefined,
    priority: row.priority,

    status: row.status,
    previousStatus: row.previous_status ?? undefined,

    observations: row.observations ?? undefined,
    operatorNotes: row.operator_notes ?? undefined,
    internalNotes: row.internal_notes ?? undefined,

    version: row.version,
    remoteUpdatedAt: row.remote_updated_at ?? undefined,
    localUpdatedAt: row.local_updated_at,

    syncStatus: row.sync_status,
    isDirty: row.is_dirty === 1,
    isLocked: row.is_locked === 1,
    lockReason: row.lock_reason ?? undefined,

    createdAt: row.created_at,
    updatedAt: row.updated_at,
    deletedAt: row.deleted_at ?? undefined,
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

export async function upsertTask(task: Task): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `
      INSERT INTO tasks (
        id,
        remote_id,
        task_number,
        order_code,
        project,
        sot,
        route_number,
        guide_number,
        field_operation_type,
        last_mile_task_type,
        service_area,
        contact_data,
        package_count,
        delivery_instructions,
        merchandise_condition,
        liquidation_status,
        has_pending_liquidation,
        assigned_user_id,
        customer_name,
        customer_document,
        customer_phone,
        customer_email,
        department,
        province,
        district,
        address,
        reference,
        latitude,
        longitude,
        scheduled_date,
        scheduled_start,
        scheduled_end,
        time_range,
        task_type,
        priority,
        status,
        previous_status,
        observations,
        operator_notes,
        internal_notes,
        version,
        remote_updated_at,
        local_updated_at,
        sync_status,
        is_dirty,
        is_locked,
        lock_reason,
        created_at,
        updated_at,
        deleted_at
      )
      VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
      ON CONFLICT(id) DO UPDATE SET
        remote_id = excluded.remote_id,
        task_number = excluded.task_number,
        order_code = excluded.order_code,
        project = excluded.project,
        sot = excluded.sot,
        route_number = excluded.route_number,
        guide_number = excluded.guide_number,
        field_operation_type = excluded.field_operation_type,
        last_mile_task_type = excluded.last_mile_task_type,
        service_area = excluded.service_area,
        contact_data = excluded.contact_data,
        package_count = excluded.package_count,
        delivery_instructions = excluded.delivery_instructions,
        merchandise_condition = excluded.merchandise_condition,
        liquidation_status = excluded.liquidation_status,
        has_pending_liquidation = excluded.has_pending_liquidation,
        assigned_user_id = excluded.assigned_user_id,
        customer_name = excluded.customer_name,
        customer_document = excluded.customer_document,
        customer_phone = excluded.customer_phone,
        customer_email = excluded.customer_email,
        department = excluded.department,
        province = excluded.province,
        district = excluded.district,
        address = excluded.address,
        reference = excluded.reference,
        latitude = excluded.latitude,
        longitude = excluded.longitude,
        scheduled_date = excluded.scheduled_date,
        scheduled_start = excluded.scheduled_start,
        scheduled_end = excluded.scheduled_end,
        time_range = excluded.time_range,
        task_type = excluded.task_type,
        priority = excluded.priority,
        status = excluded.status,
        previous_status = excluded.previous_status,
        observations = excluded.observations,
        operator_notes = excluded.operator_notes,
        internal_notes = excluded.internal_notes,
        version = excluded.version,
        remote_updated_at = excluded.remote_updated_at,
        local_updated_at = excluded.local_updated_at,
        sync_status = excluded.sync_status,
        is_dirty = excluded.is_dirty,
        is_locked = excluded.is_locked,
        lock_reason = excluded.lock_reason,
        updated_at = excluded.updated_at,
        deleted_at = excluded.deleted_at;
    `,
    [
      task.id,
      task.remoteId ?? null,
      task.taskNumber ?? null,
      task.orderCode ?? null,
      task.project ?? null,
      task.sot ?? null,
      task.routeNumber ?? null,
      task.guideNumber ?? null,
      task.fieldOperationType ?? 'inverse',
      task.lastMileTaskType ?? null,
      task.serviceArea ?? null,
      task.contactData ?? null,
      task.packageCount ?? null,
      task.deliveryInstructions ?? null,
      task.merchandiseCondition ?? null,
      task.liquidationStatus ?? 'none',
      task.hasPendingLiquidation ? 1 : 0,
      task.assignedUserId ?? null,
      task.customerName ?? null,
      task.customerDocument ?? null,
      task.customerPhone ?? null,
      task.customerEmail ?? null,
      task.department ?? null,
      task.province ?? null,
      task.district ?? null,
      task.address ?? null,
      task.reference ?? null,
      task.latitude ?? null,
      task.longitude ?? null,
      task.scheduledDate ?? null,
      task.scheduledStart ?? null,
      task.scheduledEnd ?? null,
      task.timeRange ?? null,
      task.taskType ?? null,
      task.priority,
      task.status,
      task.previousStatus ?? null,
      task.observations ?? null,
      task.operatorNotes ?? null,
      task.internalNotes ?? null,
      task.version,
      task.remoteUpdatedAt ?? null,
      task.localUpdatedAt,
      task.syncStatus,
      task.isDirty ? 1 : 0,
      task.isLocked ? 1 : 0,
      task.lockReason ?? null,
      task.createdAt,
      task.updatedAt,
      task.deletedAt ?? null,
    ]
  );
}

export async function getTaskById(id: string): Promise<Task | null> {
  const db = await getDatabase();

  const row = await db.getFirstAsync<TaskRow>(
    `
      SELECT *
      FROM tasks
      WHERE id = ?
        AND deleted_at IS NULL
      LIMIT 1;
    `,
    [id]
  );

  return row ? mapRowToTask(row) : null;
}

export async function listTasks(): Promise<Task[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<TaskRow>(
    `
      SELECT *
      FROM tasks
      WHERE deleted_at IS NULL
      ORDER BY
        scheduled_date ASC,
        priority DESC,
        created_at DESC;
    `
  );

  return rows.map(mapRowToTask);
}

export async function listTasksByStatus(status: TaskStatus): Promise<Task[]> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<TaskRow>(
    `
      SELECT *
      FROM tasks
      WHERE status = ?
        AND deleted_at IS NULL
      ORDER BY scheduled_date ASC, created_at DESC;
    `,
    [status]
  );

  return rows.map(mapRowToTask);
}

export async function updateTaskStatus(params: {
  taskId: string;
  nextStatus: TaskStatus;
  syncStatus?: SyncStatus;
}): Promise<void> {
  const db = await getDatabase();

  const currentTask = await getTaskById(params.taskId);

  if (!currentTask) {
    throw new Error(`Task not found: ${params.taskId}`);
  }

  const now = nowIso();

  await db.runAsync(
    `
      UPDATE tasks
      SET
        previous_status = status,
        status = ?,
        sync_status = ?,
        is_dirty = 1,
        local_updated_at = ?,
        updated_at = ?
      WHERE id = ?
        AND deleted_at IS NULL;
    `,
    [
      params.nextStatus,
      params.syncStatus ?? 'pending_sync',
      now,
      now,
      params.taskId,
    ]
  );
}

export async function markTaskAsSynced(params: {
  taskId: string;
  remoteId?: string;
  remoteUpdatedAt?: string;
  version?: number;
}): Promise<void> {
  const db = await getDatabase();

  const now = nowIso();

  await db.runAsync(
    `
      UPDATE tasks
      SET
        remote_id = COALESCE(?, remote_id),
        remote_updated_at = COALESCE(?, remote_updated_at),
        version = COALESCE(?, version),
        sync_status = 'synced',
        is_dirty = 0,
        updated_at = ?
      WHERE id = ?
        AND deleted_at IS NULL;
    `,
    [
      params.remoteId ?? null,
      params.remoteUpdatedAt ?? null,
      params.version ?? null,
      now,
      params.taskId,
    ]
  );
}

export async function markTaskAsConflict(params: {
  taskId: string;
  reason: string;
}): Promise<void> {
  const db = await getDatabase();

  const now = nowIso();

  await db.runAsync(
    `
      UPDATE tasks
      SET
        sync_status = 'conflict',
        is_dirty = 1,
        lock_reason = ?,
        updated_at = ?
      WHERE id = ?
        AND deleted_at IS NULL;
    `,
    [params.reason, now, params.taskId]
  );
}

export async function lockTask(params: {
  taskId: string;
  reason: string;
}): Promise<void> {
  const db = await getDatabase();

  const now = nowIso();

  await db.runAsync(
    `
      UPDATE tasks
      SET
        is_locked = 1,
        lock_reason = ?,
        updated_at = ?
      WHERE id = ?
        AND deleted_at IS NULL;
    `,
    [params.reason, now, params.taskId]
  );
}

export async function unlockTask(taskId: string): Promise<void> {
  const db = await getDatabase();

  const now = nowIso();

  await db.runAsync(
    `
      UPDATE tasks
      SET
        is_locked = 0,
        lock_reason = NULL,
        updated_at = ?
      WHERE id = ?
        AND deleted_at IS NULL;
    `,
    [now, taskId]
  );
}

export async function countTasksByStatus(): Promise<
  Array<{ status: TaskStatus; total: number }>
> {
  const db = await getDatabase();

  const rows = await db.getAllAsync<{ status: TaskStatus; total: number }>(
    `
      SELECT status, COUNT(*) as total
      FROM tasks
      WHERE deleted_at IS NULL
      GROUP BY status;
    `
  );

  return rows;
}

export async function softDeleteTask(taskId: string): Promise<void> {
  const db = await getDatabase();

  const now = nowIso();

  await db.runAsync(
    `
      UPDATE tasks
      SET
        deleted_at = ?,
        sync_status = 'pending_sync',
        is_dirty = 1,
        updated_at = ?
      WHERE id = ?;
    `,
    [now, now, taskId]
  );
}

export async function updateTaskRemoteMasterData(task: Task): Promise<void> {
  const db = await getDatabase();

  await db.runAsync(
    `
      UPDATE tasks
      SET
        remote_id = COALESCE(?, remote_id),
        task_number = ?,
        order_code = ?,
        project = ?,
        sot = ?,
        route_number = ?,
        guide_number = ?,
        field_operation_type = ?,
        last_mile_task_type = ?,
        service_area = ?,
        contact_data = ?,
        package_count = ?,
        delivery_instructions = ?,
        merchandise_condition = ?,
        liquidation_status = ?,
        has_pending_liquidation = ?,
        assigned_user_id = ?,
        customer_name = ?,
        customer_document = ?,
        customer_phone = ?,
        customer_email = ?,
        department = ?,
        province = ?,
        district = ?,
        address = ?,
        reference = ?,
        latitude = ?,
        longitude = ?,
        scheduled_date = ?,
        scheduled_start = ?,
        scheduled_end = ?,
        time_range = ?,
        task_type = ?,
        priority = ?,
        observations = ?,
        operator_notes = ?,
        internal_notes = ?,
        version = COALESCE(?, version),
        remote_updated_at = COALESCE(?, remote_updated_at),
        local_updated_at = ?,
        updated_at = ?
      WHERE id = ?
        AND deleted_at IS NULL;
    `,
    [
      task.remoteId ?? null,
      task.taskNumber ?? null,
      task.orderCode ?? null,
      task.project ?? null,
      task.sot ?? null,
      task.routeNumber ?? null,
      task.guideNumber ?? null,
      task.fieldOperationType ?? 'inverse',
      task.lastMileTaskType ?? null,
      task.serviceArea ?? null,
      task.contactData ?? null,
      task.packageCount ?? null,
      task.deliveryInstructions ?? null,
      task.merchandiseCondition ?? null,
      task.liquidationStatus ?? 'none',
      task.hasPendingLiquidation ? 1 : 0,
      task.assignedUserId ?? null,
      task.customerName ?? null,
      task.customerDocument ?? null,
      task.customerPhone ?? null,
      task.customerEmail ?? null,
      task.department ?? null,
      task.province ?? null,
      task.district ?? null,
      task.address ?? null,
      task.reference ?? null,
      task.latitude ?? null,
      task.longitude ?? null,
      task.scheduledDate ?? null,
      task.scheduledStart ?? null,
      task.scheduledEnd ?? null,
      task.timeRange ?? null,
      task.taskType ?? null,
      task.priority,
      task.observations ?? null,
      task.operatorNotes ?? null,
      task.internalNotes ?? null,
      task.version,
      task.remoteUpdatedAt ?? null,
      task.localUpdatedAt,
      task.updatedAt,
      task.id,
    ]
  );
}

export async function markMissingRemoteTasksAsLocallyDeletedForDate(params: {
  scheduledDate: string;
  remoteIds: string[];
}): Promise<number> {
  const db = await getDatabase();
  const now = nowIso();

  if (params.remoteIds.length === 0) {
    const result = await db.runAsync(
      `
        UPDATE tasks
        SET
          status = 'cancelled',
          deleted_at = ?,
          sync_status = 'synced',
          is_dirty = 0,
          updated_at = ?,
          local_updated_at = ?
        WHERE scheduled_date = ?
          AND remote_id IS NOT NULL
          AND deleted_at IS NULL
          AND is_dirty = 0
          AND sync_status = 'synced';
      `,
      [now, now, now, params.scheduledDate]
    );

    return result.changes ?? 0;
  }

  const placeholders = params.remoteIds.map(() => '?').join(', ');

  const result = await db.runAsync(
    `
      UPDATE tasks
      SET
        status = 'cancelled',
        deleted_at = ?,
        sync_status = 'synced',
        is_dirty = 0,
        updated_at = ?,
        local_updated_at = ?
      WHERE scheduled_date = ?
        AND remote_id IS NOT NULL
        AND remote_id NOT IN (${placeholders})
        AND deleted_at IS NULL
        AND is_dirty = 0
        AND sync_status = 'synced';
    `,
    [now, now, now, params.scheduledDate, ...params.remoteIds]
  );

  return result.changes ?? 0;
}
