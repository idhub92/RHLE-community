import 'server-only';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { SUPABASE_ANON_KEY, SUPABASE_URL, isConfigured } from '@/lib/env';

/**
 * Request-scoped Supabase client acting as the signed-in user (or anon).
 * All authorisation is enforced by Postgres RLS for this client.
 */
export async function createClient() {
  if (!isConfigured) return null;
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(toSet) {
        try {
          toSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // called from a Server Component: the middleware refreshes the session instead
        }
      },
    },
  });
}

export type Supa = NonNullable<Awaited<ReturnType<typeof createClient>>>;
