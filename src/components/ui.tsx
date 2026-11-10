import type { ReactNode } from 'react';
import { Icon } from './Icon';
import { TONE } from '@/lib/labels';

export function Badge({ tone = 'neutral', children }: { tone?: string; children: ReactNode }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function StatusBadge({ status, labels }: { status: string; labels: Record<string, string> }) {
  return <Badge tone={TONE[status] ?? 'neutral'}>{labels[status] ?? status}</Badge>;
}

export function DraftFlag() {
  return <span className="badge draft-flag">نسخة أولية — بانتظار اعتماد الفريق</span>;
}

export function Alert({
  tone = 'info',
  children,
  title,
}: {
  tone?: 'info' | 'success' | 'error' | 'warning';
  children?: ReactNode;
  title?: string;
}) {
  const icon = tone === 'success' ? 'check' : tone === 'info' ? 'info' : 'alert';
  return (
    <div className={`alert ${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon name={icon} size={18} />
      <div>
        {title && <strong style={{ display: 'block' }}>{title}</strong>}
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <h3>{title}</h3>
      {children && <p>{children}</p>}
      {action && <div style={{ marginBlockStart: '1rem' }}>{action}</div>}
    </div>
  );
}

export function PageHead({ title, lead, eyebrow, actions }: { title: string; lead?: ReactNode; eyebrow?: string; actions?: ReactNode }) {
  return (
    <header className="row-between" style={{ marginBlockEnd: '1.25rem', alignItems: 'flex-end' }}>
      <div className="stack" style={{ gap: '.35rem' }}>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>{title}</h1>
        {lead && <p className="muted prose">{lead}</p>}
      </div>
      {actions && <div className="row">{actions}</div>}
    </header>
  );
}

/** Renders the simple "## heading / - item / paragraph" format used for policy text. */
export function SimpleText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) {
      blocks.push(
        <ul key={`l${blocks.length}`}>
          {list.map((li, i) => (
            <li key={i}>{li}</li>
          ))}
        </ul>
      );
      list = [];
    }
  };
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line) { flush(); continue; }
    if (line.startsWith('- ')) { list.push(line.slice(2)); continue; }
    flush();
    if (line.startsWith('## ')) blocks.push(<h2 key={blocks.length}>{line.slice(3)}</h2>);
    else blocks.push(<p key={blocks.length}>{line}</p>);
  }
  flush();
  return <div className="prose">{blocks}</div>;
}

export function Restricted({ reason }: { reason?: string }) {
  return (
    <div className="narrow" style={{ paddingBlock: '2rem' }}>
      <div className="card accent stack">
        <div className="row">
          <Icon name="lock" />
          <h1 style={{ fontSize: '1.3rem' }}>وصول مقيّد</h1>
        </div>
        <p className="muted">{reason ?? 'هذه الصفحة متاحة لأعضاء فريق التشغيل المخوّلين فقط.'}</p>
        <div className="row">
          <a className="btn secondary" href="/">العودة إلى الرئيسية</a>
          <a className="btn ghost" href="/account">حسابي</a>
        </div>
      </div>
    </div>
  );
}
