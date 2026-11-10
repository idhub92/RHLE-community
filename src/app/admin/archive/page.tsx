import Link from 'next/link';
import { ActionForm, SubmitButton } from '@/components/ActionForm';
import { Badge, EmptyState, PageHead, Restricted } from '@/components/ui';
import { adminPage, staffNames } from '@/lib/admin';
import { CONTENT_STATUS_LABEL, EVENT_STATUS_LABEL, RESOURCE_TYPE_LABEL } from '@/lib/labels';
import { fmtShort } from '@/lib/format';
import { transitionResource } from '../resources/actions';
import { eventTransition } from '../events/actions';

type SP = Promise<{ q?: string; type?: string; from?: string; to?: string }>;
type Row = { id: string; kind: 'reference' | 'tool' | 'event'; title: string; typeLabel: string; archived_at: string | null; archived_by: string | null; reason: string | null; before: string | null };

export default async function ArchivePage({ searchParams }: { searchParams: SP }) {
  const gate = await adminPage();
  if (!gate.ok) return <Restricted reason={gate.reason} />;
  const { session, supabase } = gate;
  const canContent = session.can('content.manage');
  const canEvents = session.can('events.manage');
  if (!canContent && !canEvents) return <Restricted reason="الأرشيف متاح لمديري المحتوى والفعاليات." />;
  const sp = await searchParams;

  const [res, evs] = await Promise.all([
    canContent ? supabase.from('resources').select('id,kind,resource_type,title,archived_at,archived_by,archive_reason,status_before_archive').eq('status', 'archived') : Promise.resolve({ data: [] as never[] }),
    canEvents ? supabase.from('events').select('id,title,archived_at,archived_by,archive_reason,status_before_archive').eq('status', 'archived') : Promise.resolve({ data: [] as never[] }),
  ]);
  let rows: Row[] = [
    ...((res.data ?? []) as { id: string; kind: 'reference' | 'tool'; resource_type: string; title: string; archived_at: string; archived_by: string; archive_reason: string; status_before_archive: string }[]).map((r) => ({
      id: r.id, kind: r.kind, title: r.title, typeLabel: `${r.kind === 'tool' ? 'أداة' : 'مرجع'} — ${RESOURCE_TYPE_LABEL[r.resource_type]}`,
      archived_at: r.archived_at, archived_by: r.archived_by, reason: r.archive_reason, before: r.status_before_archive,
    })),
    ...((evs.data ?? []) as { id: string; title: string; archived_at: string; archived_by: string; archive_reason: string; status_before_archive: string }[]).map((e) => ({
      id: e.id, kind: 'event' as const, title: e.title, typeLabel: 'فعالية', archived_at: e.archived_at, archived_by: e.archived_by, reason: e.archive_reason, before: e.status_before_archive,
    })),
  ];
  const term = (sp.q ?? '').trim();
  if (term) rows = rows.filter((r) => r.title.includes(term) || (r.reason ?? '').includes(term));
  if (sp.type) rows = rows.filter((r) => r.kind === sp.type);
  if (sp.from) rows = rows.filter((r) => (r.archived_at ?? '') >= sp.from!);
  if (sp.to) rows = rows.filter((r) => (r.archived_at ?? '').slice(0, 10) <= sp.to!);
  rows.sort((a, b) => (b.archived_at ?? '').localeCompare(a.archived_at ?? ''));
  const names = await staffNames(supabase, rows.map((r) => r.archived_by));

  return (
    <>
      <PageHead title="الأرشيف" lead="السجلات المؤرشفة محفوظة بمصدرها وتاريخها، ولا تظهر للزوار ولا في البحث ولا عبر الروابط القديمة. الحذف النهائي إجراء منفصل." />
      <form className="card toolbar" method="get" role="search">
        <div className="field"><label htmlFor="q">بحث</label><input id="q" name="q" className="input" defaultValue={sp.q} placeholder="العنوان أو السبب" /></div>
        <div className="field">
          <label htmlFor="type">النوع</label>
          <select id="type" name="type" className="input" defaultValue={sp.type ?? ''}>
            <option value="">الكل</option>
            {canContent && <option value="reference">المراجع</option>}
            {canContent && <option value="tool">الأدوات</option>}
            {canEvents && <option value="event">الفعاليات</option>}
          </select>
        </div>
        <div className="field"><label htmlFor="from">من تاريخ</label><input id="from" name="from" type="date" className="input" defaultValue={sp.from} /></div>
        <div className="field"><label htmlFor="to">إلى تاريخ</label><input id="to" name="to" type="date" className="input" defaultValue={sp.to} /></div>
        <button className="btn secondary" type="submit">تصفية</button>
      </form>
      {rows.length ? (
        <div className="table-wrap"><table>
          <thead><tr><th>السجل</th><th>النوع</th><th>تاريخ الأرشفة</th><th>بواسطة</th><th>السبب</th><th>إجراءات</th></tr></thead>
          <tbody>
            {rows.map((r) => {
              const isEvent = r.kind === 'event';
              const base = isEvent ? `/admin/events/${r.id}` : `/admin/resources/${r.id}`;
              return (
                <tr key={r.kind + r.id}>
                  <td><Link href={base}>{r.title}</Link><div className="faint">قبل الأرشفة: {(isEvent ? EVENT_STATUS_LABEL : CONTENT_STATUS_LABEL)[r.before ?? ''] ?? '—'}</div></td>
                  <td><Badge>{r.typeLabel}</Badge></td>
                  <td className="faint">{fmtShort(r.archived_at)}</td>
                  <td>{r.archived_by ? names[r.archived_by] ?? 'عضو فريق' : '—'}</td>
                  <td className="faint">{r.reason}</td>
                  <td>
                    <div className="row" style={{ gap: '.35rem' }}>
                      <Link className="btn ghost sm" href={`${base}/preview`}>معاينة</Link>
                      {isEvent ? (
                        <ActionForm action={eventTransition.bind(null, r.id)} className="" confirm={{ title: 'استعادة الفعالية؟', body: 'تعود إلى حالتها قبل الأرشفة مع تسجيلاتها.', confirmLabel: 'استعادة' }}>
                          <input type="hidden" name="op" value="restore" />
                          <SubmitButton className="btn secondary sm">استعادة</SubmitButton>
                        </ActionForm>
                      ) : (
                        <ActionForm action={transitionResource.bind(null, r.id)} className="" confirm={{ title: 'استعادة كمسودة؟', body: 'تعود للتحرير ولا تظهر للزوار حتى تُنشر. لاستعادته منشورًا مباشرة افتح صفحة السجل.', confirmLabel: 'استعادة كمسودة' }}>
                          <input type="hidden" name="op" value="restore_draft" />
                          <SubmitButton className="btn secondary sm">استعادة</SubmitButton>
                        </ActionForm>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
      ) : <EmptyState title="الأرشيف فارغ" />}
    </>
  );
}
