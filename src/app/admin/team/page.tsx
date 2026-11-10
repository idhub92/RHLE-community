import { ActionForm, SubmitButton } from '@/components/ActionForm';
import { Badge, EmptyState, PageHead, Restricted, Alert } from '@/components/ui';
import { adminPage } from '@/lib/admin';
import { PERMISSION_LABEL } from '@/lib/labels';
import { TextField } from '@/app/auth/fields';
import { createRole, grantRole, revokeRole, setTitle } from './actions';

type TeamRow = { user_id: string; email: string; full_name: string | null; role_keys: string[]; public_title: string | null };
type Role = { id: string; key: string; name_ar: string; description_ar: string | null; is_system: boolean };

export default async function TeamAdmin() {
  const gate = await adminPage('permissions.manage');
  if (!gate.ok) return <Restricted reason={gate.reason} />;
  const { supabase, session } = gate;
  const [{ data: team }, { data: roles }, { data: rp }] = await Promise.all([
    supabase.rpc('team_directory'),
    supabase.from('roles').select('id,key,name_ar,description_ar,is_system').order('is_system', { ascending: false }).order('name_ar'),
    supabase.from('role_permissions').select('role_id,permission_key'),
  ]);
  const rows = (team ?? []) as TeamRow[];
  const roleList = (roles ?? []) as Role[];
  const roleByKey = Object.fromEntries(roleList.map((r) => [r.key, r]));
  const permsOf = (id: string) => (rp ?? []).filter((x) => x.role_id === id).map((x) => x.permission_key);
  const isAdmin = session.can('platform.admin');
  const sensitive = (id: string) => permsOf(id).some((p) => p === 'platform.admin' || p === 'permissions.manage');

  return (
    <>
      <PageHead title="الفريق والصلاحيات" lead="لكل عضو فريق حساب مستقل. الصلاحيات منفصلة عن العضوية والفئة المهنية واللقب العام، وتسري فورًا عند منحها أو سحبها." />

      <section className="card accent stack">
        <h2>منح دور</h2>
        <Alert tone="info">يجب أن ينشئ الشخص حسابه ويؤكّد بريده بنفسه أولًا. لا يُمنح أي دور لعناوين غير مؤكَّدة.{!isAdmin && ' الأدوار الحساسة (إدارة المنصة وإدارة الصلاحيات) يمنحها مدير المنصة فقط.'}</Alert>
        <ActionForm action={grantRole} className="form" confirm={{ title: 'تأكيد منح الدور', body: 'سيحصل صاحب الحساب على صلاحيات هذا الدور فورًا.', confirmLabel: 'منح الدور' }} resetOnSuccess>
          <div className="form-grid">
            <TextField name="email" label="بريد الحساب" type="email" dirLtr />
            <div className="field">
              <label htmlFor="role_id" className="req">الدور</label>
              <select id="role_id" name="role_id" className="input" required defaultValue="">
                <option value="" disabled>اختر…</option>
                {roleList.filter((r) => isAdmin || !sensitive(r.id)).map((r) => <option key={r.id} value={r.id}>{r.name_ar}</option>)}
              </select>
            </div>
          </div>
          <div><SubmitButton>منح الدور</SubmitButton></div>
        </ActionForm>
      </section>

      <section className="stack">
        <h2>أعضاء الفريق</h2>
        {rows.length ? (
          <div className="table-wrap"><table>
            <thead><tr><th>الحساب</th><th>الأدوار</th><th>اللقب العام (صفحة «عن المجتمع»)</th></tr></thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.user_id}>
                  <td>{m.full_name ?? '—'}<div className="faint ltr">{m.email}</div></td>
                  <td>
                    <div className="stack" style={{ gap: '.35rem' }}>
                      {m.role_keys.length === 0 && <span className="faint">بلا أدوار</span>}
                      {m.role_keys.map((k) => {
                        const role = roleByKey[k];
                        if (!role) return null;
                        const canRevoke = isAdmin || !sensitive(role.id);
                        return (
                          <div key={k} className="row" style={{ gap: '.35rem' }}>
                            <Badge tone="info">{role.name_ar}</Badge>
                            {canRevoke && (
                              <ActionForm action={revokeRole.bind(null, m.user_id, role.id)} className="" confirm={{ title: 'سحب الدور', body: `سيُسحب دور «${role.name_ar}» من ${m.full_name ?? 'الحساب'} فورًا، حتى لو كانت جلسته مفتوحة.`, confirmLabel: 'سحب الدور', tone: 'danger' }}>
                                <SubmitButton className="btn ghost sm" pendingLabel="…">سحب</SubmitButton>
                              </ActionForm>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </td>
                  <td>
                    <ActionForm action={setTitle.bind(null, m.user_id)} className="row">
                      <label className="sr-only" htmlFor={`t-${m.user_id}`}>اللقب العام</label>
                      <input id={`t-${m.user_id}`} name="public_title" className="input" style={{ inlineSize: 200 }} maxLength={80} defaultValue={m.public_title ?? ''} placeholder="مثال: مديرة المشروع" />
                      <label className="sr-only" htmlFor={`s-${m.user_id}`}>الترتيب</label>
                      <input id={`s-${m.user_id}`} name="sort_order" type="number" className="input" style={{ inlineSize: 80 }} defaultValue={100} />
                      <SubmitButton className="btn secondary sm">حفظ</SubmitButton>
                    </ActionForm>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        ) : <EmptyState title="لا يوجد أعضاء فريق بعد" />}
      </section>

      <section className="stack">
        <h2>الأدوار وصلاحياتها</h2>
        <div className="table-wrap"><table>
          <thead><tr><th>الدور</th>{Object.values(PERMISSION_LABEL).map((l) => <th key={l}>{l}</th>)}</tr></thead>
          <tbody>
            {roleList.map((r) => {
              const p = permsOf(r.id);
              return (
                <tr key={r.id}>
                  <td>{r.name_ar}{!r.is_system && <div className="faint">مخصص</div>}</td>
                  {Object.keys(PERMISSION_LABEL).map((k) => <td key={k}>{p.includes(k) || p.includes('platform.admin') ? '✓' : ''}</td>)}
                </tr>
              );
            })}
          </tbody>
        </table></div>
        {isAdmin && (
          <div className="card stack">
            <h3>دور مخصص جديد</h3>
            <ActionForm action={createRole} resetOnSuccess>
              <div className="form-grid">
                <TextField name="name_ar" label="اسم الدور" />
                <TextField name="key" label="المعرّف (إنجليزي)" dirLtr hint="مثال: content_reviewer" />
              </div>
              <TextField name="description_ar" label="الوصف" required={false} />
              <fieldset className="field">
                <legend>الصلاحيات</legend>
                <div className="choice-group">
                  {Object.entries(PERMISSION_LABEL).filter(([k]) => k !== 'platform.admin').map(([k, l]) => (
                    <label key={k} className="check"><input type="checkbox" name="perm" value={k} /><span>{l}</span></label>
                  ))}
                </div>
              </fieldset>
              <div><SubmitButton className="btn secondary">إنشاء الدور</SubmitButton></div>
            </ActionForm>
          </div>
        )}
      </section>
    </>
  );
}
