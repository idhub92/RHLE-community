'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { adminAction } from '@/lib/admin';
import { friendlyError } from '@/lib/errors';
import type { ActionState } from '@/lib/action';

export async function saveSettings(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const g = await adminAction('platform.admin');
  if (g.error) return g.error;
  const wa = String(fd.get('whatsapp_invite_url') ?? '').trim();
  const contact = String(fd.get('contact_email') ?? '').trim();
  const fe: Record<string, string> = {};
  if (wa && !/^https:\/\/(chat\.whatsapp\.com|wa\.me)\//i.test(wa)) fe.whatsapp_invite_url = 'استخدم رابط دعوة واتساب الرسمي (https://chat.whatsapp.com/...).';
  if (contact && !z.string().email().safeParse(contact).success) fe.contact_email = 'بريد غير صالح.';
  const num = (k: string) => {
    const v = Number(fd.get(k));
    if (!Number.isInteger(v) || v < 0 || v > 100000) fe[k] = 'رقم غير صالح.';
    return v;
  };
  const targets = { members: num('t_members'), references: num('t_references'), tools: num('t_tools'), events: num('t_events') };
  const start = String(fd.get('p_start') ?? '');
  const end = String(fd.get('p_end') ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end) || end < start) fe.p_end = 'تحقّق من تاريخي البداية والنهاية.';
  if (Object.keys(fe).length) return { fieldErrors: fe, error: 'راجع الحقول المشار إليها.' };

  // jsonb NOT NULL: an empty string means "not set"
  const rows: { key: string; value: unknown; visibility: string }[] = [
    { key: 'whatsapp_invite_url', value: wa, visibility: 'members' },
    { key: 'contact_email', value: contact, visibility: 'public' },
    { key: 'pilot_targets', value: targets, visibility: 'admin' },
    { key: 'pilot_period', value: { start, end }, visibility: 'admin' },
  ];
  for (const r of rows) {
    const { error } = await g.supabase.from('settings').upsert(r);
    if (error) return { error: friendlyError(error) };
  }
  revalidatePath('/', 'layout');
  return { ok: true, message: 'حُفظت الإعدادات.' };
}

export async function publishPolicy(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const g = await adminAction('platform.admin');
  if (g.error) return g.error;
  const version = String(fd.get('version') ?? '').trim();
  const body = String(fd.get('body') ?? '').trim();
  if (!version || !body) return { error: 'اكتب رقم النسخة والنص.' };
  const { error } = await g.supabase.rpc('publish_policy', { p_version: version, p_title: String(fd.get('title') ?? ''), p_body: body });
  if (error) return { error: error.code === '23505' ? 'رقم النسخة مستخدم مسبقًا.' : friendlyError(error) };
  revalidatePath('/policy');
  revalidatePath('/admin/settings');
  return { ok: true, message: 'نُشرت النسخة الجديدة. سيُطلب من الأعضاء تأكيد موافقتهم عليها من «حسابي».' };
}
