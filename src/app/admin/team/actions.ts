'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { adminAction, UUID_RE } from '@/lib/admin';
import { friendlyError } from '@/lib/errors';
import type { ActionState } from '@/lib/action';

export async function grantRole(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const g = await adminAction('permissions.manage');
  if (g.error) return g.error;
  const email = String(fd.get('email') ?? '').trim();
  const roleId = String(fd.get('role_id') ?? '');
  if (!z.string().email().safeParse(email).success) return { fieldErrors: { email: 'اكتب بريدًا صحيحًا.' } };
  if (!UUID_RE.test(roleId)) return { fieldErrors: { role_id: 'اختر الدور.' } };
  const { data: uid, error: fErr } = await g.supabase.rpc('find_user_by_email', { p_email: email });
  if (fErr) return { error: friendlyError(fErr) };
  if (!uid) return { fieldErrors: { email: 'لا يوجد حساب مؤكَّد بهذا البريد. يجب أن ينشئ الشخص حسابه بنفسه أولًا.' } };
  const { error } = await g.supabase.from('user_roles').insert({ user_id: uid, role_id: roleId });
  if (error) return { error: error.code === '23505' ? 'لدى هذا الحساب الدور نفسه مسبقًا.' : friendlyError(error) };
  revalidatePath('/admin/team');
  return { ok: true, message: 'مُنح الدور. يسري فورًا حتى في الجلسات المفتوحة.' };
}

export async function revokeRole(userId: string, roleId: string, _prev: ActionState, _fd: FormData): Promise<ActionState> {
  const g = await adminAction('permissions.manage');
  if (g.error) return g.error;
  if (!UUID_RE.test(userId) || !UUID_RE.test(roleId)) return { error: friendlyError('invalid_input') };
  const { error, count } = await g.supabase.from('user_roles').delete({ count: 'exact' }).eq('user_id', userId).eq('role_id', roleId);
  if (error) return { error: friendlyError(error) };
  if (!count) return { error: friendlyError('forbidden') };
  revalidatePath('/admin/team');
  return { ok: true, message: 'سُحب الدور، ويسري ذلك فورًا.' };
}

export async function setTitle(userId: string, _prev: ActionState, fd: FormData): Promise<ActionState> {
  const g = await adminAction('permissions.manage');
  if (g.error) return g.error;
  if (!UUID_RE.test(userId)) return { error: friendlyError('invalid_input') };
  const title = String(fd.get('public_title') ?? '').trim();
  const sort = Number(fd.get('sort_order') ?? 100) || 100;
  if (!title) {
    const { error } = await g.supabase.from('team_titles').delete().eq('user_id', userId);
    if (error) return { error: friendlyError(error) };
  } else {
    if (title.length < 2 || title.length > 80) return { error: 'اللقب من حرفين إلى ٨٠ حرفًا.' };
    const { error } = await g.supabase.from('team_titles').upsert({ user_id: userId, public_title: title, sort_order: sort });
    if (error) return { error: friendlyError(error) };
  }
  revalidatePath('/admin/team');
  revalidatePath('/about');
  return { ok: true, message: title ? 'حُفظ اللقب العام.' : 'أُزيل اللقب العام.' };
}

export async function createRole(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const g = await adminAction('platform.admin');
  if (g.error) return g.error;
  const key = String(fd.get('key') ?? '').trim();
  const name = String(fd.get('name_ar') ?? '').trim();
  const perms = fd.getAll('perm').map(String);
  if (!/^[a-z_]{3,40}$/.test(key)) return { fieldErrors: { key: 'أحرف إنجليزية صغيرة وشرطة سفلية فقط (٣–٤٠).' } };
  if (name.length < 2) return { fieldErrors: { name_ar: 'اكتب اسم الدور.' } };
  if (!perms.length) return { error: 'اختر صلاحية واحدة على الأقل.' };
  const { data, error } = await g.supabase.from('roles').insert({ key, name_ar: name, description_ar: String(fd.get('description_ar') ?? '').trim() || null }).select('id').single();
  if (error || !data) return { error: error?.code === '23505' ? 'المعرّف مستخدم مسبقًا.' : friendlyError(error) };
  const { error: pErr } = await g.supabase.from('role_permissions').insert(perms.map((p) => ({ role_id: data.id, permission_key: p })));
  if (pErr) return { error: friendlyError(pErr) };
  revalidatePath('/admin/team');
  return { ok: true, message: 'أُنشئ الدور.' };
}
