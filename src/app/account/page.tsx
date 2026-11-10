import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ActionForm, SubmitButton } from '@/components/ActionForm';
import { ConfirmLink, PolicyDialog } from '@/components/client';
import { Icon } from '@/components/Icon';
import { Alert, Badge, EmptyState, PageHead, SimpleText, StatusBadge } from '@/components/ui';
import { TextField } from '../auth/fields';
import { signOut } from '../auth/actions';
import { cancelRegistration } from '../events/actions';
import { ProfileFields, PolicyCheckbox } from './ProfileFields';
import { acceptCurrentPolicy, changePassword, requestAccountChange, updateProfile } from './actions';
import { getSession } from '@/lib/session';
import { getCurrentPolicy, getSetting } from '@/lib/data';
import { createClient } from '@/lib/supabase/server';
import { CATEGORY_LABEL, EVENT_TYPE_LABEL, MEMBERSHIP_LABEL } from '@/lib/labels';
import { fmtDateTime, fmtShort } from '@/lib/format';

export const metadata: Metadata = { title: 'حسابي' };

type Reg = {
  id: string;
  status: string;
  registered_at: string;
  cancelled_at: string | null;
  event: { id: string; title: string; starts_at: string; timezone: string; status: string; event_type: string } | null;
};

const STATUS_NOTE: Record<string, string> = {
  incomplete: 'أكمل بياناتك لتفعيل العضوية.',
  active: 'يمكنك التسجيل في الفعاليات والوصول إلى رابط مجموعة واتساب.',
  suspended: 'عضويتك موقوفة: يمكنك الاطلاع على حسابك فقط، ولا يمكنك التسجيل في الفعاليات أو تعديل بياناتك.',
  closed: 'عضويتك مغلقة: يمكنك الاطلاع على حسابك فقط.',
};

