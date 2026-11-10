import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ActionForm, SubmitButton } from '@/components/ActionForm';
import { Alert } from '@/components/ui';
import { TextField } from '../fields';
import { signIn } from '../actions';
import { getSession } from '@/lib/session';
import { safeNext } from '@/lib/safe-next';

export const metadata: Metadata = { title: 'تسجيل الدخول' };

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; expired?: string; confirmed?: string }>;
}) {
  const sp = await searchParams;
  const nxt = safeNext(sp.next, '');
  const session = await getSession();
  if (session) redirect(nxt || '/account');
  return (
    <div className="card accent stack">
      <h1 style={{ fontSize: '1.45rem' }}>تسجيل الدخول</h1>
      {sp.expired && <Alert tone="warning">انتهت جلستك السابقة. سجّل الدخول للمتابعة.</Alert>}
      {sp.confirmed && <Alert tone="success">تم تأكيد بريدك. سجّل الدخول لإكمال عضويتك.</Alert>}
      {nxt.startsWith('/events/') && (
        <Alert tone="info">سجّل الدخول وستعود إلى صفحة الفعالية لإتمام التسجيل.</Alert>
      )}
      <ActionForm action={signIn}>
        <input type="hidden" name="next" value={nxt} />
        <TextField name="email" label="البريد الإلكتروني" type="email" autoComplete="email" dirLtr />
        <TextField name="password" label="كلمة المرور" type="password" autoComplete="current-password" />
        <div className="row-between">
          <SubmitButton pendingLabel="جارٍ الدخول…">دخول</SubmitButton>
          <Link href="/auth/forgot">نسيت كلمة المرور؟</Link>
        </div>
      </ActionForm>
      <hr className="divider" />
      <p className="muted">
        لست عضوًا بعد؟ <Link href={`/auth/sign-up${nxt ? `?next=${encodeURIComponent(nxt)}` : ''}`}>انضم إلى المجتمع</Link>
      </p>
    </div>
  );
}
