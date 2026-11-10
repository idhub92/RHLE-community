import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActionForm, SubmitButton } from '@/components/ActionForm';
import { Alert, PageHead, Restricted, StatusBadge } from '@/components/ui';
import { adminPage, staffNames, UUID_RE } from '@/lib/admin';
import { CONTENT_STATUS_LABEL } from '@/lib/labels';
import { fmtDateTime } from '@/lib/format';
import type { ResourceRow } from '@/lib/data';
import { ResourceFields } from '../ResourceForm';
import { ResourceWorkflow } from '../Workflow';
import { saveResource } from '../actions';

export default async function EditResource({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const gate = await adminPage('content.manage');
  if (!gate.ok) return <Restricted reason={gate.reason} />;
  const { id } = await params;
  const sp = await searchParams;
  if (!UUID_RE.test(id)) notFound();
  const { data } = await gate.supabase.from('resources').select('*').eq('id', id).maybeSingle();
  if (!data) notFound();
  const r = data as ResourceRow;
  const names = await staffNames(gate.supabase, [r.created_by, r.submitted_by, r.reviewed_by, r.archived_by]);
  const n = (x: string | null) => (x ? names[x] ?? 'عضو فريق' : '—');
  const archived = r.status === 'archived';

  return (
    <>
      <p><Link href={archived ? '/admin/archive' : `/admin/resources?kind=${r.kind}`}>← {archived ? 'الأرشيف' : r.kind === 'tool' ? 'الأدوات' : 'المراجع'}</Link></p>
      <PageHead
        title={r.title}
        eyebrow={r.kind === 'tool' ? 'أداة' : 'مرجع'}
        actions={<><StatusBadge status={r.status} labels={CONTENT_STATUS_LABEL} /><Link className="btn secondary sm" href={`/admin/resources/${id}/preview`}>معاينة</Link></>}
      />
      {sp.created && <Alert tone="success">أُنشئت المسودة. أرسلها للمراجعة عند اكتمالها.</Alert>}
      {r.status === 'draft' && r.review_note && <Alert tone="warning" title="ملاحظة المراجعة">{r.review_note}</Alert>}
      {archived && <Alert tone="warning" title="سجل مؤرشف">السبب: {r.archive_reason}. لا يمكن تعديله قبل استعادته.</Alert>}
      {r.status === 'published' && <Alert tone="info">هذا المحتوى منشور؛ أي تعديل تحفظه يظهر للزوار مباشرة.</Alert>}

      <div className="grid-2" style={{ gridTemplateColumns: 'minmax(0, 2fr) minmax(240px, 1fr)', alignItems: 'start' }}>
        <div className="card">
          <ActionForm action={saveResource.bind(null, id)} warnUnsaved>
            <ResourceFields kind={r.kind} v={r} disabled={archived} />
            {!archived && <div><SubmitButton pendingLabel="جارٍ الحفظ…">حفظ التعديلات</SubmitButton></div>}
          </ActionForm>
        </div>
        <aside className="stack">
          <div className="card stack">
            <h2 style={{ fontSize: '1.05rem' }}>سير العمل</h2>
            <ResourceWorkflow id={id} status={r.status} before={r.status_before_archive} isAdmin={gate.session.can('platform.admin')} />
          </div>
          <div className="card stack">
            <h2 style={{ fontSize: '1.05rem' }}>السجل</h2>
            <dl className="kv" style={{ fontSize: '.86rem' }}>
              <dt>الإنشاء</dt><dd>{n(r.created_by)}<div className="faint">{fmtDateTime(r.created_at)}</div></dd>
              {r.submitted_at && (<><dt>الإرسال للمراجعة</dt><dd>{n(r.submitted_by)}<div className="faint">{fmtDateTime(r.submitted_at)}</div></dd></>)}
              {r.reviewed_at && (<><dt>المراجعة</dt><dd>{n(r.reviewed_by)}<div className="faint">{fmtDateTime(r.reviewed_at)}</div></dd></>)}
              {r.published_at && (<><dt>النشر</dt><dd className="faint">{fmtDateTime(r.published_at)}</dd></>)}
              {r.archived_at && (<><dt>الأرشفة</dt><dd>{n(r.archived_by)}<div className="faint">{fmtDateTime(r.archived_at)}</div></dd></>)}
            </dl>
          </div>
        </aside>
      </div>
    </>
  );
}
