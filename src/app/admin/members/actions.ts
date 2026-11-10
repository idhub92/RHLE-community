'use server';

import { revalidatePath } from 'next/cache';
import { adminAction, UUID_RE } from '@/lib/admin';
import { createServiceClient } from '@/lib/supabase/admin';
import { friendlyError } from '@/lib/errors';
import type { ActionState } from '@/lib/action';

const ALLOWED = ['active', 'suspended', 'closed'] as const;

export async function setMemberStatus(userId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const g = await adminAction('members.manage');
  if (g.error) return g.error;
  const status = String(fd.get('status') ?? '');
  if (!UUID_RE.test(userId) || !ALLOWED.includes(status as (typeof ALLOWED)[number])) return { error: friendlyError('invalid_input') };
  const reason = String(fd.get('reason') ?? '').trim().slice(0, 500);
  if (status !== 'active' && !reason) return { error: 'اكتب السبب.' };
  const { data, error } = await g.supabase
    .from('memberships')
    .update({ status, status_reason: status === 'active' ? null : reason })
    .eq('user_id', userId)
    .select('user_id')
    .maybeSingle();
  if (error) return { error: friendlyError(error) };
  if (!data) return { error: friendlyError('forbidden') };
  revalidatePath('/admin/members');
  return { ok: true, message: 'حُدّثت حالة العضوية.' };
}

export async function handleAccountRequest(reqId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const op = String(fd.get('op') ?? '');
  const g = await adminAction(op === 'delete' ? 'platform.admin' : 'members.manage');
  if (g.error) return g.error;
  if (!UUID_RE.test(reqId)) return { error: friendlyError('invalid_input') };
  const { data: req } = await g.supabase.from('account_requests').select('id,user_id,kind,status').eq('id', reqId).maybeSingle();
  if (!req || req.status !== 'pending') return { error: 'الطلب غير موجود أو عولج مسبقًا.' };
  const note = String(fd.get('reason') ?? '').trim().slice(0, 1000) || null;
  const stamp = { handled_by: g.session.userId, handled_at: new Date().toISOString(), handler_note: note };

  if (op === 'reject') {
    if (!note) return { error: 'اكتب سبب الرفض.' };
    const { error } = await g.supabase.from('account_requests').update({ status: 'rejected', ...stamp }).eq('id', reqId);
    if (error) return { error: friendlyError(error) };
  } else if (op === 'close') {
    const { error: mErr } = await g.supabase.from('memberships').update({ status: 'closed', status_reason: 'بناءً على طلب العضو' }).eq('user_id', req.user_id);
    if (mErr) return { error: friendlyError(mErr) };
    const { error } = await g.supabase.from('account_requests').update({ status: 'completed', ...stamp }).eq('id', reqId);
    if (error) return { error: friendlyError(error) };
  } else if (op === 'delete') {
    if (req.kind !== 'deletion') return { error: friendlyError('invalid_input') };
    if (req.user_id === g.session.userId) return { error: 'لا يمكنك حذف حسابك من هنا.' };
    // mark the request done first (it is removed with the account by cascade)
    await g.supabase.from('account_requests').update({ status: 'completed', ...stamp }).eq('id', reqId);
    const admin = createServiceClient();
    if (!admin) return { error: 'حذف الحسابات يتطلب ضبط مفتاح الخدمة على الخادم.' };
    const { error } = await admin.auth.admin.deleteUser(req.user_id);
    if (error) return { error: 'تعذّر حذف الحساب. أعد المحاولة.' };
  } else {
    return { error: friendlyError('invalid_input') };
  }
  revalidatePath('/admin/members');
  return { ok: true, message: 'عولج الطلب.' };
}
