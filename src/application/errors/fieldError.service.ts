// src/application/errors/fieldError.service.ts

export type FieldErrorCategory =
  | 'gps'
  | 'evidence'
  | 'auth'
  | 'database'
  | 'sync'
  | 'operational_rule'
  | 'network'
  | 'unknown';

export type FieldErrorSeverity = 'info' | 'warning' | 'blocking';

export type FieldError = {
  category: FieldErrorCategory;
  severity: FieldErrorSeverity;
  code: string;
  title: string;
  message: string;
  rawMessage?: string;
};

function getRawMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return 'UNKNOWN_ERROR';
  }
}

function classifyOperationalRule(rawMessage: string): FieldError | null {
  if (!rawMessage.startsWith('OPERATIONAL_RULE_FAILED:')) {
    return null;
  }

  const hasEvidenceRequired = rawMessage.includes('EVIDENCE_REQUIRED');
const hasGpsRequired = rawMessage.includes('GPS_REQUIRED');
const hasPendingSeries = rawMessage.includes('PENDING_SERIES');
const hasRecoveredDeviceRequired = rawMessage.includes('RECOVERED_DEVICE_REQUIRED');
const hasRecoveredDevicePhotoRequired = rawMessage.includes(
  'RECOVERED_DEVICE_PHOTO_REQUIRED'
);
const hasRecoveredDeviceLimitExceeded = rawMessage.includes(
  'RECOVERED_DEVICE_LIMIT_EXCEEDED'
);

if (hasRecoveredDeviceRequired && hasEvidenceRequired && hasGpsRequired) {
  return {
    category: 'operational_rule',
    severity: 'blocking',
    code: 'RECOVERED_DEVICE_EVIDENCE_AND_GPS_REQUIRED',
    title: 'No se puede completar la tarea',
    message:
      'Debes registrar al menos un equipo recuperado, evidencia general y ubicación GPS antes de cerrar.',
    rawMessage,
  };
}

if (hasRecoveredDeviceRequired && hasEvidenceRequired) {
  return {
    category: 'operational_rule',
    severity: 'blocking',
    code: 'RECOVERED_DEVICE_AND_EVIDENCE_REQUIRED',
    title: 'No se puede completar la tarea',
    message:
      'Debes registrar al menos un equipo recuperado y evidencia general antes de cerrar.',
    rawMessage,
  };
}

if (hasRecoveredDeviceRequired && hasGpsRequired) {
  return {
    category: 'operational_rule',
    severity: 'blocking',
    code: 'RECOVERED_DEVICE_AND_GPS_REQUIRED',
    title: 'No se puede completar la tarea',
    message:
      'Debes registrar al menos un equipo recuperado y ubicación GPS antes de cerrar.',
    rawMessage,
  };
}

if (hasRecoveredDeviceRequired) {
  return {
    category: 'operational_rule',
    severity: 'blocking',
    code: 'RECOVERED_DEVICE_REQUIRED',
    title: 'Equipo recuperado requerido',
    message: 'Para una gestión exitosa debes registrar al menos un equipo recuperado.',
    rawMessage,
  };
}

if (hasRecoveredDevicePhotoRequired) {
  return {
    category: 'operational_rule',
    severity: 'blocking',
    code: 'RECOVERED_DEVICE_PHOTO_REQUIRED',
    title: 'Foto de etiqueta requerida',
    message:
      'Cada equipo recuperado debe tener una foto de la etiqueta o serie antes de completar la tarea.',
    rawMessage,
  };
}

if (hasRecoveredDeviceLimitExceeded) {
  return {
    category: 'operational_rule',
    severity: 'blocking',
    code: 'RECOVERED_DEVICE_LIMIT_EXCEEDED',
    title: 'Límite de equipos excedido',
    message: 'Solo puedes registrar hasta 10 equipos recuperados por tarea.',
    rawMessage,
  };
}
  if (hasPendingSeries && hasEvidenceRequired && hasGpsRequired) {
    return {
      category: 'operational_rule',
      severity: 'blocking',
      code: 'PENDING_SERIES_EVIDENCE_AND_GPS_REQUIRED',
      title: 'No se puede completar la tarea',
      message:
        'Debes resolver las series pendientes, registrar evidencia y guardar ubicación GPS antes de cerrar.',
      rawMessage,
    };
  }

  if (hasPendingSeries && hasEvidenceRequired) {
    return {
      category: 'operational_rule',
      severity: 'blocking',
      code: 'PENDING_SERIES_AND_EVIDENCE_REQUIRED',
      title: 'No se puede completar la tarea',
      message:
        'Debes resolver las series pendientes y registrar evidencia antes de cerrar.',
      rawMessage,
    };
  }

  if (hasPendingSeries && hasGpsRequired) {
    return {
      category: 'operational_rule',
      severity: 'blocking',
      code: 'PENDING_SERIES_AND_GPS_REQUIRED',
      title: 'No se puede completar la tarea',
      message:
        'Debes resolver las series pendientes y registrar ubicación GPS antes de cerrar.',
      rawMessage,
    };
  }

  if (hasEvidenceRequired && hasGpsRequired) {
    return {
      category: 'operational_rule',
      severity: 'blocking',
      code: 'EVIDENCE_AND_GPS_REQUIRED',
      title: 'No se puede completar la tarea',
      message:
        'Debes registrar evidencia y guardar ubicación GPS antes de cerrar.',
      rawMessage,
    };
  }

  if (hasPendingSeries) {
    return {
      category: 'operational_rule',
      severity: 'blocking',
      code: 'PENDING_SERIES',
      title: 'Series pendientes',
      message: 'No puedes cerrar la tarea mientras existan series pendientes.',
      rawMessage,
    };
  }

  if (hasEvidenceRequired) {
    return {
      category: 'operational_rule',
      severity: 'blocking',
      code: 'EVIDENCE_REQUIRED',
      title: 'Evidencia requerida',
      message: 'No puedes cerrar la tarea sin registrar evidencia.',
      rawMessage,
    };
  }

  if (hasGpsRequired) {
    return {
      category: 'operational_rule',
      severity: 'blocking',
      code: 'GPS_REQUIRED',
      title: 'GPS requerido',
      message: 'No puedes cerrar la tarea sin ubicación GPS registrada.',
      rawMessage,
    };
  }

  return {
    category: 'operational_rule',
    severity: 'blocking',
    code: 'OPERATIONAL_RULE_FAILED',
    title: 'Regla operativa incumplida',
    message: 'La operación no cumple las reglas requeridas.',
    rawMessage,
  };
}

