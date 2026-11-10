'use client';

import { useRef, useState, type ReactNode } from 'react';
import { Icon } from './Icon';

export function NavToggle({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="btn ghost sm menu-toggle"
        aria-expanded={open}
        aria-controls="main-nav"
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="menu" />
        <span className="sr-only">القائمة</span>
      </button>
      <nav id="main-nav" className={`nav${open ? ' open' : ''}`} aria-label="الأقسام" onClick={() => setOpen(false)}>
        {children}
      </nav>
    </>
  );
}

/** Opens the published policy in a dialog (used in the membership form). */
export function PolicyDialog({ label, title, children }: { label: string; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className="btn ghost sm" style={{ paddingInline: '.3rem' }} onClick={() => ref.current?.showModal()}>
        {label}
      </button>
      <dialog ref={ref} aria-labelledby="policy-dlg-title" style={{ inlineSize: 'min(720px, 100% - 2rem)' }}>
        <div className="dlg-body" style={{ maxBlockSize: '65vh', overflowY: 'auto' }}>
          <h2 id="policy-dlg-title">{title}</h2>
          {children}
        </div>
        <div className="dlg-actions">
          <button type="button" className="btn" onClick={() => ref.current?.close()}>
            إغلاق
          </button>
        </div>
      </dialog>
    </>
  );
}

export function CopyButton({ text, label = 'نسخ النص' }: { text: string; label?: string }) {
  const [done, setDone] = useState<'idle' | 'ok' | 'err'>('idle');
  return (
    <button
      type="button"
      className="btn secondary sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone('ok');
        } catch {
          setDone('err');
        }
        setTimeout(() => setDone('idle'), 2500);
      }}
    >
      {done === 'ok' ? 'نُسخ ✓' : done === 'err' ? 'تعذّر النسخ — انسخ يدويًا' : label}
    </button>
  );
}

/** A plain link that first asks for confirmation (e.g. leaving to an external site). */
export function ConfirmLink({
  href,
  children,
  title,
  body,
  className = 'btn',
}: {
  href: string;
  children: ReactNode;
  title: string;
  body: string;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  return (
    <>
      <button type="button" className={className} onClick={() => ref.current?.showModal()}>
        {children}
      </button>
      <dialog ref={ref} aria-labelledby="cl-title">
        <div className="dlg-body">
          <h2 id="cl-title" style={{ fontSize: '1.15rem' }}>{title}</h2>
          <p className="muted">{body}</p>
        </div>
        <div className="dlg-actions">
          <button type="button" className="btn secondary" onClick={() => ref.current?.close()}>
            تراجع
          </button>
          <a className="btn" href={href} target="_blank" rel="noopener noreferrer" onClick={() => ref.current?.close()}>
            متابعة
          </a>
        </div>
      </dialog>
    </>
  );
}
