import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL } from '@/lib/env';

/**
 * Privileged client (service role). SERVER ONLY. Used for exactly two things:
 *  1. issuing short-lived signed URLs after the caller's RLS read succeeded;
 *  2. executing an approved account deletion after a permission check.
 * It is never used to read or write data on behalf of a visitor.
 */
export function createServiceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !key) return null;
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