function classifyGpsError(rawMessage: string): FieldError | null {
  if (rawMessage.includes('LOCATION_PERMISSION_DENIED')) {
    return {
      category: 'gps',
      severity: 'blocking',
      code: 'LOCATION_PERMISSION_DENIED',
      title: 'Permiso de ubicación denegado',
      message:
        'Debes permitir el acceso a ubicación para continuar con esta operación.',
      rawMessage,
    };
  }

  if (rawMessage.includes('LOCATION_UNAVAILABLE')) {
    return {
      category: 'gps',
      severity: 'warning',
      code: 'LOCATION_UNAVAILABLE',
      title: 'Ubicación no disponible',
      message:
        'No se pudo obtener ubicación. Intenta nuevamente en un lugar con mejor señal GPS.',
      rawMessage,
    };
  }

  return null;
}

function classifyAuthError(rawMessage: string): FieldError | null {
    if (rawMessage.includes('LOGIN_FAILED:')) {
    return {
      category: 'auth',
      severity: 'blocking',
      code: 'LOGIN_FAILED',
      title: 'No se pudo iniciar sesión',
      message:
        'El correo o la contraseña no son correctos, o el usuario no existe en Supabase Auth.',
      rawMessage,
    };
  }

  if (rawMessage.includes('LOGIN_PROFILE_FAILED:')) {
    return {
      category: 'auth',
      severity: 'blocking',
      code: 'LOGIN_PROFILE_FAILED',
      title: 'Perfil móvil no disponible',
      message:
        'El usuario inició sesión, pero no se pudo validar su perfil móvil en el panel. Verifica conexión, API móvil y user_profiles.',
      rawMessage,
    };
  }

  if (rawMessage.includes('LOGIN_FORBIDDEN:ONLY_FIELD_USER_ALLOWED')) {
    return {
      category: 'auth',
      severity: 'blocking',
      code: 'LOGIN_FORBIDDEN_FIELD_USER',
      title: 'Usuario no autorizado',
      message:
        'Este usuario no tiene rol de agente de campo. Debe tener role = field_user y estar activo.',
      rawMessage,
    };
  }

  if (rawMessage.includes('MISSING_EXPO_PUBLIC_SUPABASE_URL')) {
    return {
      category: 'auth',
      severity: 'blocking',
      code: 'MISSING_SUPABASE_URL',
      title: 'Configuración incompleta',
      message:
        'Falta configurar EXPO_PUBLIC_SUPABASE_URL en el archivo .env de la app móvil.',
      rawMessage,
    };
  }

  if (rawMessage.includes('MISSING_EXPO_PUBLIC_SUPABASE_ANON_KEY')) {
    return {
      category: 'auth',
      severity: 'blocking',
      code: 'MISSING_SUPABASE_ANON_KEY',
      title: 'Configuración incompleta',
      message:
        'Falta configurar EXPO_PUBLIC_SUPABASE_ANON_KEY en el archivo .env de la app móvil.',
      rawMessage,
    };
  }

  if (rawMessage.includes('EXPO_PUBLIC_SUPABASE_URL_MUST_BE_HTTP_URL')) {
    return {
      category: 'auth',
      severity: 'blocking',
      code: 'INVALID_SUPABASE_URL',
      title: 'URL de Supabase inválida',
      message:
        'La URL de Supabase debe empezar con https:// y terminar normalmente en .supabase.co.',
      rawMessage,
    };
  }
  if (rawMessage.startsWith('AUTH_SESSION_NOT_ALLOWED:')) {
    return {
      category: 'auth',
      severity: 'blocking',
      code: 'AUTH_SESSION_NOT_ALLOWED',
      title: 'Sesión no válida',
      message: 'Tu sesión no permite continuar. Debes iniciar sesión nuevamente.',
      rawMessage,
    };
  }

  if (rawMessage.includes('TOKEN_EXPIRED')) {
    return {
      category: 'auth',
      severity: 'blocking',
      code: 'TOKEN_EXPIRED',
      title: 'Sesión expirada',
      message: 'Tu sesión expiró. Debes validar nuevamente tu acceso.',
      rawMessage,
    };
  }

  return null;
}

