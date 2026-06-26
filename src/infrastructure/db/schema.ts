// src/infrastructure/db/schema.ts

export type Migration = {
  version: number;
  name: string;
  sql: string;
};

export const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    sql: `
      PRAGMA foreign_keys = ON;

      CREATE TABLE IF NOT EXISTS app_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        remote_id TEXT,
        full_name TEXT,
        email TEXT,
        role TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        last_login_at TEXT,
        created_at TEXT,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        agent_id TEXT,
        device_id TEXT NOT NULL,
        access_token TEXT,
        refresh_token TEXT,
        expires_at TEXT,
        last_online_validation_at TEXT,
        offline_grace_until TEXT,
        is_active INTEGER DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY(user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        remote_id TEXT,
        task_number TEXT,
        order_code TEXT,
        project TEXT,
        sot TEXT,
        route_number TEXT,
        guide_number TEXT,
        field_operation_type TEXT DEFAULT 'inverse',
        last_mile_task_type TEXT,
        service_area TEXT,
        contact_data TEXT,
        package_count INTEGER,
        delivery_instructions TEXT,
        merchandise_condition TEXT,
        liquidation_status TEXT DEFAULT 'none',
        has_pending_liquidation INTEGER DEFAULT 0,

        assigned_user_id TEXT,

        customer_name TEXT,
        customer_document TEXT,
        customer_phone TEXT,
        customer_email TEXT,

        department TEXT,
        province TEXT,
        district TEXT,
        address TEXT,
        reference TEXT,
        latitude REAL,
        longitude REAL,

        scheduled_date TEXT,
        scheduled_start TEXT,
        scheduled_end TEXT,
        time_range TEXT,

        task_type TEXT,
        priority TEXT DEFAULT 'normal',

        status TEXT NOT NULL DEFAULT 'pending',
        previous_status TEXT,

        observations TEXT,
        operator_notes TEXT,
        internal_notes TEXT,

        version INTEGER DEFAULT 1,
        remote_updated_at TEXT,
        local_updated_at TEXT NOT NULL,

        sync_status TEXT DEFAULT 'synced',
        is_dirty INTEGER DEFAULT 0,
        is_locked INTEGER DEFAULT 0,
        lock_reason TEXT,

        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );

      CREATE TABLE IF NOT EXISTS task_series (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        remote_id TEXT,

        serial_number TEXT NOT NULL,
        equipment_type TEXT,
        brand TEXT,
        model TEXT,

        expected INTEGER DEFAULT 1,
        recovered INTEGER DEFAULT 0,
        recovery_status TEXT DEFAULT 'pending',

        condition TEXT,
        observation TEXT,

        version INTEGER DEFAULT 1,
        sync_status TEXT DEFAULT 'synced',
        is_dirty INTEGER DEFAULT 0,

        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        local_updated_at TEXT NOT NULL,
        remote_updated_at TEXT,

        FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS task_events (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        remote_id TEXT,

        event_type TEXT NOT NULL,
        from_status TEXT,
        to_status TEXT,

        description TEXT,
        payload TEXT,

        user_id TEXT,
        device_id TEXT,

        latitude REAL,
        longitude REAL,
        accuracy REAL,

        occurred_at TEXT NOT NULL,

        sync_status TEXT DEFAULT 'pending_sync',
        created_at TEXT NOT NULL,

        FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS evidences (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        task_event_id TEXT,
        remote_id TEXT,

        evidence_type TEXT NOT NULL,
        local_uri TEXT NOT NULL,
        remote_url TEXT,

        file_name TEXT,
        mime_type TEXT DEFAULT 'image/jpeg',
        size_bytes INTEGER,
        checksum TEXT,

        latitude REAL,
        longitude REAL,
        accuracy REAL,

        captured_at TEXT NOT NULL,
        uploaded_at TEXT,

        upload_status TEXT DEFAULT 'local_only',
        sync_status TEXT DEFAULT 'pending_sync',

        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,

        FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY(task_event_id) REFERENCES task_events(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS gps_points (
        id TEXT PRIMARY KEY,
        task_id TEXT,
        task_event_id TEXT,

        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        accuracy REAL,
        altitude REAL,
        speed REAL,
        heading REAL,

        provider TEXT,
        mocked INTEGER DEFAULT 0,

        captured_at TEXT NOT NULL,
        sync_status TEXT DEFAULT 'pending_sync',

        created_at TEXT NOT NULL,

        FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY(task_event_id) REFERENCES task_events(id) ON DELETE SET NULL
      );

      CREATE TABLE IF NOT EXISTS catalogs (
        id TEXT PRIMARY KEY,
        catalog_type TEXT NOT NULL,
        code TEXT NOT NULL,
        label TEXT NOT NULL,
        value TEXT,
        metadata TEXT,

        version INTEGER DEFAULT 1,
        is_active INTEGER DEFAULT 1,

        remote_updated_at TEXT,
        local_updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS local_logs (
        id TEXT PRIMARY KEY,

        level TEXT NOT NULL,
        scope TEXT NOT NULL,
        message TEXT NOT NULL,
        details TEXT,

        task_id TEXT,
        user_id TEXT,
        device_id TEXT,

        created_at TEXT NOT NULL,
        sync_status TEXT DEFAULT 'pending_sync'
      );
    `,
  },
  {
    version: 2,
    name: 'sync_queue',
    sql: `
      CREATE TABLE IF NOT EXISTS sync_queue (
        id TEXT PRIMARY KEY,

        entity_type TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        operation TEXT NOT NULL,

        payload TEXT NOT NULL,

        status TEXT DEFAULT 'pending',
        priority INTEGER DEFAULT 5,

        attempt_count INTEGER DEFAULT 0,
        max_attempts INTEGER DEFAULT 10,

        next_attempt_at TEXT,
        locked_at TEXT,
        locked_by TEXT,

        last_error TEXT,
        last_error_code TEXT,

        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sync_attempts (
        id TEXT PRIMARY KEY,

        sync_queue_id TEXT NOT NULL,

        attempt_number INTEGER NOT NULL,
        status TEXT NOT NULL,

        request_payload TEXT,
        response_payload TEXT,

        error_message TEXT,
        error_code TEXT,

        started_at TEXT NOT NULL,
        finished_at TEXT,

        FOREIGN KEY(sync_queue_id) REFERENCES sync_queue(id) ON DELETE CASCADE
      );
    `,
  },
  {
    version: 3,
    name: 'indexes',
    sql: `
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_assigned_user ON tasks(assigned_user_id);
      CREATE INDEX IF NOT EXISTS idx_tasks_scheduled_date ON tasks(scheduled_date);
      CREATE INDEX IF NOT EXISTS idx_tasks_sync_status ON tasks(sync_status);
      CREATE INDEX IF NOT EXISTS idx_tasks_dirty ON tasks(is_dirty);

      CREATE INDEX IF NOT EXISTS idx_task_series_task_id ON task_series(task_id);
      CREATE INDEX IF NOT EXISTS idx_task_series_serial ON task_series(serial_number);
      CREATE INDEX IF NOT EXISTS idx_task_series_sync_status ON task_series(sync_status);

      CREATE INDEX IF NOT EXISTS idx_task_events_task_id ON task_events(task_id);
      CREATE INDEX IF NOT EXISTS idx_task_events_type ON task_events(event_type);
      CREATE INDEX IF NOT EXISTS idx_task_events_sync_status ON task_events(sync_status);

      CREATE INDEX IF NOT EXISTS idx_evidences_task_id ON evidences(task_id);
      CREATE INDEX IF NOT EXISTS idx_evidences_event_id ON evidences(task_event_id);
      CREATE INDEX IF NOT EXISTS idx_evidences_upload_status ON evidences(upload_status);
      CREATE INDEX IF NOT EXISTS idx_evidences_sync_status ON evidences(sync_status);

      CREATE INDEX IF NOT EXISTS idx_gps_points_task_id ON gps_points(task_id);
      CREATE INDEX IF NOT EXISTS idx_gps_points_event_id ON gps_points(task_event_id);
      CREATE INDEX IF NOT EXISTS idx_gps_points_sync_status ON gps_points(sync_status);

      CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status);
      CREATE INDEX IF NOT EXISTS idx_sync_queue_priority ON sync_queue(priority);
      CREATE INDEX IF NOT EXISTS idx_sync_queue_next_attempt ON sync_queue(next_attempt_at);
      CREATE INDEX IF NOT EXISTS idx_sync_queue_entity ON sync_queue(entity_type, entity_id);

      CREATE INDEX IF NOT EXISTS idx_catalogs_type ON catalogs(catalog_type);
      CREATE INDEX IF NOT EXISTS idx_catalogs_code ON catalogs(code);

      CREATE INDEX IF NOT EXISTS idx_local_logs_sync_status ON local_logs(sync_status);
      CREATE INDEX IF NOT EXISTS idx_local_logs_scope ON local_logs(scope);
    `,
  },
    {
    version: 4,
    name: 'local_logs_payload_and_error_columns',
    sql: `
      ALTER TABLE local_logs ADD COLUMN payload TEXT;
      ALTER TABLE local_logs ADD COLUMN error_name TEXT;
      ALTER TABLE local_logs ADD COLUMN error_message TEXT;
      ALTER TABLE local_logs ADD COLUMN error_stack TEXT;

      CREATE INDEX IF NOT EXISTS idx_local_logs_level ON local_logs(level);
      CREATE INDEX IF NOT EXISTS idx_local_logs_created_at ON local_logs(created_at);
    `,
  },
    {
    version: 5,
    name: 'recovered_devices',
    sql: `
      CREATE TABLE IF NOT EXISTS recovered_devices (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        remote_id TEXT,

        serial_number TEXT NOT NULL,
        device_type TEXT NOT NULL,
        condition TEXT DEFAULT 'unknown',

        has_charger INTEGER DEFAULT 0,
        has_remote_control INTEGER DEFAULT 0,
        has_power_supply INTEGER DEFAULT 0,
        has_network_cable INTEGER DEFAULT 0,
        has_other_accessory INTEGER DEFAULT 0,
        other_accessory_detail TEXT,

        device_observation TEXT,

        series_label_evidence_id TEXT,

        sync_status TEXT DEFAULT 'pending_sync',
        is_dirty INTEGER DEFAULT 1,

        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        local_updated_at TEXT NOT NULL,
        remote_updated_at TEXT,

        FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY(series_label_evidence_id) REFERENCES evidences(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_recovered_devices_task_id ON recovered_devices(task_id);
      CREATE INDEX IF NOT EXISTS idx_recovered_devices_serial ON recovered_devices(serial_number);
      CREATE INDEX IF NOT EXISTS idx_recovered_devices_sync_status ON recovered_devices(sync_status);
      CREATE INDEX IF NOT EXISTS idx_recovered_devices_dirty ON recovered_devices(is_dirty);
    `,
  },
    {
    version: 6,
    name: 'task_managements_and_recovered_device_management_link',
    sql: `
      CREATE TABLE IF NOT EXISTS task_managements (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        remote_id TEXT,

        management_number INTEGER NOT NULL,
        result_status TEXT NOT NULL,

        reason TEXT,
        observation TEXT,

        latitude REAL,
        longitude REAL,
        accuracy REAL,
        mocked INTEGER DEFAULT 0,

        general_evidence_id TEXT,

        reschedule_date TEXT,
        reschedule_time_range TEXT,

        managed_at TEXT NOT NULL,
        managed_by TEXT,

        sync_status TEXT DEFAULT 'pending_sync',
        is_dirty INTEGER DEFAULT 1,

        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        local_updated_at TEXT NOT NULL,
        remote_updated_at TEXT,

        FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE,
        FOREIGN KEY(general_evidence_id) REFERENCES evidences(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_task_managements_task_id ON task_managements(task_id);
      CREATE INDEX IF NOT EXISTS idx_task_managements_result_status ON task_managements(result_status);
      CREATE INDEX IF NOT EXISTS idx_task_managements_managed_at ON task_managements(managed_at);
      CREATE INDEX IF NOT EXISTS idx_task_managements_sync_status ON task_managements(sync_status);
      CREATE INDEX IF NOT EXISTS idx_task_managements_dirty ON task_managements(is_dirty);

      ALTER TABLE recovered_devices ADD COLUMN management_id TEXT;

      CREATE INDEX IF NOT EXISTS idx_recovered_devices_management_id ON recovered_devices(management_id);
    `,
  },
  {
    version: 7,
    name: 'user_profile_contact_fields',
    sql: `
      ALTER TABLE users ADD COLUMN phone TEXT;
      ALTER TABLE users ADD COLUMN address TEXT;
      ALTER TABLE users ADD COLUMN address_reference TEXT;
      ALTER TABLE users ADD COLUMN zone TEXT;
      ALTER TABLE users ADD COLUMN department TEXT;
      ALTER TABLE users ADD COLUMN province TEXT;
      ALTER TABLE users ADD COLUMN district TEXT;
    `,
  },
  {
    version: 8,
    name: 'last_mile_task_fields',
    sql: `
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS route_number TEXT;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS guide_number TEXT;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS field_operation_type TEXT DEFAULT 'inverse';
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS last_mile_task_type TEXT;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS service_area TEXT;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS contact_data TEXT;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS package_count INTEGER;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS delivery_instructions TEXT;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS merchandise_condition TEXT;
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS liquidation_status TEXT DEFAULT 'none';
      ALTER TABLE tasks ADD COLUMN IF NOT EXISTS has_pending_liquidation INTEGER DEFAULT 0;
    `,
  },
];
