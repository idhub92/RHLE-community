import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EventDetail } from '@/components/EventDetail';
import { ActionForm, SubmitButton } from '@/components/ActionForm';
import { Alert } from '@/components/ui';
import { getAvailability, getPublicEvent } from '@/lib/data';
import { getSession } from '@/lib/session';
import { createClient } from '@/lib/supabase/server';
import { fmtDateTime } from '@/lib/format';
import { cancelRegistration, registerForEvent } from '../actions';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const e = await getPublicEvent(id);
  return { title: e?.title ?? 'فعالية' };
}

export default async function EventPage({ params }: Props) {
  const { id } = await params;
  const event = await getPublicEvent(id);
  if (!event) notFound();
  const [session, availability] = await Promise.all([getSession(), getAvailability(id)]);

  let registered = false;
  let meetingUrl: string | null = null;
  if (session) {
    const supabase = (await createClient())!;
    const { data: reg } = await supabase
      .from('event_registrations')
      .select('id')
      .eq('event_id', id)
      .eq('user_id', session.userId)
      .eq('status', 'registered')
      .maybeSingle();
    registered = Boolean(reg);
    if (registered) {
      const { data: priv } = await supabase.from('event_private').select('meeting_url').eq('event_id', id).maybeSingle();
      meetingUrl = priv?.meeting_url ?? null;
    }
  }

  const here = `/events/${id}`;
  const now = new Date();
  const started = new Date(event.starts_at) <= now || event.status === 'completed';
  const deadlinePassed = event.registration_deadline ? new Date(event.registration_deadline) < now : false;
  const full = availability?.seats_left === 0;

  let panel: React.ReactNode;
  if (event.status === 'cancelled') {
    panel = <Alert tone="error" title="أُلغيت هذه الفعالية">{event.status_note}</Alert>;
  } else if (started) {
    panel = <Alert tone="info">انتهت هذه الفعالية.</Alert>;
  } else if (registered) {
    panel = (
      <div className="stack">
        <Alert tone="success" title="أنت مسجّل في هذه الفعالية">
          {meetingUrl ? (
            <>
              رابط الحضور:{' '}
              <a className="ltr" href={meetingUrl} target="_blank" rel="noopener noreferrer">{meetingUrl}</a>
            </>
          ) : (
            'سيظهر رابط الحضور هنا وفي «حسابي» عند إضافته من الفريق.'
          )}
        </Alert>
        <ActionForm
          action={cancelRegistration.bind(null, id)}
          confirm={{
            title: 'إلغاء التسجيل؟',
            body: 'سيُتاح مقعدك لعضو آخر. يمكنك التسجيل مرة أخرى ما دام التسجيل مفتوحًا والمقاعد متاحة.',
            confirmLabel: 'نعم، ألغِ التسجيل',
            tone: 'danger',
          }}
        >
          <div><SubmitButton className="btn danger-outline" pendingLabel="جارٍ الإلغاء…">إلغاء التسجيل</SubmitButton></div>
        </ActionForm>
      </div>
    );
  } else if (!event.registration_open) {
    panel = <Alert tone="warning">التسجيل في هذه الفعالية غير مفتوح حاليًا.</Alert>;
  } else if (deadlinePassed) {
    panel = <Alert tone="warning">انتهى موعد التسجيل ({fmtDateTime(event.registration_deadline, event.timezone)}).</Alert>;
  } else if (full) {
    panel = <Alert tone="warning">اكتمل العدد المتاح لهذه الفعالية.</Alert>;
  } else if (!session) {
    panel = (
      <div className="stack">
        <p className="muted">التسجيل متاح لأعضاء المجتمع. سجّل الدخول أو أنشئ حسابًا وستعود إلى هذه الصفحة بعد ذلك.</p>
        <div className="row">
          <Link className="btn" href={`/auth/sign-in?next=${encodeURIComponent(here)}`}>سجّل الدخول للتسجيل</Link>
          <Link className="btn secondary" href={`/auth/sign-up?next=${encodeURIComponent(here)}`}>انضم إلى المجتمع</Link>
        </div>
      </div>
    );
  } else if (session.status === 'incomplete') {
    panel = (
      <div className="stack">
        <p className="muted">أكمل بيانات عضويتك أولًا، ثم ستعود إلى هذه الفعالية لإتمام التسجيل.</p>
        <div><Link className="btn" href={`/onboarding?next=${encodeURIComponent(here)}`}>أكمل عضويتك</Link></div>
      </div>
    );
  } else if (session.status !== 'active') {
    panel = <Alert tone="warning">عضويتك غير نشطة حاليًا، لذلك لا يمكنك التسجيل في الفعاليات.</Alert>;
  } else {
    panel = (
      <ActionForm action={registerForEvent.bind(null, id)}>
        <p className="muted">سيُؤكَّد تسجيلك فورًا بعد التحقق من توفر المقاعد وموعد التسجيل.</p>
        <div><SubmitButton pendingLabel="جارٍ التسجيل…">سجّلني في الفعالية</SubmitButton></div>
      </ActionForm>
    );
  }

  return (
    <div className="container">
      <p style={{ marginBlockEnd: '1rem' }}><Link href="/events">← كل الفعاليات</Link></p>
      <EventDetail event={event} availability={availability} panel={panel} />
    </div>
  );
}