function classifyEvidenceError(rawMessage: string): FieldError | null {
  if (rawMessage.includes('CAMERA_PERMISSION_DENIED')) {
    return {
      category: 'evidence',
      severity: 'blocking',
      code: 'CAMERA_PERMISSION_DENIED',
      title: 'Permiso de cámara denegado',
      message:
        'Debes permitir el acceso a la cámara para registrar evidencias de gestión.',
      rawMessage,
    };
  }

  if (rawMessage.includes('CAMERA_UNAVAILABLE')) {
    return {
      category: 'evidence',
      severity: 'blocking',
      code: 'CAMERA_UNAVAILABLE',
      title: 'Cámara no disponible',
      message:
        'No se pudo abrir la cámara del dispositivo. Verifica permisos o intenta nuevamente.',
      rawMessage,
    };
  }

  if (rawMessage.includes('IMAGE_CAPTURE_FAILED')) {
    return {
      category: 'evidence',
      severity: 'warning',
      code: 'IMAGE_CAPTURE_FAILED',
      title: 'No se pudo capturar la foto',
      message:
        'La foto no pudo capturarse correctamente. Intenta tomar la evidencia nuevamente.',
      rawMessage,
    };
  }

  if (rawMessage.includes('IMAGE_OPTIMIZATION_FAILED')) {
    return {
      category: 'evidence',
      severity: 'warning',
      code: 'IMAGE_OPTIMIZATION_FAILED',
      title: 'No se pudo optimizar la foto',
      message:
        'La foto fue tomada, pero no se pudo comprimir correctamente. Intenta nuevamente.',
      rawMessage,
    };
  }

  if (rawMessage.includes('EVIDENCE_COPY_FAILED')) {
    return {
      category: 'evidence',
      severity: 'blocking',
      code: 'EVIDENCE_COPY_FAILED',
      title: 'No se pudo guardar la evidencia',
      message:
        'La foto fue tomada, pero no se pudo guardar en el almacenamiento local de la app. Intenta nuevamente.',
      rawMessage,
    };
  }

  if (rawMessage.includes('LOCAL_FILE_NOT_FOUND')) {
    return {
      category: 'evidence',
      severity: 'blocking',
      code: 'LOCAL_FILE_NOT_FOUND',
      title: 'Archivo de evidencia no encontrado',
      message: 'La evidencia local no existe o fue eliminada del dispositivo.',
      rawMessage,
    };
  }

  if (rawMessage.includes('EVIDENCE_UPLOAD_FAILED')) {
    return {
      category: 'evidence',
      severity: 'warning',
      code: 'EVIDENCE_UPLOAD_FAILED',
      title: 'Error al subir evidencia',
      message:
        'La evidencia quedó guardada localmente y se reintentará la subida.',
      rawMessage,
    };
  }

  return null;
}

