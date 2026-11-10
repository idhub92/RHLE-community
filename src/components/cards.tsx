import Link from 'next/link';
import type { EventRow, ResourceRow } from '@/lib/data';
import { Icon } from './Icon';
import { Badge, DraftFlag } from './ui';
import { DELIVERY_LABEL, EVENT_TYPE_LABEL, LANGUAGE_LABEL, RESOURCE_TYPE_LABEL } from '@/lib/labels';
import { fmtDate, fmtTime } from '@/lib/format';

function dayMonth(iso: string, tz: string) {
  const d = new Date(iso);
  return {
    d: new Intl.DateTimeFormat('ar-SA-u-ca-gregory', { timeZone: tz, day: 'numeric' }).format(d),
    m: new Intl.DateTimeFormat('ar-SA-u-ca-gregory', { timeZone: tz, month: 'short' }).format(d),
  };
}

export function eventState(e: EventRow): { label: string; tone: string } {
  if (e.status === 'cancelled') return { label: 'ملغاة', tone: 'danger' };
  if (e.status === 'completed' || new Date(e.starts_at) < new Date()) return { label: 'منتهية', tone: 'neutral' };
  if (e.status === 'draft') return { label: 'مسودة', tone: 'neutral' };
  if (e.status === 'archived') return { label: 'مؤرشفة', tone: 'warning' };
  if (!e.registration_open) return { label: 'التسجيل مغلق', tone: 'warning' };
  if (e.registration_deadline && new Date(e.registration_deadline) < new Date())
    return { label: 'انتهى موعد التسجيل', tone: 'warning' };
  return { label: 'التسجيل متاح', tone: 'success' };
}

export function EventCard({ e, href }: { e: EventRow; href?: string }) {
  const dm = dayMonth(e.starts_at, e.timezone);
  const st = eventState(e);
  return (
    <Link href={href ?? `/events/${e.id}`} className="card card-link">
      <div className="row" style={{ alignItems: 'flex-start', flexWrap: 'nowrap' }}>
        <div className="date-chip" aria-hidden="true">
          <span className="d">{dm.d}</span>
          <span className="m">{dm.m}</span>
        </div>
        <div className="stack" style={{ gap: '.35rem', minInlineSize: 0 }}>
          <div className="row" style={{ gap: '.4rem' }}>
            <Badge tone="info">{EVENT_TYPE_LABEL[e.event_type] ?? e.event_type}</Badge>
            <Badge tone={st.tone}>{st.label}</Badge>
            {e.rescheduled_from && e.status === 'published' && <Badge tone="warning">موعد معدّل</Badge>}
          </div>
          <h3>{e.title}</h3>
          <div className="meta">
            <span>{fmtDate(e.starts_at, e.timezone)}</span>
            <span>{fmtTime(e.starts_at, e.timezone)}</span>
            <span>{DELIVERY_LABEL[e.delivery_mode]}</span>
          </div>
          {e.summary && <p className="muted" style={{ fontSize: '.92rem' }}>{e.summary}</p>}
        </div>
      </div>
    </Link>
  );
}

export function ResourceCard({ r, base }: { r: ResourceRow; base: '/library' | '/tools' }) {
  return (
    <Link href={`${base}/${r.id}`} className="card card-link stack" style={{ gap: '.5rem' }}>
      <div className="row" style={{ gap: '.4rem' }}>
        <Badge tone="info">{RESOURCE_TYPE_LABEL[r.resource_type] ?? r.resource_type}</Badge>
        {r.category && <span className="tag">{r.category}</span>}
        {r.kind === 'tool' && r.is_initial_draft && <DraftFlag />}
      </div>
      <h3>{r.title}</h3>
      {r.description && (
        <p className="muted" style={{ fontSize: '.92rem', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {r.description}
        </p>
      )}
      <div className="meta">
        {r.author_source && <span>{r.author_source}</span>}
        {r.publication_year && <span>{r.publication_year}</span>}
        <span>{LANGUAGE_LABEL[r.language]}</span>
        {r.kind === 'tool' && <span>الإصدار {r.version}</span>}
        {r.file_name && r.distribution_allowed && (
          <span className="row" style={{ gap: '.25rem' }}>
            <Icon name="download" size={15} /> ملف متاح
          </span>
        )}
      </div>
    </Link>
  );
}
