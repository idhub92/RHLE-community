import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ActionForm, SubmitButton, type ConfirmSpec } from '@/components/ActionForm';
import { CopyButton } from '@/components/client';
import { Alert, Badge, EmptyState, PageHead, Restricted, StatusBadge } from '@/components/ui';
import { adminPage, staffNames, UUID_RE } from '@/lib/admin';
import { SITE_URL } from '@/lib/env';
import { CATEGORY_LABEL, EVENT_STATUS_LABEL } from '@/lib/labels';
import { fmtDateTime, toLocalInput } from '@/lib/format';
import type { EventRow } from '@/lib/data';
import { EventFields } from '../EventForm';
import { eventTransition, saveEvent, setAttendance } from '../actions';

type Registrant = {
  registration_id: string; user_id: string; full_name: string | null; category: string | null;
  status: string; registered_at: string; cancelled_at: string | null; attended: boolean | null;
};

export default async function AdminEvent({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ created?: string }> }) {
  const gate = await adminPage('events.manage');
  if (!gate.ok) return <Restricted reason={gate.reason} />;
  const { id } = await params;
  const sp = await searchParams;
  if (!UUID_RE.test(id)) notFound();
  const { supabase } = gate;
  const [{ data }, { data: priv }, { data: regData }] = await Promise.all([
    supabase.from('events').select('*').eq('id', id).maybeSingle(),
    supabase.from('event_private').select('meeting_url').eq('event_id', id).maybeSingle(),
    supabase.rpc('event_registrants', { p_event: id }),
  ]);
  if (!data) notFound();
  const e = data as EventRow & { created_by: string | null };
  const regs = (regData ?? []) as Registrant[];
  const active = regs.filter((r) => r.status === 'registered');
  const names = await staffNames(supabase, [e.created_by, e.archived_by]);
  const archived = e.status === 'archived';
  const started = new Date(e.starts_at) <= new Date();

  const ops: { op: string; label: string; cls?: string; confirm?: ConfirmSpec }[] = [];
  if (e.status === 'draft') ops.push({ op: 'publish', label: 'نشر الفعالية', confirm: { title: 'نشر الفعالية؟', body: 'ستظهر للزوار في قائمة الفعاليات. التسجيل يبقى مغلقًا حتى تفتحه.', confirmLabel: 'نشر' } });
  if (e.status === 'published') {
    if (!e.registration_open && !started) ops.push({ op: 'open_reg', label: 'فتح التسجيل' });
    if (e.registration_open) ops.push({ op: 'close_reg', label: 'إغلاق التسجيل', cls: 'btn secondary' });
    if (started) ops.push({ op: 'complete', label: 'تعليمها منتهية', cls: 'btn secondary', confirm: { title: 'تعليم الفعالية منتهية؟', body: 'تنتقل إلى الفعاليات السابقة ويُغلق التسجيل. يمكنك تسجيل الحضور قبلها أو بعدها.', confirmLabel: 'تأكيد' } });
    if (!started && active.length === 0) ops.push({ op: 'unpublish', label: 'إعادتها مسودة', cls: 'btn ghost' });
    ops.push({ op: 'cancel', label: 'إلغاء الفعالية', cls: 'btn danger-outline', confirm: { title: 'إلغاء الفعالية', body: 'تبقى ظاهرة بحالة «ملغاة» مع السبب، وتبقى التسجيلات محفوظة. لا تُرسل رسائل تلقائيًا.', confirmLabel: 'إلغاء الفعالية', tone: 'danger', reasonField: 'reason', reasonLabel: 'سبب الإلغاء (يظهر للزوار)', reasonRequired: true } });
  }
  if (!archived) ops.push({ op: 'archive', label: 'أرشفة', cls: 'btn ghost', confirm: { title: 'أرشفة الفعالية', body: 'تختفي من العرض العام. تبقى التسجيلات والحضور محفوظة ولا تُحذف، ويمكن الاستعادة لاحقًا.', confirmLabel: 'أرشفة', tone: 'danger', reasonField: 'reason', reasonLabel: 'سبب الأرشفة', reasonRequired: true } });
  if (archived) ops.push({ op: 'restore', label: `استعادة (${EVENT_STATUS_LABEL[e.status_before_archive ?? 'draft']})`, confirm: { title: 'استعادة الفعالية؟', body: 'تعود إلى حالتها قبل الأرشفة.', confirmLabel: 'استعادة' } });

  const notice =
    e.status === 'cancelled'
      ? `نعتذر عن إلغاء «${e.title}» المقررة ${fmtDateTime(e.starts_at, e.timezone)}. السبب: ${e.status_note ?? ''}. نشكر تفهمكم، وسنعلن عن اللقاءات القادمة عبر المنصة: ${SITE_URL}/events`
      : e.rescheduled_from
        ? `تنبيه: تغيّر موعد «${e.title}» من ${fmtDateTime(e.rescheduled_from, e.timezone)} إلى ${fmtDateTime(e.starts_at, e.timezone)}. ${e.status_note ?? ''} تفاصيل الفعالية وإلغاء التسجيل: ${SITE_URL}/events/${e.id}`
        : null;

  return (
    <>
      <p><Link href={archived ? '/admin/archive' : '/admin/events'}>← {archived ? 'الأرشيف' : 'الفعاليات'}</Link></p>
      <PageHead
        title={e.title}
        eyebrow="فعالية"
        actions={<><StatusBadge status={e.status} labels={EVENT_STATUS_LABEL} />{e.status === 'published' && (e.registration_open ? <Badge tone="success">التسجيل مفتوح</Badge> : <Badge tone="warning">التسجيل مغلق</Badge>)}<Link className="btn secondary sm" href={`/admin/events/${id}/preview`}>معاينة</Link></>}
      />
      {sp.created && <Alert tone="success">أُنشئت المسودة. عاينها ثم انشرها.</Alert>}
      {archived && <Alert tone="warning" title="فعالية مؤرشفة">السبب: {e.archive_reason}. التسجيلات ({regs.length}) وسجلات الحضور محفوظة.</Alert>}

      <div className="grid-2" style={{ gridTemplateColumns: 'minmax(0, 2fr) minmax(240px, 1fr)', alignItems: 'start' }}>
        <div className="card">
          <ActionForm action={saveEvent.bind(null, id)} warnUnsaved>
            <EventFields
              disabled={archived}
              v={{ ...e, starts_local: toLocalInput(e.starts_at, e.timezone), deadline_local: toLocalInput(e.registration_deadline, e.timezone), meeting_url: priv?.meeting_url ?? null }}
            />
            {!archived && <div><SubmitButton pendingLabel="جارٍ الحفظ…">حفظ التعديلات</SubmitButton></div>}
          </ActionForm>
        </div>
        <aside className="stack">
          <div className="card stack">
            <h2 style={{ fontSize: '1.05rem' }}>الإجراءات</h2>
            {ops.map((o) => (
              <ActionForm key={o.op} action={eventTransition.bind(null, id)} confirm={o.confirm} className="stack">
                <input type="hidden" name="op" value={o.op} />
                <SubmitButton className={o.cls ?? 'btn'}>{o.label}</SubmitButton>
              </ActionForm>
            ))}
          </div>
          <div className="card stack">
            <dl className="kv" style={{ fontSize: '.86rem' }}>
              <dt>أنشأها</dt><dd>{e.created_by ? names[e.created_by] ?? 'عضو فريق' : '—'}</dd>
              <dt>المسجّلون</dt><dd>{active.length}{e.capacity ? ` من ${e.capacity}` : ''}</dd>
              <dt>الحضور</dt><dd>{regs.filter((r) => r.attended).length}</dd>
              {e.published_at && (<><dt>النشر</dt><dd className="faint">{fmtDateTime(e.published_at)}</dd></>)}
            </dl>
          </div>
          {notice && (
            <div className="card stack">
              <h2 style={{ fontSize: '1.05rem' }}>إشعار المسجّلين</h2>
              <p className="faint">الإرسال البريدي غير مُفعّل في المنصة، لذلك لا تُرسل أي رسالة تلقائيًا. انسخ النص وأرسله يدويًا عبر مجموعة واتساب أو البريد إلى المسجّلين ({active.length}).</p>
              <p style={{ fontSize: '.9rem', background: 'var(--surface-soft)', padding: '.6rem', borderRadius: 8 }}>{notice}</p>
              <CopyButton text={notice} />
            </div>
          )}
        </aside>
      </div>

      <section className="stack" aria-labelledby="regs">
        <h2 id="regs">المسجّلون والحضور</h2>
        <p className="faint">يظهر هنا الاسم والفئة فقط. الحضور الفعلي يُسجَّل منفصلًا عن التسجيل.</p>
        {regs.length ? (
          <ActionForm action={setAttendance.bind(null, id)}>
            <div className="table-wrap"><table>
              <thead><tr><th>الاسم</th><th>الفئة</th><th>التسجيل</th><th>حضر</th><th><span className="sr-only">إجراء</span></th></tr></thead>
              <tbody>
                {regs.map((r) => (
                  <tr key={r.registration_id}>
                    <td>{r.full_name ?? '—'}</td>
                    <td>{CATEGORY_LABEL[r.category ?? ''] ?? '—'}</td>
                    <td>
                      {r.status === 'registered' ? <Badge tone="success">مسجّل</Badge> : <Badge>ألغي {r.cancelled_at ? fmtDateTime(r.cancelled_at) : ''}</Badge>}
                      <div className="faint">{fmtDateTime(r.registered_at)}</div>
                    </td>
                    <td>
                      {r.status === 'registered' ? (
                        <>
                          <input type="hidden" name="user_id" value={r.user_id} />
                          <label className="check"><input type="checkbox" name="present" value={r.user_id} defaultChecked={Boolean(r.attended)} /><span className="sr-only">حضر {r.full_name}</span></label>
                        </>
                      ) : '—'}
                    </td>
                    <td>{r.status === 'registered' && !started && <CancelReg eventId={id} regId={r.registration_id} name={r.full_name ?? ''} />}</td>
                  </tr>
                ))}
              </tbody>
            </table></div>
            {active.length > 0 && <div><SubmitButton className="btn secondary">حفظ الحضور</SubmitButton></div>}
          </ActionForm>
        ) : <EmptyState title="لا يوجد مسجّلون بعد" />}
      </section>
    </>
  );
}

function CancelReg({ eventId, regId, name }: { eventId: string; regId: string; name: string }) {
  return (
    <a className="btn ghost sm" href={`/admin/events/${eventId}/cancel-registration/${regId}?name=${encodeURIComponent(name)}`}>
      إلغاء التسجيل
    </a>
  );
}
