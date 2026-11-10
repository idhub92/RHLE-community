import Link from 'next/link';
import { Restricted, EmptyState, PageHead, StatusBadge, Badge } from '@/components/ui';
import { adminPage, staffNames } from '@/lib/admin';
import { getSetting } from '@/lib/data';
import { CONTENT_STATUS_LABEL, EVENT_STATUS_LABEL } from '@/lib/labels';
import { fmtDateTime, fmtNumber, fmtShort } from '@/lib/format';

type Metrics = Record<string, number>;
type Targets = { members: number; references: number; tools: number; events: number };

const ACTION_LABEL: Record<string, string> = { insert: 'إنشاء', update: 'تعديل', delete: 'حذف', status_change: 'تغيير حالة' };
const ENTITY_LABEL: Record<string, string> = {
  resources: 'محتوى', events: 'فعالية', memberships: 'عضوية', user_roles: 'صلاحية', role_permissions: 'صلاحيات دور',
  roles: 'دور', settings: 'إعداد', team_titles: 'لقب عام', event_attendance: 'حضور', policies: 'سياسة', account_requests: 'طلب حساب',
};

function Stat({ label, value, target }: { label: string; value: number; target?: number }) {
  const pct = target ? Math.min(100, Math.round((value / target) * 100)) : null;
  return (
    <div className="card stat">
      <span className="muted">{label}</span>
      <span className="value">{fmtNumber(value)}</span>
      {target != null && (
        <>
          <span className="target">المستهدف: {fmtNumber(target)}</span>
          <div className="progress" aria-hidden="true"><span style={{ inlineSize: `${pct}%` }} /></div>
        </>
      )}
    </div>
  );
}

