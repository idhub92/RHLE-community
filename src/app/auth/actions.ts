'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { SITE_URL } from '@/lib/env';
import { safeNext } from '@/lib/safe-next';
import { friendlyError } from '@/lib/errors';
import type { ActionState } from '@/lib/action';

const email = z.string().trim().toLowerCase().email('اكتب بريدًا إلكترونيًا صحيحًا.').max(254);
const password = z
  .string()
  .min(8, 'كلمة المرور ٨ أحرف على الأقل.')
  .max(72, 'كلمة المرور طويلة جدًا.')
  .regex(/[A-Za-z؀-ۿ]/, 'أضف حرفًا واحدًا على الأقل.')
  .regex(/\d/, 'أضف رقمًا واحدًا على الأقل.');

async function siteUrl() {
  // prefer the configured URL; fall back to the request origin in development
  if (process.env.NEXT_PUBLIC_SITE_URL) return SITE_URL;
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const proto = h.get('x-forwarded-proto') ?? 'http';
  return host ? `${proto}://${host}` : SITE_URL;
}

function fieldErrors(err: z.ZodError) {
  const out: Record<string, string> = {};
  for (const i of err.issues) out[String(i.path[0])] ??= i.message;
  return out;
}

export async function signUp(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = z
    .object({ email, password, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'كلمتا المرور غير متطابقتين.' })
    .safeParse({ email: fd.get('email'), password: fd.get('password'), confirm: fd.get('confirm') });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), error: 'راجع الحقول المشار إليها.' };

  const supabase = await createClient();
  if (!supabase) return { error: friendlyError('not_configured') };

  const next = safeNext(fd.get('next'), '');
  const afterConfirm = next ? `/onboarding?next=${encodeURIComponent(next)}` : '/onboarding';
  const base = await siteUrl();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { emailRedirectTo: `${base}/auth/confirm?next=${encodeURIComponent(afterConfirm)}` },
  });

  if (error) {
    if (/already registered|already exists/i.test(error.message)) {
      return {
        error: 'هذا البريد مسجّل لدينا مسبقًا. سجّل الدخول، أو استعد كلمة المرور إن نسيتها.',
        fieldErrors: { email: 'مسجّل مسبقًا' },
      };
    }
    if (/password/i.test(error.message)) return { fieldErrors: { password: 'كلمة المرور لا تستوفي شروط الأمان.' } };
    if (/rate|too many/i.test(error.message)) return { error: 'محاولات كثيرة متتالية. انتظر قليلًا ثم أعد المحاولة.' };
    return { error: friendlyError(error) };
  }
  // Supabase returns a user with no identities when the e-mail already belongs to an account
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return {
      error: 'هذا البريد مسجّل لدينا مسبقًا. سجّل الدخول، أو استعد كلمة المرور إن نسيتها.',
      fieldErrors: { email: 'مسجّل مسبقًا' },
    };
  }
  if (data.session) {
    // e-mail confirmation disabled in the project: continue directly
    redirect(afterConfirm);
  }
  redirect(`/auth/verify?email=${encodeURIComponent(parsed.data.email)}`);
}

export async function signIn(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = z
    .object({ email, password: z.string().min(1, 'اكتب كلمة المرور.') })
    .safeParse({ email: fd.get('email'), password: fd.get('password') });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };

  const supabase = await createClient();
  if (!supabase) return { error: friendlyError('not_configured') };
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    if (/not confirmed/i.test(error.message)) {
      return { error: 'لم يُؤكَّد بريدك بعد. افتح رابط التأكيد المرسل إليك، أو اطلب رابطًا جديدًا من صفحة التأكيد.' };
    }
    if (/rate|too many/i.test(error.message)) return { error: 'محاولات كثيرة متتالية. انتظر قليلًا ثم أعد المحاولة.' };
    return { error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' };
  }
  const { data: ctx } = await supabase.rpc('my_context');
  const next = safeNext(fd.get('next'), '/account');
  if ((ctx as { status?: string } | null)?.status === 'incomplete') {
    redirect(`/onboarding?next=${encodeURIComponent(next)}`);
  }
  redirect(next);
}

export async function resendVerification(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = email.safeParse(fd.get('email'));
  if (!parsed.success) return { fieldErrors: { email: 'اكتب بريدًا إلكترونيًا صحيحًا.' } };
  const supabase = await createClient();
  if (!supabase) return { error: friendlyError('not_configured') };
  const base = await siteUrl();
  await supabase.auth.resend({
    type: 'signup',
    email: parsed.data,
    options: { emailRedirectTo: `${base}/auth/confirm?next=${encodeURIComponent('/onboarding')}` },
  });
  return { ok: true, message: 'إن كان البريد بحاجة إلى تأكيد فسيصلك رابط جديد خلال دقائق. تحقّق من مجلد الرسائل غير المرغوب فيها.' };
}

export async function requestPasswordReset(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = email.safeParse(fd.get('email'));
  if (!parsed.success) return { fieldErrors: { email: 'اكتب بريدًا إلكترونيًا صحيحًا.' } };
  const supabase = await createClient();
  if (!supabase) return { error: friendlyError('not_configured') };
  const base = await siteUrl();
  await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${base}/auth/confirm?next=${encodeURIComponent('/auth/reset')}`,
  });
  // same message whether or not the address has an account
  return {
    ok: true,
    message: 'إن كان هذا البريد مرتبطًا بحساب لدينا فسيصلك رابط لإعادة تعيين كلمة المرور خلال دقائق.',
  };
}

export async function resetPassword(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = z
    .object({ password, confirm: z.string() })
    .refine((v) => v.password === v.confirm, { path: ['confirm'], message: 'كلمتا المرور غير متطابقتين.' })
    .safeParse({ password: fd.get('password'), confirm: fd.get('confirm') });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error) };
  const supabase = await createClient();
  if (!supabase) return { error: friendlyError('not_configured') };
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { sessionExpired: true, error: 'انتهت صلاحية رابط الاستعادة. اطلب رابطًا جديدًا.' };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    if (/same|different/i.test(error.message)) return { fieldErrors: { password: 'اختر كلمة مرور مختلفة عن السابقة.' } };
    return { error: friendlyError(error) };
  }
  redirect('/account?password=updated');
}

export async function signOut() {
  const supabase = await createClient();
  if (supabase) await supabase.auth.signOut();
  redirect('/');
}
