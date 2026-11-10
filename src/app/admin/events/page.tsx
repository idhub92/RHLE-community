import Link from 'next/link';
import { EmptyState, PageHead, Restricted, StatusBadge, Badge } from '@/components/ui';
import { adminPage } from '@/lib/admin';
import { EVENT_STATUS_LABEL, EVENT_TYPE_LABEL } from '@/lib/labels';
import { fmtDateTime } from '@/lib/format';

export default async function AdminEvents({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const gate = await adminPage('events.manage');
  if (!gate.ok) return <Restricted reason={gate.reason} />;
  const { status } = await searchParams;
  const st = ['draft', 'published', 'completed', 'cancelled'].includes(status ?? '') ? status! : '';
  let q = gate.supabase.from('events').select('id,title,event_type,starts_at,timezone,status,registration_open,capacity').neq('status', 'archived').order('starts_at', { ascending: false });
  if (st) q = q.eq('status', st);
  const [{ data }, { data: regs }] = await Promise.all([
    q,
    gate.supabase.from('event_registrations').select('event_id').eq('status', 'registered'),
  ]);
  const counts: Record<string, number> = {};
  for (const r of regs ?? []) counts[r.event_id] = (counts[r.event_id] ?? 0) + 1;

  return (
    <>
      <PageHead title="الفعاليات" lead="أنشئ مسودة، عاينها، ثم انشرها وافتح التسجيل." actions={<Link className="btn" href="/admin/events/new">فعالية جديدة</Link>} />
      <nav className="tabs" aria-label="الحالة">
        {[['', 'الكل'], ['draft', 'مسودات'], ['published', 'منشورة'], ['completed', 'منتهية'], ['cancelled', 'ملغاة']].map(([s, l]) => (
          <Link key={s} href={`/admin/events${s ? `?status=${s}` : ''}`} aria-current={st === s ? 'page' : undefined}>{l}</Link>
        ))}
      </nav>
      {data?.length ? (
        <div className="table-wrap"><table>
          <thead><tr><th>الفعالية</th><th>الموعد</th><th>الحالة</th><th>التسجيل</th><th className="num">المسجّلون</th></tr></thead>
          <tbody>
            {data.map((e) => (
              <tr key={e.id}>
                <td><Link href={`/admin/events/${e.id}`}>{e.title}</Link><div className="faint">{EVENT_TYPE_LABEL[e.event_type]}</div></td>
                <td>{fmtDateTime(e.starts_at, e.timezone)}</td>
                <td><StatusBadge status={e.status} labels={EVENT_STATUS_LABEL} /></td>
                <td>{e.status === 'published' ? (e.registration_open ? <Badge tone="success">مفتوح</Badge> : <Badge tone="warning">مغلق</Badge>) : '—'}</td>
                <td className="num">{counts[e.id] ?? 0}{e.capacity ? ` / ${e.capacity}` : ''}</td>
              </tr>
            ))}
          </tbody>
        </table></div>
      ) : <EmptyState title="لا توجد فعاليات" action={<Link className="btn secondary" href="/admin/events/new">إنشاء فعالية</Link>} />}
    </>
  );
}
