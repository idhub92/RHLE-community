import { PageHead, Restricted, Alert } from '@/components/ui';
import { adminPage } from '@/lib/admin';
import { getSetting } from '@/lib/data';
import { fmtNumber } from '@/lib/format';

type Targets = { members: number; references: number; tools: number; events: number };

export default async function Reports() {
  const gate = await adminPage();
  if (!gate.ok) return <Restricted reason={gate.reason} />;
  const { session, supabase } = gate;
  const canSummary = session.can('reports.view');
  if (!canSummary && !session.can('members.manage') && !session.can('events.manage'))
    return <Restricted reason="لا تملك صلاحية التقارير." />;
  const [{ data: m }, targets, period] = await Promise.all([
    canSummary ? supabase.rpc('admin_metrics') : Promise.resolve({ data: null }),
    getSetting<Targets>('pilot_targets'),
    getSetting<{ start: string; end: string }>('pilot_period'),
  ]);
  const metrics = (m ?? {}) as Record<string, number>;
  const rows: [string, number, number | undefined][] = [
    ['الأعضاء النشطون', metrics.active_members ?? 0, targets?.members],
    ['المراجع المنشورة', metrics.published_references ?? 0, targets?.references],
    ['الأدوات المعتمدة', metrics.approved_tools ?? 0, targets?.tools],
    ['الفعاليات المنفّذة', metrics.events_completed ?? 0, targets?.events],
  ];

  return (
    <>
      <PageHead title="التقارير" lead={period ? `المرحلة التجريبية: ${period.start} إلى ${period.end}` : undefined} />
      {canSummary && (
        <section className="stack">
          <h2>ملخص المستهدفات</h2>
          <div className="table-wrap"><table>
            <thead><tr><th>المؤشر</th><th className="num">المتحقق</th><th className="num">المستهدف</th><th className="num">النسبة</th></tr></thead>
            <tbody>
              {rows.map(([l, v, t]) => (
                <tr key={l}><td>{l}</td><td className="num">{fmtNumber(v)}</td><td className="num">{t != null ? fmtNumber(t) : '—'}</td><td className="num">{t ? `${fmtNumber(Math.round((v / t) * 100))}٪` : '—'}</td></tr>
              ))}
              <tr><td>التسجيلات النشطة</td><td className="num">{fmtNumber(metrics.active_registrations)}</td><td className="num">—</td><td /></tr>
              <tr><td>الحضور الفعلي</td><td className="num">{fmtNumber(metrics.attended)}</td><td className="num">—</td><td /></tr>
            </tbody>
          </table></div>
        </section>
      )}
      <section className="card stack">
        <h2>التصدير (CSV)</h2>
        <Alert tone="info">يقتصر كل ملف على الحقول التي تسمح بها صلاحيتك.</Alert>
        <div className="row">
          {canSummary && <a className="btn secondary" href="/admin/reports/export?type=summary">ملخص المؤشرات (بلا بيانات شخصية)</a>}
          {session.can('members.manage') && <a className="btn secondary" href="/admin/reports/export?type=members">سجل الأعضاء</a>}
          {session.can('events.manage') && <a className="btn secondary" href="/admin/reports/export?type=registrations">التسجيلات والحضور</a>}
        </div>
      </section>
    </>
  );
}
