'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { adminAction, UUID_RE } from '@/lib/admin';
import { friendlyError } from '@/lib/errors';
import { fromLocalInput } from '@/lib/format';
import type { ActionState } from '@/lib/action';

const TIMEZONES = ['Asia/Riyadh', 'Asia/Dubai', 'Africa/Cairo', 'Asia/Amman', 'Europe/London'] as const;

const schema = z
  .object({
    title: z.string().trim().min(3, 'العنوان ٣ أحرف على الأقل.').max(200),
    summary: z.string().trim().max(400).transform((v) => v || null),
    description: z.string().trim().max(8000).transform((v) => v || null),
    event_type: z.enum(['council', 'meeting', 'workshop']),
    timezone: z.enum(TIMEZONES),
    starts_local: z.string().min(1, 'حدد موعد البداية.'),
    duration_minutes: z.coerce.number().int().min(10, '١٠ دقائق على الأقل.').max(1440),
    delivery_mode: z.enum(['online', 'in_person', 'hybrid']),
    location: z.string().trim().max(300).transform((v) => v || null),
    meeting_url: z
      .string()
      .trim()
      .max(500)
      .refine((v) => v === '' || /^https:\/\//i.test(v), 'يجب أن يبدأ الرابط بـ https://')
      .transform((v) => v || null),
    capacity: z
      .string()
      .trim()
      .refine((v) => v === '' || (/^\d+$/.test(v) && +v > 0 && +v <= 100000), 'عدد غير صالح.')
      .transform((v) => (v === '' ? null : Number(v))),
    deadline_local: z.string(),
    show_when_past: z.boolean(),
    status_note: z.string().trim().max(1000).transform((v) => v || null),
  });

export async function saveEvent(id: string | null, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const g = await adminAction('events.manage');
  if (g.error) return g.error;
  const s = (k: string) => String(fd.get(k) ?? '');
  const parsed = schema.safeParse({
    title: s('title'), summary: s('summary'), description: s('description'), event_type: s('event_type'),
    timezone: s('timezone') || 'Asia/Riyadh', starts_local: s('starts_local'), duration_minutes: s('duration_minutes') || '90',
    delivery_mode: s('delivery_mode'), location: s('location'), meeting_url: s('meeting_url'), capacity: s('capacity'),
    deadline_local: s('deadline_local'), show_when_past: fd.get('show_when_past') === 'on', status_note: s('status_note'),
  });
  if (!parsed.success) {
    const fe: Record<string, string> = {};
    for (const i of parsed.error.issues) fe[String(i.path[0])] ??= i.message;
    return { fieldErrors: fe, error: 'راجع الحقول المشار إليها.' };
  }
  const v = parsed.data;
  const starts_at = fromLocalInput(v.starts_local, v.timezone);
  if (!starts_at) return { fieldErrors: { starts_local: 'موعد غير صالح.' } };
  const registration_deadline = v.deadline_local ? fromLocalInput(v.deadline_local, v.timezone) : null;
  if (v.deadline_local && !registration_deadline) return { fieldErrors: { deadline_local: 'موعد غير صالح.' } };
  if (registration_deadline && registration_deadline > starts_at)
    return { fieldErrors: { deadline_local: 'يجب أن يسبق موعدُ إغلاق التسجيل بدايةَ الفعالية.' } };

  const row = {
    title: v.title, summary: v.summary, description: v.description, event_type: v.event_type, timezone: v.timezone,
    starts_at, duration_minutes: v.duration_minutes, delivery_mode: v.delivery_mode, location: v.location,
    capacity: v.capacity, registration_deadline, show_when_past: v.show_when_past,
    ...(id ? { status_note: v.status_note } : {}),
  };

  let eid = id;
  if (eid) {
    if (!UUID_RE.test(eid)) return { error: friendlyError('invalid_input') };
    const { data: cur } = await g.supabase.from('events').select('starts_at,status,capacity').eq('id', eid).single();
    if (cur?.status === 'published' && cur.starts_at !== starts_at && new Date(cur.starts_at).getTime() !== new Date(starts_at).getTime() && !v.status_note) {
      return { fieldErrors: { status_note: 'اكتب ملاحظة توضح سبب تغيير الموعد للمسجّلين.' }, error: 'تغيير موعد فعالية منشورة يتطلب ملاحظة.' };
    }
    if (cur && v.capacity != null) {
      const { count } = await g.supabase.from('event_registrations').select('id', { count: 'exact', head: true }).eq('event_id', eid).eq('status', 'registered');
      if ((count ?? 0) > v.capacity) return { fieldErrors: { capacity: `لا يمكن أن تقل السعة عن عدد المسجّلين الحالي (${count}).` } };
    }
    const { error } = await g.supabase.from('events').update(row).eq('id', eid);
    if (error) return { error: friendlyError(error) };
  } else {
    const { data, error } = await g.supabase.from('events').insert(row).select('id').single();
    if (error || !data) return { error: friendlyError(error) };
    eid = data.id as string;
  }
  const { error: pErr } = await g.supabase
    .from('event_private')
    .upsert({ event_id: eid, meeting_url: v.meeting_url, updated_at: new Date().toISOString() });
  if (pErr) return { error: friendlyError(pErr) };

  revalidatePath('/admin/events');
  revalidatePath('/events');
  revalidatePath(`/events/${eid}`);
  if (!id) redirect(`/admin/events/${eid}?created=1`);
  revalidatePath(`/admin/events/${eid}`);
  return { ok: true, message: 'حُفظت التعديلات.' };
}

const OPS: Record<string, { patch: (reason: string) => Record<string, unknown>; reason?: boolean; msg: string }> = {
  publish: { patch: () => ({ status: 'published' }), msg: 'نُشرت الفعالية.' },
  unpublish: { patch: () => ({ status: 'draft' }), msg: 'أُعيدت الفعالية إلى مسودة.' },
  open_reg: { patch: () => ({ registration_open: true }), msg: 'فُتح التسجيل.' },
  close_reg: { patch: () => ({ registration_open: false }), msg: 'أُغلق التسجيل.' },
  complete: { patch: () => ({ status: 'completed' }), msg: 'عُلّمت الفعالية منتهية.' },
  cancel: { patch: (r) => ({ status: 'cancelled', status_note: r }), reason: true, msg: 'أُلغيت الفعالية. أبلغ المسجّلين من قسم الإشعار.' },
  archive: { patch: (r) => ({ status: 'archived', archive_reason: r }), reason: true, msg: 'نُقلت الفعالية إلى الأرشيف مع الاحتفاظ بالتسجيلات والحضور.' },
  restore: { patch: () => ({}), msg: 'استُعيدت الفعالية.' },
};

export async function eventTransition(id: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const g = await adminAction('events.manage');
  if (g.error) return g.error;
  if (!UUID_RE.test(id)) return { error: friendlyError('invalid_input') };
  const op = OPS[String(fd.get('op') ?? '')];
  if (!op) return { error: friendlyError('invalid_transition') };
  const reason = String(fd.get('reason') ?? '').trim().slice(0, 1000);
  if (op.reason && !reason) return { error: 'اكتب السبب.' };
  let patch = op.patch(reason);
  if (fd.get('op') === 'restore') {
    const { data: cur } = await g.supabase.from('events').select('status_before_archive').eq('id', id).single();
    if (!cur?.status_before_archive) return { error: friendlyError('invalid_transition') };
    patch = { status: cur.status_before_archive };
  }
  const { data, error } = await g.supabase.from('events').update(patch).eq('id', id).select('id').maybeSingle();
  if (error) return { error: friendlyError(error) };
  if (!data) return { error: friendlyError('forbidden') };
  revalidatePath('/admin/events');
  revalidatePath(`/admin/events/${id}`);
  revalidatePath('/admin/archive');
  revalidatePath('/events');
  revalidatePath(`/events/${id}`);
  revalidatePath('/');
  return { ok: true, message: op.msg };
}

export async function setAttendance(eventId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const g = await adminAction('events.manage');
  if (g.error) return g.error;
  if (!UUID_RE.test(eventId)) return { error: friendlyError('invalid_input') };
  const ids = fd.getAll('user_id').map(String).filter((x) => UUID_RE.test(x));
  const present = new Set(fd.getAll('present').map(String));
  if (!ids.length) return { error: 'لا يوجد مسجّلون لتسجيل حضورهم.' };
  const rows = ids.map((uid) => ({ event_id: eventId, user_id: uid, attended: present.has(uid) }));
  const { error } = await g.supabase.from('event_attendance').upsert(rows, { onConflict: 'event_id,user_id' });
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/admin/events/${eventId}`);
  return { ok: true, message: `حُفظ الحضور: ${present.size} من ${ids.length}.` };
}

export async function adminCancelRegistration(eventId: string, regId: string, _prev: ActionState, _fd: FormData): Promise<ActionState> {
  const g = await adminAction('events.manage');
  if (g.error) return g.error;
  if (!UUID_RE.test(regId)) return { error: friendlyError('invalid_input') };
  const { error } = await g.supabase.from('event_registrations').update({ status: 'cancelled' }).eq('id', regId).eq('status', 'registered');
  if (error) return { error: friendlyError(error) };
  revalidatePath(`/admin/events/${eventId}`);
  revalidatePath(`/events/${eventId}`);
  redirect(`/admin/events/${eventId}`);
}