function classifySyncError(rawMessage: string): FieldError | null {
    if (rawMessage.includes('TASK_MANAGEMENT_NOT_FOUND')) {
    return {
      category: 'sync',
      severity: 'blocking',
      code: 'TASK_MANAGEMENT_NOT_FOUND',
      title: 'Gestión no encontrada',
      message:
        'La gestión local no fue encontrada para sincronizar. Recarga la app e intenta nuevamente.',
      rawMessage,
    };
  }

  if (rawMessage.includes('TASK_NOT_FOUND')) {
    return {
      category: 'sync',
      severity: 'blocking',
      code: 'TASK_NOT_FOUND',
      title: 'Tarea no encontrada',
      message:
        'No se encontró la tarea local asociada a la gestión. Sincroniza nuevamente las tareas.',
      rawMessage,
    };
  }

  if (rawMessage.includes('TASK_REMOTE_ID_MISSING')) {
    return {
      category: 'sync',
      severity: 'blocking',
      code: 'TASK_REMOTE_ID_MISSING',
      title: 'Tarea sin ID remoto',
      message:
        'La tarea no tiene identificador remoto del panel. Vuelve a descargar las tareas desde el panel.',
      rawMessage,
    };
  }
  if (rawMessage.includes('DEV_SYNC_FORCED_FAILURE')) {
    return {
      category: 'sync',
      severity: 'warning',
      code: 'DEV_SYNC_FORCED_FAILURE',
      title: 'Fallo de sincronización simulado',
      message: 'El item no se sincronizó y quedará pendiente para reintento.',
      rawMessage,
    };
  }

  if (rawMessage.includes('SYNC_ALREADY_RUNNING')) {
    return {
      category: 'sync',
      severity: 'info',
      code: 'SYNC_ALREADY_RUNNING',
      title: 'Sincronización en curso',
      message: 'Ya existe una sincronización ejecutándose.',
      rawMessage,
    };
  }

  return null;
}

function classifyDatabaseError(rawMessage: string): FieldError | null {
  if (
    rawMessage.includes('SQLite') ||
    rawMessage.includes('NativeDatabase') ||
    rawMessage.includes('no column named') ||
    rawMessage.includes('no such table')
  ) {
    return {
      category: 'database',
      severity: 'blocking',
      code: 'DATABASE_ERROR',
      title: 'Error de base local',
      message: 'Ocurrió un problema con la base de datos local.',
      rawMessage,
    };
  }

  return null;
}

function classifyNetworkError(rawMessage: string): FieldError | null {
  if (
    rawMessage.includes('NO_INTERNET') ||
    rawMessage.includes('Network request failed') ||
    rawMessage.includes('Failed to fetch') ||
    rawMessage.includes('fetch') ||
    rawMessage.includes('ECONNREFUSED') ||
    rawMessage.includes('timeout') ||
    rawMessage.includes('MOBILE_API_ERROR:')
  ) {
    return {
      category: 'network',
      severity: 'warning',
      code: 'NETWORK_OR_MOBILE_API_ERROR',
      title: 'No se pudo sincronizar',
      message:
        'La gestión quedó guardada localmente, pero no se pudo enviar al panel. Verifica que el panel esté encendido, que el celular tenga conexión y que la API móvil esté disponible.',
      rawMessage,
    };
  }

  return null;
}

export function classifyFieldError(error: unknown): FieldError {
  const rawMessage = getRawMessage(error);

  return (
    classifyOperationalRule(rawMessage) ??
    classifyGpsError(rawMessage) ??
    classifyAuthError(rawMessage) ??
    classifyEvidenceError(rawMessage) ??
    classifySyncError(rawMessage) ??
    classifyDatabaseError(rawMessage) ??
    classifyNetworkError(rawMessage) ?? {
      category: 'unknown',
      severity: 'warning',
      code: 'UNKNOWN_ERROR',
      title: 'Error no identificado',
      message: 'Ocurrió un error inesperado. Intenta nuevamente.',
      rawMessage,
    }
  );
}