export default async function AccountPage({ searchParams }: { searchParams: Promise<{ password?: string }> }) {
  const sp = await searchParams;
  const session = await getSession();
  if (!session) redirect('/auth/sign-in?next=/account');
  if (session.status === 'incomplete') redirect('/onboarding');

  const supabase = (await createClient())!;
  const [{ data: profile }, { data: membership }, { data: regs }, { data: pendingReq }, whatsapp, policy] = await Promise.all([
    supabase.from('profiles').select('full_name,category,institution,bio,interests').eq('id', session.userId).single(),
    supabase.from('memberships').select('status,joined_at,status_reason').eq('user_id', session.userId).single(),
    supabase
      .from('event_registrations')
      .select('id,status,registered_at,cancelled_at,event:events(id,title,starts_at,timezone,status,event_type)')
      .eq('user_id', session.userId)
      .order('registered_at', { ascending: false }),
    supabase.from('account_requests').select('kind,created_at').eq('user_id', session.userId).eq('status', 'pending').maybeSingle(),
    session.status === 'active' ? getSetting<string>('whatsapp_invite_url') : Promise.resolve(null),
    getCurrentPolicy(),
  ]);

  const now = Date.now();
  const registrations = ((regs ?? []) as unknown as Reg[]).filter((r) => r.status === 'registered');
  const upcoming = registrations.filter((r) => r.event && new Date(r.event.starts_at).getTime() > now);
  const past = registrations.filter((r) => !r.event || new Date(r.event.starts_at).getTime() <= now);
  const canEdit = session.status === 'active';

  return (
    <div className="container stack-lg">
      <PageHead
        title={`حسابي${profile?.full_name ? ` — ${profile.full_name}` : ''}`}
        actions={
          <form action={signOut}>
            <button className="btn secondary sm" type="submit">تسجيل الخروج</button>
          </form>
        }
      />
      {sp.password === 'updated' && <Alert tone="success">تم تعيين كلمة المرور الجديدة.</Alert>}

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <section className="card accent stack" aria-labelledby="m-title">
          <div className="row-between">
            <h2 id="m-title">العضوية</h2>
            <StatusBadge status={session.status} labels={MEMBERSHIP_LABEL} />
          </div>
          <dl className="kv">
            <dt>الفئة</dt><dd>{CATEGORY_LABEL[profile?.category ?? ''] ?? '—'}</dd>
            <dt>تاريخ الانضمام</dt><dd>{fmtShort(membership?.joined_at)}</dd>
            <dt>البريد</dt><dd className="ltr">{session.email}</dd>
          </dl>
          <p className="faint">{STATUS_NOTE[session.status]}</p>
          {membership?.status_reason && session.status !== 'active' && <Alert tone="warning">السبب: {membership.status_reason}</Alert>}
        </section>

        <section className="card stack" aria-labelledby="wa-title">
          <h2 id="wa-title">مجموعة واتساب</h2>
          {session.status !== 'active' ? (
            <p className="muted">رابط المجموعة متاح للأعضاء النشطين فقط.</p>
          ) : whatsapp ? (
            <>
              <p className="muted">العضوية في المنصة منفصلة عن المجموعة، والانضمام إليها اختياري.</p>
              <div>
                <ConfirmLink
                  href={whatsapp}
                  title="الانتقال إلى واتساب"
                  body="سيُفتح رابط الدعوة في واتساب خارج المنصة. لا نتحقق تلقائيًا من انضمامك إلى المجموعة."
                >
                  <Icon name="whatsapp" size={18} /> فتح دعوة المجموعة
                </ConfirmLink>
              </div>
            </>
          ) : (
            <p className="muted">لم يُتح رابط المجموعة بعد. سيظهر هنا عند إضافته من الفريق.</p>
          )}
        </section>
      </div>

      {policy && !session.acceptedCurrentPolicy && (
        <section className="card stack" aria-labelledby="pol-title">
          <h2 id="pol-title">تحدّثت سياسة الخصوصية وميثاق المجتمع</h2>
          <p className="muted">نُشرت النسخة {policy.version}. اطّلع عليها وأكّد موافقتك.</p>
          <ActionForm action={acceptCurrentPolicy}>
            <PolicyDialog label="قراءة النسخة الحالية" title={policy.title}><SimpleText text={policy.body} /></PolicyDialog>
            <PolicyCheckbox />
            <div><SubmitButton>تأكيد الموافقة</SubmitButton></div>
          </ActionForm>
        </section>
      )}

      <section aria-labelledby="ev-title" className="stack">
        <div className="section-head" style={{ marginBlockEnd: 0 }}>
          <h2 id="ev-title">فعالياتي</h2>
          <Link href="/events">تصفح الفعاليات</Link>
        </div>
        {upcoming.length === 0 && past.length === 0 ? (
          <EmptyState title="لم تسجّل في أي فعالية بعد" action={<Link className="btn secondary" href="/events">الفعاليات القادمة</Link>} />
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>الفعالية</th><th>الموعد</th><th>الحالة</th><th><span className="sr-only">إجراءات</span></th></tr></thead>
              <tbody>
                {[...upcoming, ...past].map((r) => {
                  const ev = r.event;
                  const isUpcoming = ev && new Date(ev.starts_at).getTime() > now;
                  return (
                    <tr key={r.id}>
                      <td>
                        {ev ? <Link href={`/events/${ev.id}`}>{ev.title}</Link> : <span className="muted">فعالية لم تعد معروضة</span>}
                        {ev && <div className="faint">{EVENT_TYPE_LABEL[ev.event_type]}</div>}
                      </td>
                      <td>{ev ? fmtDateTime(ev.starts_at, ev.timezone) : '—'}</td>
                      <td>
                        {ev?.status === 'cancelled' ? <Badge tone="danger">أُلغيت الفعالية</Badge>
                          : isUpcoming ? <Badge tone="success">مسجّل</Badge> : <Badge>منتهية</Badge>}
                      </td>
                      <td>
                        {ev && isUpcoming && ev.status === 'published' && (
                          <ActionForm
                            action={cancelRegistration.bind(null, ev.id)}
                            className=""
                            confirm={{ title: 'إلغاء التسجيل؟', body: `سيُلغى تسجيلك في «${ev.title}» ويُتاح مقعدك لغيرك.`, confirmLabel: 'نعم، ألغِ التسجيل', tone: 'danger' }}
                          >
                            <SubmitButton className="btn danger-outline sm" pendingLabel="…">إلغاء التسجيل</SubmitButton>
                          </ActionForm>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        <section className="card stack" aria-labelledby="pf-title">
          <h2 id="pf-title">بياناتي</h2>
          {canEdit ? (
            <ActionForm action={updateProfile} warnUnsaved>
              <ProfileFields v={profile ?? {}} />
              <div><SubmitButton pendingLabel="جارٍ الحفظ…">حفظ التعديلات</SubmitButton></div>
            </ActionForm>
          ) : (
            <p className="muted">لا يمكن تعديل البيانات في حالة عضويتك الحالية.</p>
          )}
        </section>

        <div className="stack">
          <section className="card stack" aria-labelledby="sec-title">
            <h2 id="sec-title">الإعدادات والأمان</h2>
            <ActionForm action={changePassword} resetOnSuccess>
              <TextField name="current_password" label="كلمة المرور الحالية" type="password" autoComplete="current-password" />
              <TextField name="password" label="كلمة المرور الجديدة" type="password" autoComplete="new-password" hint="٨ أحرف على الأقل، وتتضمن حرفًا ورقمًا." />
              <TextField name="confirm" label="تأكيد كلمة المرور الجديدة" type="password" autoComplete="new-password" />
              <div><SubmitButton className="btn secondary">تغيير كلمة المرور</SubmitButton></div>
            </ActionForm>
          </section>

          <section className="card stack" aria-labelledby="close-title">
            <h2 id="close-title">إغلاق العضوية أو حذف الحساب</h2>
            {pendingReq ? (
              <Alert tone="info">
                لديك طلب {pendingReq.kind === 'deletion' ? 'حذف حساب' : 'إغلاق عضوية'} قيد المعالجة منذ {fmtShort(pendingReq.created_at)}.
              </Alert>
            ) : (
              <>
                <p className="muted">
                  <strong>إغلاق العضوية</strong> يوقف عضويتك ويحتفظ بسجلك. <strong>حذف الحساب</strong> يحذف حسابك وبياناتك الشخصية نهائيًا،
                  مع الاحتفاظ بإحصاءات مجمّعة لا تكشف هويتك. يعالج فريق العضويات الطلب يدويًا.
                </p>
                <div className="row">
                  <ActionForm
                    action={requestAccountChange}
                    className=""
                    confirm={{ title: 'طلب إغلاق العضوية', body: 'سيراجع فريق العضويات طلبك.', confirmLabel: 'إرسال الطلب', reasonField: 'reason', reasonLabel: 'سبب الإغلاق (اختياري)' }}
                  >
                    <input type="hidden" name="kind" value="closure" />
                    <SubmitButton className="btn secondary sm">طلب إغلاق العضوية</SubmitButton>
                  </ActionForm>
                  <ActionForm
                    action={requestAccountChange}
                    className=""
                    confirm={{ title: 'طلب حذف الحساب نهائيًا', body: 'بعد التنفيذ لا يمكن استعادة الحساب أو سجل الفعاليات المرتبط به.', confirmLabel: 'إرسال طلب الحذف', tone: 'danger', reasonField: 'reason', reasonLabel: 'ملاحظة للفريق (اختياري)' }}
                  >
                    <input type="hidden" name="kind" value="deletion" />
                    <SubmitButton className="btn danger-outline sm">طلب حذف الحساب</SubmitButton>
                  </ActionForm>
                </div>
              </>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
