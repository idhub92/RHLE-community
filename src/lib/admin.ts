import 'server-only';
import { createClient, type Supa } from '@/lib/supabase/server';
import { getSession, type Permission, type SessionContext } from '@/lib/session';
import { friendlyError } from '@/lib/errors';
import type { ActionState } from '@/lib/action';

/**
 * Server-side permission gate for admin pages. RLS is the real enforcement;
 * this only decides what to render. Permissions are re-read on every request.
 */
export async function adminPage(p?: Permission): Promise<
  { ok: true; session: SessionContext; supabase: Supa } | { ok: false; reason: string }
> {
  const session = await getSession();
  const supabase = await createClient();
  if (!session || !supabase) return { ok: false, reason: 'سجّل الدخول بحساب مخوّل للوصول إلى الإدارة.' };
  if (!session.isTeam) return { ok: false, reason: 'هذه الصفحة متاحة لأعضاء فريق التشغيل المخوّلين فقط.' };
  if (p && !session.can(p)) return { ok: false, reason: 'لا تملك الصلاحية المطلوبة لهذه الصفحة.' };
  return { ok: true, session, supabase };
}

/** Same gate for server actions; returns an ActionState error instead of rendering. */
export async function adminAction(
  p: Permission
): Promise<{ supabase: Supa; session: SessionContext; error?: undefined } | { error: ActionState }> {
  const supabase = await createClient();
  if (!supabase) return { error: { error: friendlyError('not_configured') } };
  const session = await getSession();
  if (!session) return { error: { sessionExpired: true, error: friendlyError('not_authenticated') } };
  if (!session.can(p)) return { error: { error: friendlyError('forbidden') } };
  return { supabase, session };
}

export async function staffNames(supabase: Supa, ids: (string | null | undefined)[]) {
  const uniq = Array.from(new Set(ids.filter(Boolean))) as string[];
  if (!uniq.length) return {} as Record<string, string>;
  const { data } = await supabase.rpc('staff_names', { p_ids: uniq });
  const out: Record<string, string> = {};
  for (const r of (data ?? []) as { user_id: string; full_name: string | null }[]) out[r.user_id] = r.full_name ?? 'عضو فريق';
  return out;
}

export const UUID_RE = /^[0-9a-f-]{36}$/i;
