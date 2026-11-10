import Link from 'next/link';
import { ActionForm, SubmitButton } from '@/components/ActionForm';
import { PageHead, Restricted, Alert } from '@/components/ui';
import { adminPage } from '@/lib/admin';
import { ResourceFields } from '../ResourceForm';
import { saveResource } from '../actions';

export default async function NewResource({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const gate = await adminPage('content.manage');
  if (!gate.ok) return <Restricted reason={gate.reason} />;
  const { kind: k } = await searchParams;
  const kind = k === 'tool' ? 'tool' : 'reference';
  return (
    <>
      <p><Link href={`/admin/resources?kind=${kind}`}>← {kind === 'tool' ? 'الأدوات' : 'المراجع'}</Link></p>
      <PageHead title={kind === 'tool' ? 'أداة جديدة' : 'مرجع جديد'} lead="يُحفظ السجل مسودة. لا يظهر للزوار حتى يُعتمد ويُنشر." />
      {kind === 'reference' && (
        <Alert tone="info">لا تضف مرجعًا محميًا بحقوق النشر كملف إلا بإذن صريح. يكفي رابط المصدر الأصلي.</Alert>
      )}
      <div className="card">
        <ActionForm action={saveResource.bind(null, null)} warnUnsaved>
          <ResourceFields kind={kind} />
          <div><SubmitButton pendingLabel="جارٍ الحفظ…">حفظ كمسودة</SubmitButton></div>
        </ActionForm>
      </div>
    </>
  );
}
