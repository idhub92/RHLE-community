import Link from 'next/link';
import { EmptyState, PageHead, Restricted, StatusBadge, Alert, DraftFlag } from '@/components/ui';
import { adminPage } from '@/lib/admin';
import { CONTENT_STATUS_LABEL, RESOURCE_TYPE_LABEL } from '@/lib/labels';
import { fmtShort } from '@/lib/format';

type SP = Promise<{ kind?: string; status?: string; q?: string; deleted?: string }>;

export default async function AdminResources({ searchParams }: { searchParams: SP }) {
  const gate = await adminPage('content.manage');
  if (!gate.ok) return <Restricted reason={gate.reason} />;
  const sp = await searchParams;
  const kind = sp.kind === 'tool' ? 'tool' : 'reference';
  const status = ['draft', 'in_review', 'published'].includes(sp.status ?? '') ? sp.status! : '';

  let q = gate.supabase
    .from('resources')
    .select('id,title,resource_type,status,is_initial_draft,updated_at,review_note')
    .eq('kind', kind)
    .neq('status', 'archived')
    .order('updated_at', { ascending: false });
  if (status) q = q.eq('status', status);
  if (sp.q) q = q.ilike('title', `%${sp.q.replace(/[%,()]/g, ' ').slice(0, 80)}%`);
  const { data } = await q;
  const label = kind === 'tool' ? 'الأدوات' : 'المراجع';
  const base = `/admin/resources?kind=${kind}`;

  return (
    <>
      <PageHead
        title={label}
        lead="دورة المحتوى: مسودة ← قيد المراجعة ← منشور ← مؤرشف. المؤرشف يظهر في صفحة الأرشيف."
        actions={<Link className="btn" href={`/admin/resources/new?kind=${kind}`}>{kind === 'tool' ? 'أداة جديدة' : 'مرجع جديد'}</Link>}
      />
      {sp.deleted && <Alert tone="success">حُذف السجل نهائيًا.</Alert>}
      <nav className="tabs" aria-label="الحالة">
        {[['', 'الكل'], ['draft', 'مسودات'], ['in_review', 'قيد المراجعة'], ['published', 'منشور']].map(([s, l]) => (
          <Link key={s} href={`${base}${s ? `&status=${s}` : ''}`} aria-current={status === s ? 'page' : undefined}>{l}</Link>
        ))}
      </nav>
      <form className="toolbar" method="get" action="/admin/resources" role="search">
        <input type="hidden" name="kind" value={kind} />
        {status && <input type="hidden" name="status" value={status} />}
        <div className="field"><label htmlFor="q">بحث بالعنوان</label><input id="q" name="q" className="input" defaultValue={sp.q} /></div>
        <button className="btn secondary" type="submit">بحث</button>
      </form>
      {data?.length ? (
        <div className="table-wrap">
          <table>
            <thead><tr><th>العنوان</th><th>النوع</th><th>الحالة</th><th>آخر تحديث</th></tr></thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/admin/resources/${r.id}`}>{r.title}</Link>
                    {kind === 'tool' && r.is_initial_draft && <div><DraftFlag /></div>}
                    {r.status === 'draft' && r.review_note && <div className="faint">أُعيد بملاحظة: {r.review_note}</div>}
                  </td>
                  <td>{RESOURCE_TYPE_LABEL[r.resource_type]}</td>
                  <td><StatusBadge status={r.status} labels={CONTENT_STATUS_LABEL} /></td>
                  <td className="faint">{fmtShort(r.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <EmptyState title={`لا توجد ${label} ${status ? 'بهذه الحالة' : 'بعد'}`} action={<Link className="btn secondary" href={`/admin/resources/new?kind=${kind}`}>إضافة</Link>} />
      )}
    </>
  );
}
