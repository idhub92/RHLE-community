import Link from 'next/link';
import { ActionForm, SubmitButton } from '@/components/ActionForm';
import { PageHead, Restricted } from '@/components/ui';
import { adminPage, UUID_RE } from '@/lib/admin';
import { notFound } from 'next/navigation';
import { adminCancelRegistration } from '../../../actions';

/* Separate confirmation page: nested forms are not allowed inside the attendance form. */
export default async function CancelRegistrationPage({ params, searchParams }: { params: Promise<{ id: string; regId: string }>; searchParams: Promise<{ name?: string }> }) {
  const gate = await adminPage('events.manage');
  if (!gate.ok) return <Restricted reason={gate.reason} />;
  const { id, regId } = await params;
  const { name } = await searchParams;
  if (!UUID_RE.test(id) || !UUID_RE.test(regId)) notFound();
  return (
    <div className="narrow">
      <PageHead title="إلغاء تسجيل عضو" />
      <div className="card stack">
        <p>سيُلغى تسجيل <strong>{name || 'العضو'}</strong> في هذه الفعالية ويُتاح مقعده. لا تُرسل له رسالة تلقائيًا.</p>
        <ActionForm action={adminCancelRegistration.bind(null, id, regId)}>
          <div className="row">
            <SubmitButton className="btn danger">تأكيد الإلغاء</SubmitButton>
            <Link className="btn secondary" href={`/admin/events/${id}`}>العودة</Link>
          </div>
        </ActionForm>
      </div>
    </div>
  );
}
