import type { Metadata } from 'next';
import { ActionForm, SubmitButton } from '@/components/ActionForm';
import { TextField } from '../fields';
import { resetPassword } from '../actions';

export const metadata: Metadata = { title: 'تعيين كلمة مرور جديدة' };

/* Reached from the recovery e-mail: /auth/confirm establishes a short-lived session first. */
export default function ResetPage() {
  return (
    <div className="card accent stack">
      <h1 style={{ fontSize: '1.45rem' }}>تعيين كلمة مرور جديدة</h1>
      <ActionForm action={resetPassword}>
        <TextField name="password" label="كلمة المرور الجديدة" type="password" autoComplete="new-password" hint="٨ أحرف على الأقل، وتتضمن حرفًا ورقمًا." />
        <TextField name="confirm" label="تأكيد كلمة المرور" type="password" autoComplete="new-password" />
        <div><SubmitButton>حفظ كلمة المرور</SubmitButton></div>
      </ActionForm>
    </div>
  );
}
