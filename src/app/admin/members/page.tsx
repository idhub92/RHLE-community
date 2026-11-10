import Link from 'next/link';
import { ActionForm, SubmitButton } from '@/components/ActionForm';
import { Badge, EmptyState, PageHead, Restricted, StatusBadge } from '@/components/ui';
import { adminPage } from '@/lib/admin';
import { CATEGORY_LABEL, MEMBERSHIP_LABEL } from '@/lib/labels';
import { fmtShort } from '@/lib/format';
import { handleAccountRequest, setMemberStatus } from './actions';

type Member = {
  user_id: string; email: string; full_name: string | null; category: string | null; institution: string | null;
  status: string; joined_at: string | null; created_at: string; roles: string[]; pending_request: string | null;
};

export default async function MembersAdmin({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  const gate = await adminPage('members.manage');
  if (!gate.ok) return <Restricted reason={gate.reason} />;
  const sp = await searchParams;
  const [{ data }, { data: reqs }] = await Promise.all([
    gate.supabase.rpc('member_directory'),
    gate.supabase.from('account_requests').select('id,user_id,kind,reason,created_at').eq('status', 'pending').order('created_at'),
  ]);
  const all = (data ?? []) as Member[];
  const term = (sp.q ?? '').trim().toLowerCase();
  const list = all.filter(
    (m) => (!sp.status || m.status === sp.status) && (!term || (m.full_name ?? '').toLowerCase().includes(term) || m.email.toLowerCase().includes(term))
  );
  const byId = Object.fromEntries(all.map((m) => [m.user_id, m]));
  const isAdmin = gate.session.can('platform.admin');

  return (
    <>
      <PageHead title="الأعضاء" lead="سجلات العضوية وحالاتها. البريد الإلكتروني يظهر لفريق العضويات فقط." />

      {reqs && reqs.length > 0 && (
        <section className="stack">
          <h2>طلبات الإغلاق والحذف</h2>
          <div className="table-wrap"><table>
            <thead><tr><th>العضو</th><th>الطلب</th><th>ملاحظة العضو</th><th>التاريخ</th><th>إجراء</th></tr></thead>
            <tbody>
              {reqs.map((r) => (
                <tr key={r.id}>
                  <td>{byId[r.user_id]?.full_name ?? '—'}<div className="faint ltr">{byId[r.user_id]?.email}</div></td>
                  <td>{r.kind === 'deletion' ? <Badge tone="danger">حذف الحساب</Badge> : <Badge tone="warning">إغلاق العضوية</Badge>}</td>
                  <td className="faint">{r.reason ?? '—'}</td>
                  <td className="faint">{fmtShort(r.created_at)}</td>
                  <td>
                    <div className="row" style={{ gap: '.35rem' }}>
                      {r.kind === 'closure' && (
                        <ActionForm action={handleAccountRequest.bind(null, r.id)} className="" confirm={{ title: 'إغلاق العضوية', body: 'تُغلق العضوية مع الاحتفاظ بالسجل.', confirmLabel: 'تنفيذ الإغلاق', reasonField: 'reason', reasonLabel: 'ملاحظة (اختياري)' }}>
                          <input type="hidden" name="op" value="close" />
                          <SubmitButton className="btn sm">تنفيذ</SubmitButton>
                        </ActionForm>
                      )}
                      {r.kind === 'deletion' && isAdmin && (
                        <ActionForm action={handleAccountRequest.bind(null, r.id)} className="" confirm={{ title: 'حذف الحساب نهائيًا', body: 'يُحذف الحساب والملف الشخصي وسجلات التسجيل والحضور المرتبطة به نهائيًا. لا يمكن التراجع.', confirmLabel: 'حذف نهائيًا', tone: 'danger' }}>
                          <input type="hidden" name="op" value="delete" />
                          <SubmitButton className="btn danger sm">تنفيذ الحذف</SubmitButton>
                        </ActionForm>
                      )}
                      {r.kind === 'deletion' && !isAdmin && <span className="faint">التنفيذ لمدير المنصة</span>}
                      <ActionForm action={handleAccountRequest.bind(null, r.id)} className="" confirm={{ title: 'رفض الطلب', confirmLabel: 'رفض', reasonField: 'reason', reasonLabel: 'السبب', reasonRequired: true }}>
                        <input type="hidden" name="op" value="reject" />
                        <SubmitButton className="btn ghost sm">رفض</SubmitButton>
                      </ActionForm>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </section>
      )}

      <form className="toolbar" method="get" role="search">
        <div className="field"><label htmlFor="q">بحث بالاسم أو البريد</label><input id="q" name="q" className="input" defaultValue={sp.q} /></div>
        <div className="field">
          <label htmlFor="status">الحالة</label>
          <select id="status" name="status" className="input" defaultValue={sp.status ?? ''}>
            <option value="">الكل</option>
            {Object.entries(MEMBERSHIP_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </div>
        <button className="btn secondary" type="submit">تصفية</button>
        {(sp.q || sp.status) && <Link className="btn ghost" href="/admin/members">مسح</Link>}
      </form>

      {list.length ? (
        <div className="table-wrap"><table>
          <thead><tr><th>العضو</th><th>الفئة</th><th>الحالة</th><th>الانضمام</th><th>إجراءات</th></tr></thead>
          <tbody>
            {list.map((m) => (
              <tr key={m.user_id}>
                <td>
                  {m.full_name ?? <span className="muted">لم يكمل البيانات</span>}
                  <div className="faint ltr">{m.email}</div>
                  {m.roles.length > 0 && <div className="faint">فريق: {m.roles.join('، ')}</div>}
                </td>
                <td>{CATEGORY_LABEL[m.category ?? ''] ?? '—'}{m.institution && <div className="faint">{m.institution}</div>}</td>
                <td><StatusBadge status={m.status} labels={MEMBERSHIP_LABEL} />{m.pending_request && <div><Badge tone="warning">طلب معلّق</Badge></div>}</td>
                <td className="faint">{fmtShort(m.joined_at ?? m.created_at)}</td>
                <td>
                  {m.user_id === gate.session.userId ? <span className="faint">حسابك</span> : (
                    <div className="row" style={{ gap: '.35rem' }}>
                      {m.status === 'active' && (
                        <ActionForm action={setMemberStatus.bind(null, m.user_id)} className="" confirm={{ title: `إيقاف عضوية ${m.full_name ?? ''}`, body: 'لن يتمكن من التسجيل في الفعاليات أو تعديل بياناته، وتُعلَّق أي صلاحيات إدارية لديه.', confirmLabel: 'إيقاف', tone: 'danger', reasonField: 'reason', reasonLabel: 'السبب (يظهر للعضو)', reasonRequired: true }}>
                          <input type="hidden" name="status" value="suspended" />
                          <SubmitButton className="btn danger-outline sm">إيقاف</SubmitButton>
                        </ActionForm>
                      )}
                      {(m.status === 'suspended' || m.status === 'closed') && m.full_name && (
                        <ActionForm action={setMemberStatus.bind(null, m.user_id)} className="" confirm={{ title: 'إعادة تفعيل العضوية؟', confirmLabel: 'إعادة التفعيل' }}>
                          <input type="hidden" name="status" value="active" />
                          <SubmitButton className="btn secondary sm">إعادة تفعيل</SubmitButton>
                        </ActionForm>
                      )}
                      {m.status !== 'closed' && m.status !== 'incomplete' && (
                        <ActionForm action={setMemberStatus.bind(null, m.user_id)} className="" confirm={{ title: 'إغلاق العضوية', body: 'تُغلق العضوية مع الاحتفاظ بالسجل.', confirmLabel: 'إغلاق', tone: 'danger', reasonField: 'reason', reasonLabel: 'السبب', reasonRequired: true }}>
                          <input type="hidden" name="status" value="closed" />
                          <SubmitButton className="btn ghost sm">إغلاق</SubmitButton>
                        </ActionForm>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      ) : <EmptyState title={all.length ? 'لا توجد نتائج مطابقة' : 'لا يوجد أعضاء بعد'} />}
    </>
  );
}
