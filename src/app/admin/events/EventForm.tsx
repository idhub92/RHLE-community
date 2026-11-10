'use client';

import { FieldError, useActionForm } from '@/components/ActionForm';
import { DELIVERY_LABEL, EVENT_TYPE_LABEL } from '@/lib/labels';

export type EventValues = Partial<{
  title: string; summary: string | null; description: string | null; event_type: string; timezone: string;
  starts_local: string; duration_minutes: number; delivery_mode: string; location: string | null; meeting_url: string | null;
  capacity: number | null; deadline_local: string; show_when_past: boolean; status_note: string | null; status: string;
}>;

const TZ: Record<string, string> = {
  'Asia/Riyadh': 'الرياض (GMT+3)', 'Asia/Dubai': 'دبي (GMT+4)', 'Africa/Cairo': 'القاهرة', 'Asia/Amman': 'عمّان', 'Europe/London': 'لندن',
};

function F({ name, label, children, hint, req }: { name: string; label: string; children: React.ReactNode; hint?: string; req?: boolean }) {
  return (
    <div className="field">
      <label htmlFor={name} className={req ? 'req' : ''}>{label}</label>
      {children}
      {hint && <span className="hint">{hint}</span>}
      <FieldError name={name} />
    </div>
  );
}

export function EventFields({ v = {}, disabled = false }: { v?: EventValues; disabled?: boolean }) {
  const { state } = useActionForm();
  const inv = (n: string) => Boolean(state.fieldErrors?.[n]);
  return (
    <fieldset disabled={disabled} className="form">
      <F name="title" label="عنوان الفعالية" req>
        <input id="title" name="title" className="input" required minLength={3} maxLength={200} defaultValue={v.title ?? ''} aria-invalid={inv('title')} />
      </F>
      <div className="form-grid">
        <F name="event_type" label="النوع" req>
          <select id="event_type" name="event_type" className="input" defaultValue={v.event_type ?? 'council'}>
            {Object.entries(EVENT_TYPE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </F>
        <F name="delivery_mode" label="طريقة التقديم" req>
          <select id="delivery_mode" name="delivery_mode" className="input" defaultValue={v.delivery_mode ?? 'online'}>
            {Object.entries(DELIVERY_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </F>
      </div>
      <F name="summary" label="ملخص قصير" hint="يظهر في بطاقة الفعالية. ٤٠٠ حرف كحد أقصى.">
        <textarea id="summary" name="summary" className="input" maxLength={400} defaultValue={v.summary ?? ''} style={{ minBlockSize: 70 }} />
      </F>
      <F name="description" label="الوصف التفصيلي">
        <textarea id="description" name="description" className="input" maxLength={8000} defaultValue={v.description ?? ''} />
      </F>
      <div className="form-grid">
        <F name="starts_local" label="موعد البداية" req>
          <input id="starts_local" name="starts_local" type="datetime-local" className="input" required defaultValue={v.starts_local ?? ''} aria-invalid={inv('starts_local')} />
        </F>
        <F name="duration_minutes" label="المدة بالدقائق" req>
          <input id="duration_minutes" name="duration_minutes" type="number" min={10} max={1440} className="input" required defaultValue={v.duration_minutes ?? 90} />
        </F>
        <F name="timezone" label="المنطقة الزمنية">
          <select id="timezone" name="timezone" className="input" defaultValue={v.timezone ?? 'Asia/Riyadh'}>
            {Object.entries(TZ).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </F>
      </div>
      <div className="form-grid">
        <F name="location" label="المكان أو المنصة" hint="مثال: عن بُعد عبر Teams">
          <input id="location" name="location" className="input" maxLength={300} defaultValue={v.location ?? ''} />
        </F>
        <F name="meeting_url" label="رابط الاجتماع" hint="يظهر للمسجّلين فقط.">
          <input id="meeting_url" name="meeting_url" type="url" dir="ltr" className="input" maxLength={500} defaultValue={v.meeting_url ?? ''} aria-invalid={inv('meeting_url')} />
        </F>
      </div>
      <div className="form-grid">
        <F name="capacity" label="السعة" hint="اتركه فارغًا إن لم يكن هناك حد.">
          <input id="capacity" name="capacity" inputMode="numeric" className="input" defaultValue={v.capacity ?? ''} aria-invalid={inv('capacity')} />
        </F>
        <F name="deadline_local" label="آخر موعد للتسجيل">
          <input id="deadline_local" name="deadline_local" type="datetime-local" className="input" defaultValue={v.deadline_local ?? ''} aria-invalid={inv('deadline_local')} />
        </F>
      </div>
      {v.status && v.status !== 'draft' && (
        <F name="status_note" label="ملاحظة للمسجّلين" hint="مطلوبة عند تغيير موعد فعالية منشورة، وتظهر في صفحة الفعالية.">
          <textarea id="status_note" name="status_note" className="input" maxLength={1000} defaultValue={v.status_note ?? ''} style={{ minBlockSize: 70 }} aria-invalid={inv('status_note')} />
        </F>
      )}
      <label className="check">
        <input type="checkbox" name="show_when_past" defaultChecked={v.show_when_past ?? true} />
        <span>إظهارها ضمن «الفعاليات السابقة» بعد انتهائها</span>
      </label>
    </fieldset>
  );
}
