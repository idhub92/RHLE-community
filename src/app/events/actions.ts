'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { friendlyError, isAuthError } from '@/lib/errors';
import type { ActionState } from '@/lib/action';

const UUID = /^[0-9a-f-]{36}$/i;

export async function registerForEvent(eventId: string, _prev: ActionState, _fd: FormData): Promise<ActionState> {
  if (!UUID.test(eventId)) return { error: friendlyError('event_unavailable') };
  const supabase = await createClient();
  if (!supabase) return { error: friendlyError('not_configured') };
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { sessionExpired: true, error: friendlyError('not_authenticated') };

  const { error } = await supabase.rpc('register_for_event', { p_event: eventId });
  if (error) {
    if (isAuthError(error)) return { sessionExpired: true, error: friendlyError(error) };
    return { error: friendlyError(error) };
  }
  revalidatePath(`/events/${eventId}`);
  revalidatePath('/account');
  return { ok: true, message: 'تم تأكيد تسجيلك. ستجد الفعالية في صفحة «حسابي».' };
}

export async function cancelRegistration(eventId: string, _prev: ActionState, _fd: FormData): Promise<ActionState> {
  if (!UUID.test(eventId)) return { error: friendlyError('event_unavailable') };
  const supabase = await createClient();
  if (!supabase) return { error: friendlyError('not_configured') };
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { sessionExpired: true, error: friendlyError('not_authenticated') };

  const { error } = await supabase.rpc('cancel_event_registration', { p_event: eventId });
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/events/${eventId}`);
  revalidatePath('/account');
  return { ok: true, message: 'أُلغي تسجيلك وأُتيح مقعدك لغيرك.' };
}
