import Link from 'next/link';
import { ActionForm, SubmitButton } from '@/components/ActionForm';
import { PageHead, Restricted } from '@/components/ui';
import { adminPage } from '@/lib/admin';
import { EventFields } from '../EventForm';
import { saveEvent } from '../actions';

export default async function NewEvent() {
  const gate = await adminPage('events.manage');
  if (!gate.ok) return <Restricted reason={gate.reason} />;
  return (
    <>
      <p><Link href="/admin/events">← الفعاليات</Link></p>
      <PageHead title="فعالية جديدة" lead="تُحفظ مسودة لا يراها الزوار حتى تنشرها." />
      <div className="card">
        <ActionForm action={saveEvent.bind(null, null)} warnUnsaved>
          <EventFields />
          <div><SubmitButton pendingLabel="جارٍ الحفظ…">حفظ كمسودة</SubmitButton></div>
        </ActionForm>
      </div>
    </>
  );
}
