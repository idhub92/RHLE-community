import type { Metadata } from 'next';
import Link from 'next/link';
import { ActionForm, SubmitButton } from '@/components/ActionForm';
import { TextField } from '../fields';
import { resendVerification } from '../actions';

export const metadata: Metadata = { title: 'تأكيد البريد الإلكتروني' };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email } = await searchParams;
  return (
    <div className="card accent stack">
      <h1 style={{ fontSize: '1.45rem' }}>أكّد بريدك الإلكتروني</h1>
      <p className="muted">
        الخطوة ٢ من ٣: أرسلنا رابط تأكيد إلى {email ? <strong className="ltr">{email}</strong> : 'بريدك'}. افتح الرابط من الجهاز نفسه
        لتنتقل مباشرة إلى إكمال بيانات العضوية.
      </p>
      <hr className="divider" />
      <h2 style={{ fontSize: '1.05rem' }}>لم تصلك الرسالة؟</h2>
      <p className="faint">تحقّق من مجلد الرسائل غير المرغوب فيها، ثم اطلب رابطًا جديدًا.</p>
      <ActionForm action={resendVerification}>
        <TextField name="email" label="البريد الإلكتروني" type="email" autoComplete="email" dirLtr defaultValue={email} />
        <div><SubmitButton className="btn secondary">إرسال الرابط مرة أخرى</SubmitButton></div>
      </ActionForm>
      <p className="muted"><Link href="/auth/sign-in">العودة إلى تسجيل الدخول</Link></p>
    </div>
  );
}
