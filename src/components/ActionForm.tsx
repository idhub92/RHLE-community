'use client';

import {
  createContext,
  useActionState,
  useContext,
  useEffect,
  useRef,
  useState,
  startTransition,
  type ReactNode,
  type FormEvent,
} from 'react';
import { usePathname } from 'next/navigation';
import type { ActionState } from '@/lib/action';

type ServerAction = (prev: ActionState, fd: FormData) => Promise<ActionState>;

export type ConfirmSpec = {
  title: string;
  body?: string;
  confirmLabel: string;
  tone?: 'danger' | 'primary';
  /** if set, the dialog asks for a reason sent under this field name */
  reasonField?: string;
  reasonLabel?: string;
  reasonRequired?: boolean;
};

const FormCtx = createContext<{ pending: boolean; state: ActionState; active: string }>({
  pending: false,
  state: {},
  active: '',
});
export const useActionForm = () => useContext(FormCtx);

/**
 * Form wrapper for server actions:
 *  - submits without React's automatic form reset, so entered data survives a failed request;
 *  - blocks duplicate submissions while pending;
 *  - optional confirmation dialog (with an optional reason field);
 *  - optional "unsaved changes" guard for editors;
 *  - shows success / error messages and a session-expired dialog.
 */
export function ActionForm({
  action,
  children,
  className = 'form',
  confirm,
  warnUnsaved = false,
  resetOnSuccess = false,
  showMessages = true,
  id,
}: {
  action: ServerAction;
  children: ReactNode;
  className?: string;
  confirm?: ConfirmSpec;
  warnUnsaved?: boolean;
  resetOnSuccess?: boolean;
  showMessages?: boolean;
  id?: string;
}) {
  const [state, formAction, pending] = useActionState(action, {} as ActionState);
  const formRef = useRef<HTMLFormElement>(null);
  const dlgRef = useRef<HTMLDialogElement>(null);
  const leaveRef = useRef<HTMLDialogElement>(null);
  const expiredRef = useRef<HTMLDialogElement>(null);
  const [dirty, setDirty] = useState(false);
  const [active, setActive] = useState('');
  const [reason, setReason] = useState('');
  const [reasonErr, setReasonErr] = useState(false);
  const pendingHref = useRef<string | null>(null);
  const submitter = useRef<HTMLElement | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (state.ok) {
      setDirty(false);
      if (resetOnSuccess) formRef.current?.reset();
    }
    if (state.sessionExpired) expiredRef.current?.showModal();
  }, [state, resetOnSuccess]);

  // unsaved-changes guard
  useEffect(() => {
    if (!warnUnsaved || !dirty) return;
    const beforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement)?.closest?.('a');
      if (!a || a.target === '_blank' || e.defaultPrevented || e.metaKey || e.ctrlKey) return;
      const href = a.getAttribute('href');
      if (!href || href.startsWith('#')) return;
      e.preventDefault();
      pendingHref.current = href;
      leaveRef.current?.showModal();
    };
    window.addEventListener('beforeunload', beforeUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [warnUnsaved, dirty]);

  function send(extra?: Record<string, string>) {
    const form = formRef.current;
    if (!form || pending) return;
    const fd = new FormData(form);
    const sub = submitter.current as HTMLButtonElement | null;
    if (sub?.name) fd.set(sub.name, sub.value);
    setActive(sub?.name ? `${sub.name}=${sub.value}` : '');
    if (extra) for (const [k, v] of Object.entries(extra)) fd.set(k, v);
    startTransition(() => formAction(fd));
  }

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (pending) return;
    submitter.current = ((e.nativeEvent as SubmitEvent).submitter as HTMLElement) ?? null;
    if (!e.currentTarget.reportValidity()) return;
    if (confirm) {
      setReason('');
      setReasonErr(false);
      dlgRef.current?.showModal();
      return;
    }
    send();
  }

  function onConfirm() {
    if (confirm?.reasonField && confirm.reasonRequired && !reason.trim()) {
      setReasonErr(true);
      return;
    }
    dlgRef.current?.close();
    send(confirm?.reasonField ? { [confirm.reasonField]: reason.trim() } : undefined);
  }

  return (
    <FormCtx.Provider value={{ pending, state, active }}>
      <form
        id={id}
        ref={formRef}
        className={className}
        onSubmit={onSubmit}
        onInput={() => warnUnsaved && setDirty(true)}
        aria-busy={pending}
        noValidate={false}
      >
        {children}
        {showMessages && <FormMessage />}
      </form>

      {confirm && (
        <dialog ref={dlgRef} aria-labelledby={`${id ?? 'f'}-dlg-title`}>
          <div className="dlg-body">
            <h2 id={`${id ?? 'f'}-dlg-title`} style={{ fontSize: '1.15rem' }}>
              {confirm.title}
            </h2>
            {confirm.body && <p className="muted">{confirm.body}</p>}
            {confirm.reasonField && (
              <div className="field">
                <label htmlFor={`${id ?? 'f'}-reason`} className={confirm.reasonRequired ? 'req' : ''}>
                  {confirm.reasonLabel ?? 'السبب'}
                </label>
                <textarea
                  id={`${id ?? 'f'}-reason`}
                  className="input"
                  value={reason}
                  maxLength={1000}
                  aria-invalid={reasonErr}
                  onChange={(e) => {
                    setReason(e.target.value);
                    setReasonErr(false);
                  }}
                />
                {reasonErr && <span className="err">هذا الحقل مطلوب.</span>}
              </div>
            )}
          </div>
          <div className="dlg-actions">
            <button type="button" className="btn secondary" onClick={() => dlgRef.current?.close()}>
              تراجع
            </button>
            <button type="button" className={`btn ${confirm.tone === 'danger' ? 'danger' : ''}`} onClick={onConfirm}>
              {confirm.confirmLabel}
            </button>
          </div>
        </dialog>
      )}

      {warnUnsaved && (
        <dialog ref={leaveRef} aria-labelledby="leave-title">
          <div className="dlg-body">
            <h2 id="leave-title" style={{ fontSize: '1.15rem' }}>لديك تعديلات غير محفوظة</h2>
            <p className="muted">إذا غادرت الصفحة الآن فستفقد التعديلات التي لم تحفظها.</p>
          </div>
          <div className="dlg-actions">
            <button type="button" className="btn secondary" onClick={() => leaveRef.current?.close()}>
              البقاء في الصفحة
            </button>
            <button
              type="button"
              className="btn danger"
              onClick={() => {
                setDirty(false);
                leaveRef.current?.close();
                if (pendingHref.current) window.location.href = pendingHref.current;
              }}
            >
              المغادرة دون حفظ
            </button>
          </div>
        </dialog>
      )}

      <dialog ref={expiredRef} aria-labelledby="expired-title">
        <div className="dlg-body">
          <h2 id="expired-title" style={{ fontSize: '1.15rem' }}>انتهت الجلسة</h2>
          <p className="muted">
            انتهت جلسة الدخول. بياناتك ما زالت في النموذج؛ سجّل الدخول في نافذة جديدة ثم أعد الإرسال، أو انتقل لتسجيل الدخول الآن.
          </p>
        </div>
        <div className="dlg-actions">
          <button type="button" className="btn secondary" onClick={() => expiredRef.current?.close()}>
            إغلاق
          </button>
          <a className="btn" href={`/auth/sign-in?expired=1&next=${encodeURIComponent(pathname)}`}>
            تسجيل الدخول
          </a>
        </div>
      </dialog>
    </FormCtx.Provider>
  );
}

export function FormMessage() {
  const { state } = useActionForm();
  if (state.error)
    return (
      <div className="alert error" role="alert">
        {state.error}
      </div>
    );
  if (state.ok && state.message)
    return (
      <div className="alert success" role="status">
        {state.message}
      </div>
    );
  return null;
}

export function FieldError({ name }: { name: string }) {
  const { state } = useActionForm();
  const msg = state.fieldErrors?.[name];
  return msg ? (
    <span className="err" id={`${name}-err`}>
      {msg}
    </span>
  ) : null;
}

export function SubmitButton({
  children,
  pendingLabel = 'جارٍ الإرسال…',
  className = 'btn',
  name,
  value,
}: {
  children: ReactNode;
  pendingLabel?: string;
  className?: string;
  name?: string;
  value?: string;
}) {
  const { pending, active } = useActionForm();
  const mine = !active || active === `${name}=${value}`;
  return (
    <button type="submit" className={className} disabled={pending} name={name} value={value} aria-disabled={pending}>
      {pending && mine ? (
        <>
          <span className="spinner" aria-hidden="true" />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}
