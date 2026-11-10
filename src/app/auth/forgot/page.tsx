import type { Metadata } from 'next';
import Link from 'next/link';
import { ActionForm, SubmitButton } from '@/components/ActionForm';
import { TextField } from '../fields';
import { requestPasswordReset } from '../actions';

export const metadata: Metadata = { title: 'استعادة كلمة المرور' };

export default function ForgotPage() {
  return (
    <div className="card accent stack">
      <h1 style={{ fontSize: '1.45rem' }}>استعادة كلمة المرور</h1>
      <p className="muted">اكتب بريدك وسنرسل إليه رابطًا لتعيين كلمة مرور جديدة.</p>
      <ActionForm action={requestPasswordReset}>
        <TextField name="email" label="البريد الإلكتروني" type="email" autoComplete="email" dirLtr />
        <div><SubmitButton>إرسال رابط الاستعادة</SubmitButton></div>
      </ActionForm>
      <p className="muted"><Link href="/auth/sign-in">العودة إلى تسجيل الدخول</Link></p>
    </div>
  );
}
