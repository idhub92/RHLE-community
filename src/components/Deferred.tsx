import Link from 'next/link';
import type { ReactNode } from 'react';
import { Banner } from './Banner';
import { Icon } from './Icon';
import { Alert, Badge, PageHead } from './ui';

/** Introductory page for a space that opens after the pilot. No functional submission controls. */
export function DeferredSection({
  title,
  lead,
  icon,
  bullets,
  availability,
  extra,
}: {
  title: string;
  lead: string;
  icon: string;
  bullets: string[];
  availability: string;
  extra?: ReactNode;
}) {
  return (
    <div className="container stack-lg">
      <Banner compact />
      <PageHead title={title} lead={lead} actions={<Badge tone="warning">تُفتح لاحقًا</Badge>} />
      <div className="grid-2">
        <section className="card accent stack">
          <div className="row">
            <span className="space-card"><span className="ico"><Icon name={icon} /></span></span>
            <h2>ماذا ستضم هذه المساحة؟</h2>
          </div>
          <ul className="prose" style={{ paddingInlineStart: '1.2rem', margin: 0 }}>
            {bullets.map((b) => <li key={b}>{b}</li>)}
          </ul>
        </section>
        <section className="stack">
          <Alert tone="info" title="موعد الإتاحة">{availability}</Alert>
          {extra}
          <div className="card soft stack" style={{ gap: '.5rem' }}>
            <p className="muted">إلى أن تُفتح هذه المساحة، يمكنك المشاركة في الفعاليات والاستفادة من المكتبة والأدوات.</p>
            <div className="row">
              <Link className="btn secondary sm" href="/events">الفعاليات</Link>
              <Link className="btn secondary sm" href="/library">مكتبة المصمم</Link>
              <Link className="btn secondary sm" href="/tools">أدوات المصمم</Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
