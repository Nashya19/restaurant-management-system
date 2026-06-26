import { createClient } from '@supabase/supabase-js';

export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const fallbackKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const resolvedKey = serviceRoleKey || fallbackKey;

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not defined');
  }

  if (!resolvedKey) {
    throw new Error('No Supabase key available. Set SUPABASE_SERVICE_ROLE_KEY for admin actions.');
  }

  if (!serviceRoleKey) {
    console.warn('[supabase] SUPABASE_SERVICE_ROLE_KEY is missing; falling back to anon key. Admin-only actions may be limited by RLS.');
  }

  return createClient(supabaseUrl, resolvedKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
