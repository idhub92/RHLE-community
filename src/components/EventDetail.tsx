import type { ReactNode } from 'react';
import type { EventRow } from '@/lib/data';
import { Alert, Badge } from './ui';
import { eventState } from './cards';
import { DELIVERY_LABEL, EVENT_TYPE_LABEL } from '@/lib/labels';
import { fmtDate, fmtDateTime, fmtHijri, fmtNumber, fmtTime } from '@/lib/format';

export function EventDetail({
  event: e,
  availability,
  panel,
}: {
  event: EventRow;
  availability: { registered_count: number; capacity: number | null; seats_left: number | null } | null;
  panel?: ReactNode;
}) {
  const st = eventState(e);
  const end = new Date(new Date(e.starts_at).getTime() + e.duration_minutes * 60000).toISOString();
  return (
    <div className="grid-2" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', alignItems: 'start' }}>
      <article className="card accent stack" style={{ gridColumn: 'span 1' }}>
        <div className="row" style={{ gap: '.4rem' }}>
          <Badge tone="info">{EVENT_TYPE_LABEL[e.event_type]}</Badge>
          <Badge tone={st.tone}>{st.label}</Badge>
        </div>
        <h1>{e.title}</h1>
        {e.rescheduled_from && e.status === 'published' && (
          <Alert tone="warning" title="تغيّر موعد الفعالية">
            كان الموعد السابق {fmtDateTime(e.rescheduled_from, e.timezone)}. {e.status_note}
          </Alert>
        )}
        {e.summary && <p className="muted">{e.summary}</p>}
        {e.description && (
          <div className="prose">
            {e.description.split('\n').filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}
          </div>
        )}
      </article>
      <aside className="stack">
        <div className="card stack">
          <dl className="kv">
            <dt>اليوم</dt>
            <dd>{fmtDate(e.starts_at, e.timezone)}</dd>
            <dt>الموافق</dt>
            <dd>{fmtHijri(e.starts_at, e.timezone)}</dd>
            <dt>الوقت</dt>
            <dd>
              {fmtTime(e.starts_at, e.timezone)} – {fmtTime(end, e.timezone)}
              <span className="faint"> (بتوقيت {e.timezone === 'Asia/Riyadh' ? 'الرياض' : e.timezone})</span>
            </dd>
            <dt>المكان</dt>
            <dd>{DELIVERY_LABEL[e.delivery_mode]}{e.location ? ` — ${e.location}` : ''}</dd>
            {e.registration_deadline && (
              <>
                <dt>آخر موعد للتسجيل</dt>
                <dd>{fmtDateTime(e.registration_deadline, e.timezone)}</dd>
              </>
            )}
            {availability && availability.capacity != null && (
              <>
                <dt>المقاعد</dt>
                <dd>
                  المتبقي {fmtNumber(availability.seats_left)} من {fmtNumber(availability.capacity)}
                </dd>
              </>
            )}
          </dl>
        </div>
        {panel && <div className="card stack">{panel}</div>}
      </aside>
    </div>
  );
}
