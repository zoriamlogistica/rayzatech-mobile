// src/infrastructure/supabase/mobileSupabaseClient.ts

import { createClient } from '@supabase/supabase-js';

function assertPresent(name: string, value?: string): string {
  if (!value || !value.trim()) {
    throw new Error(`MISSING_${name}`);
  }

  return value.trim();
}

function assertHttpUrl(name: string, value: string): void {
  if (!value.startsWith('http://') && !value.startsWith('https://')) {
    throw new Error(`${name}_MUST_BE_HTTP_URL`);
  }
}

export function createMobileSupabaseClient() {
  const supabaseUrl = assertPresent(
    'EXPO_PUBLIC_SUPABASE_URL',
    process.env.EXPO_PUBLIC_SUPABASE_URL
  );

  const supabaseAnonKey = assertPresent(
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  );

  assertHttpUrl('EXPO_PUBLIC_SUPABASE_URL', supabaseUrl);

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}