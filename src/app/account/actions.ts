'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { friendlyError, isAuthError } from '@/lib/errors';
import { safeNext } from '@/lib/safe-next';
import type { ActionState } from '@/lib/action';

const CATEGORIES = ['student', 'practitioner', 'interested'] as const;

const profileSchema = z.object({
  full_name: z.string().trim().min(2, 'اكتب الاسم الكامل.').max(120, 'الاسم طويل جدًا.'),
  category: z.enum(CATEGORIES, { errorMap: () => ({ message: 'اختر الفئة المهنية.' }) }),
  institution: z.string().trim().max(160, '١٦٠ حرفًا كحد أقصى.').optional().default(''),
  bio: z.string().trim().max(600, '٦٠٠ حرف كحد أقصى.').optional().default(''),
  interests: z.string().trim().max(400).optional().default(''),
});

function parseProfile(fd: FormData) {
  return profileSchema.safeParse({
    full_name: fd.get('full_name') ?? '',
    category: fd.get('category') ?? '',
    institution: fd.get('institution') ?? '',
    bio: fd.get('bio') ?? '',
    interests: fd.get('interests') ?? '',
  });
}

function splitInterests(s: string) {
  return s
    .split(/[،,\n]/)
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 10)
    .map((x) => x.slice(0, 40));
}

function errs(e: z.ZodError) {
  const out: Record<string, string> = {};
  for (const i of e.issues) out[String(i.path[0])] ??= i.message;
  return out;
}

/** Membership completion. The database validates again and activates atomically. */
export async function completeMembership(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = parseProfile(fd);
  const fieldErrors = parsed.success ? {} : errs(parsed.error);
  if (fd.get('accept_policy') !== 'on') fieldErrors.accept_policy = 'يلزم الاطلاع على السياسة والموافقة عليها.';
  if (!parsed.success || Object.keys(fieldErrors).length) return { fieldErrors, error: 'راجع الحقول المشار إليها.' };

  const supabase = await createClient();
  if (!supabase) return { error: friendlyError('not_configured') };
  const { error } = await supabase.rpc('complete_membership', {
    p_full_name: parsed.data.full_name,
    p_category: parsed.data.category,
    p_institution: parsed.data.institution,
    p_bio: parsed.data.bio,
    p_interests: splitInterests(parsed.data.interests),
    p_policy_version: String(fd.get('policy_version') ?? ''),
  });
  if (error) {
    if (isAuthError(error)) return { sessionExpired: true, error: friendlyError(error) };
    return { error: friendlyError(error) };
  }
  const next = safeNext(fd.get('next'), '');
  redirect(`/welcome${next ? `?next=${encodeURIComponent(next)}` : ''}`);
}

/** Members edit only allow-listed profile fields (the DB grants nothing else). */
export async function updateProfile(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = parseProfile(fd);
  if (!parsed.success) return { fieldErrors: errs(parsed.error), error: 'راجع الحقول المشار إليها.' };
  const supabase = await createClient();
  if (!supabase) return { error: friendlyError('not_configured') };
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { sessionExpired: true, error: friendlyError('not_authenticated') };

  const { data, error } = await supabase
    .from('profiles')
    .update({
      full_name: parsed.data.full_name,
      category: parsed.data.category,
      institution: parsed.data.institution || null,
      bio: parsed.data.bio || null,
      interests: splitInterests(parsed.data.interests),
    })
    .eq('id', auth.user.id)
    .select('id');
  if (error) return { error: friendlyError(error) };
  if (!data?.length) return { error: 'لا يمكن تعديل البيانات في حالة عضويتك الحالية.' };
  revalidatePath('/account');
  return { ok: true, message: 'حُفظت بياناتك.' };
}

export async function acceptCurrentPolicy(_prev: ActionState, fd: FormData): Promise<ActionState> {
  if (fd.get('accept_policy') !== 'on') return { fieldErrors: { accept_policy: 'يلزم تأكيد الموافقة.' } };
  const supabase = await createClient();
  if (!supabase) return { error: friendlyError('not_configured') };
  const { error } = await supabase.rpc('accept_current_policy');
  if (error) return { error: friendlyError(error) };
  revalidatePath('/account');
  return { ok: true, message: 'سُجّلت موافقتك على النسخة الحالية.' };
}

export async function changePassword(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const supabase = await createClient();
  if (!supabase) return { error: friendlyError('not_configured') };
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user?.email) return { sessionExpired: true, error: friendlyError('not_authenticated') };
  const current = String(fd.get('current_password') ?? '');
  const pw = String(fd.get('password') ?? '');
  const confirm = String(fd.get('confirm') ?? '');
  if (pw.length < 8 || !/\d/.test(pw) || !/[A-Za-z؀-ۿ]/.test(pw))
    return { fieldErrors: { password: '٨ أحرف على الأقل، وتتضمن حرفًا ورقمًا.' } };
  if (pw !== confirm) return { fieldErrors: { confirm: 'كلمتا المرور غير متطابقتين.' } };
  // re-authenticate before changing the password
  const { error: reauth } = await supabase.auth.signInWithPassword({ email: auth.user.email, password: current });
  if (reauth) return { fieldErrors: { current_password: 'كلمة المرور الحالية غير صحيحة.' } };
  const { error } = await supabase.auth.updateUser({ password: pw });
  if (error) return { error: friendlyError(error) };
  return { ok: true, message: 'تم تغيير كلمة المرور.' };
}

export async function requestAccountChange(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const kind = fd.get('kind');
  if (kind !== 'closure' && kind !== 'deletion') return { error: friendlyError('invalid_input') };
  const reason = String(fd.get('reason') ?? '').trim().slice(0, 1000);
  const supabase = await createClient();
  if (!supabase) return { error: friendlyError('not_configured') };
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { sessionExpired: true, error: friendlyError('not_authenticated') };
  const { error } = await supabase.from('account_requests').insert({ user_id: auth.user.id, kind, reason: reason || null });
  if (error) {
    if (error.code === '23505') return { error: 'لديك طلب قيد المعالجة بالفعل.' };
    return { error: friendlyError(error) };
  }
  revalidatePath('/account');
  return { ok: true, message: 'استلمنا طلبك، وسيعالجه فريق العضويات يدويًا. ستبقى بياناتك كما هي حتى تنفيذ الطلب.' };
}
