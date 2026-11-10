import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ActionForm, SubmitButton } from '@/components/ActionForm';
import { TextField } from '../fields';
import { signUp } from '../actions';
import { getSession } from '@/lib/session';
import { safeNext } from '@/lib/safe-next';

export const metadata: Metadata = { title: 'إنشاء حساب' };

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const session = await getSession();
  if (session) redirect(session.status === 'incomplete' ? '/onboarding' : '/account');
  const nxt = safeNext(next, '');
  return (
    <div className="card accent stack">
      <div className="stack" style={{ gap: '.3rem' }}>
        <h1 style={{ fontSize: '1.45rem' }}>انضم إلى المجتمع</h1>
        <p className="muted">الخطوة ١ من ٣: أنشئ حسابك. بعدها نؤكد بريدك، ثم تكمل بيانات العضوية.</p>
      </div>
      <ActionForm action={signUp}>
        <input type="hidden" name="next" value={nxt} />
        <TextField name="email" label="البريد الإلكتروني" type="email" autoComplete="email" dirLtr />
        <TextField
          name="password"
          label="كلمة المرور"
          type="password"
          autoComplete="new-password"
          hint="٨ أحرف على الأقل، وتتضمن حرفًا ورقمًا."
        />
        <TextField name="confirm" label="تأكيد كلمة المرور" type="password" autoComplete="new-password" />
        <SubmitButton pendingLabel="جارٍ إنشاء الحساب…">إنشاء الحساب</SubmitButton>
      </ActionForm>
      <hr className="divider" />
      <p className="muted">
        لديك حساب؟ <Link href={`/auth/sign-in${nxt ? `?next=${encodeURIComponent(nxt)}` : ''}`}>تسجيل الدخول</Link>
      </p>
    </div>
  );
}