export default async function AdminDashboard() {
  const gate = await adminPage();
  if (!gate.ok) return <Restricted reason={gate.reason} />;
  const { supabase, session } = gate;

  const [{ data: m }, targets, review, upcoming, audit] = await Promise.all([
    supabase.rpc('admin_metrics'),
    getSetting<Targets>('pilot_targets'),
    session.can('content.manage')
      ? supabase.from('resources').select('id,kind,title,status,submitted_at').eq('status', 'in_review').order('submitted_at')
      : Promise.resolve({ data: [] as { id: string; kind: string; title: string; status: string; submitted_at: string }[] }),
    session.can('events.manage')
      ? supabase.from('events').select('id,title,starts_at,status,registration_open').in('status', ['draft', 'published']).order('starts_at').limit(6)
      : Promise.resolve({ data: [] as { id: string; title: string; starts_at: string; status: string; registration_open: boolean }[] }),
    session.can('platform.admin')
      ? supabase.from('audit_log').select('id,actor,action,entity_type,details,created_at').order('created_at', { ascending: false }).limit(12)
      : Promise.resolve({ data: null }),
  ]);
  const metrics = (m ?? {}) as Metrics;
  const names = audit.data ? await staffNames(supabase, audit.data.map((a) => a.actor)) : {};

  return (
    <>
      <PageHead title="لوحة المتابعة" lead="أرقام فعلية من قاعدة البيانات، يقابلها مستهدف المرحلة التجريبية بشكل منفصل." />

      <section className="stack" aria-labelledby="pilot">
        <h2 id="pilot">المتحقق مقابل المستهدف</h2>
        <div className="grid">
          <Stat label="الأعضاء النشطون" value={metrics.active_members ?? 0} target={targets?.members} />
          <Stat label="المراجع المنشورة" value={metrics.published_references ?? 0} target={targets?.references} />
          <Stat label="الأدوات المعتمدة (غير الأولية)" value={metrics.approved_tools ?? 0} target={targets?.tools} />
          <Stat label="فعاليات منفّذة" value={metrics.events_completed ?? 0} target={targets?.events} />
        </div>
      </section>

      <section className="stack" aria-labelledby="ops">
        <h2 id="ops">التشغيل</h2>
        <div className="grid">
          <Stat label="أدوات منشورة (منها الأولية)" value={metrics.published_tools ?? 0} />
          <Stat label="فعاليات منشورة" value={metrics.events_published ?? 0} />
          <Stat label="فعاليات قادمة" value={metrics.events_upcoming ?? 0} />
          <Stat label="تسجيلات نشطة" value={metrics.active_registrations ?? 0} />
          <Stat label="حضور مسجّل" value={metrics.attended ?? 0} />
          <Stat label="عضويات غير مكتملة" value={metrics.incomplete_members ?? 0} />
          <Stat label="بانتظار المراجعة" value={metrics.in_review ?? 0} />
          <Stat label="سجلات مؤرشفة" value={(metrics.archived_resources ?? 0) + (metrics.archived_events ?? 0)} />
          <Stat label="طلبات حسابات معلّقة" value={metrics.pending_account_requests ?? 0} />
        </div>
      </section>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        {session.can('content.manage') && (
          <section className="stack">
            <h2>محتوى بانتظار المراجعة</h2>
            {review.data?.length ? (
              <div className="table-wrap"><table>
                <tbody>
                  {review.data.map((r) => (
                    <tr key={r.id}>
                      <td><Link href={`/admin/resources/${r.id}`}>{r.title}</Link></td>
                      <td>{r.kind === 'tool' ? 'أداة' : 'مرجع'}</td>
                      <td className="faint">{fmtShort(r.submitted_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            ) : <EmptyState title="لا يوجد محتوى بانتظار المراجعة" />}
          </section>
        )}
        {session.can('events.manage') && (
          <section className="stack">
            <div className="section-head" style={{ marginBlockEnd: 0 }}><h2>الفعاليات النشطة والمسودات</h2><Link href="/admin/events/new">فعالية جديدة</Link></div>
            {upcoming.data?.length ? (
              <div className="table-wrap"><table>
                <tbody>
                  {upcoming.data.map((e) => (
                    <tr key={e.id}>
                      <td><Link href={`/admin/events/${e.id}`}>{e.title}</Link></td>
                      <td><StatusBadge status={e.status} labels={EVENT_STATUS_LABEL} /></td>
                      <td>{e.status === 'published' && (e.registration_open ? <Badge tone="success">التسجيل مفتوح</Badge> : <Badge tone="warning">مغلق</Badge>)}</td>
                      <td className="faint">{fmtShort(e.starts_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table></div>
            ) : <EmptyState title="لا توجد فعاليات نشطة" action={<Link className="btn secondary sm" href="/admin/events/new">إنشاء فعالية</Link>} />}
          </section>
        )}
      </div>

      {audit.data && (
        <section className="stack">
          <h2>آخر الإجراءات الإدارية</h2>
          {audit.data.length ? (
            <div className="table-wrap"><table>
              <thead><tr><th>الوقت</th><th>المنفّذ</th><th>الإجراء</th><th>السجل</th><th>التفاصيل</th></tr></thead>
              <tbody>
                {audit.data.map((a) => {
                  const d = a.details as { title?: string; from?: string; to?: string; role?: string };
                  return (
                    <tr key={a.id}>
                      <td className="faint">{fmtDateTime(a.created_at)}</td>
                      <td>{a.actor ? names[a.actor] ?? 'عضو فريق' : 'إعداد النظام'}</td>
                      <td>{ACTION_LABEL[a.action] ?? a.action}</td>
                      <td>{ENTITY_LABEL[a.entity_type] ?? a.entity_type}</td>
                      <td className="faint">
                        {d.title ?? d.role ?? ''}
                        {d.from && ` (${CONTENT_STATUS_LABEL[d.from] ?? EVENT_STATUS_LABEL[d.from] ?? d.from} ← ${CONTENT_STATUS_LABEL[d.to ?? ''] ?? EVENT_STATUS_LABEL[d.to ?? ''] ?? d.to})`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table></div>
          ) : <EmptyState title="لا توجد إجراءات مسجّلة بعد" />}
        </section>
      )}
    </>
  );
}
