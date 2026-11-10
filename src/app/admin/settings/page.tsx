import { ActionForm, SubmitButton } from '@/components/ActionForm';
import { PageHead, Restricted, Alert } from '@/components/ui';
import { adminPage } from '@/lib/admin';
import { TextField } from '@/app/auth/fields';
import { fmtShort } from '@/lib/format';
import { publishPolicy, saveSettings } from './actions';

export default async function SettingsPage() {
  const gate = await adminPage('platform.admin');
  if (!gate.ok) return <Restricted reason={gate.reason} />;
  const { supabase } = gate;
  const [{ data: settings }, { data: policies }] = await Promise.all([
    supabase.from('settings').select('key,value'),
    supabase.from('policies').select('id,version,title,body,published_at,is_current').order('published_at', { ascending: false }),
  ]);
  const get = (k: string) => settings?.find((s) => s.key === k)?.value;
  const t = (get('pilot_targets') ?? {}) as Record<string, number>;
  const p = (get('pilot_period') ?? {}) as { start?: string; end?: string };
  const current = policies?.find((x) => x.is_current);

  return (
    <>
      <PageHead title="إعدادات المنصة" />
      <section className="card accent stack">
        <h2>الإعدادات العامة</h2>
        <ActionForm action={saveSettings} warnUnsaved>
          <TextField name="whatsapp_invite_url" label="رابط دعوة مجموعة واتساب" type="url" required={false} dirLtr defaultValue={(get('whatsapp_invite_url') as string) ?? ''} hint="يظهر للأعضاء النشطين فقط. اتركه فارغًا لإخفاء زر الدعوة." />
          <TextField name="contact_email" label="بريد التواصل العام" type="email" required={false} dirLtr defaultValue={(get('contact_email') as string) ?? ''} />
          <fieldset className="stack">
            <legend>مستهدفات المرحلة التجريبية (تُعرض منفصلة عن الأرقام الفعلية، ولا تقيّد التسجيل)</legend>
            <div className="form-grid">
              <TextField name="t_members" label="الأعضاء" type="number" defaultValue={String(t.members ?? 30)} />
              <TextField name="t_references" label="المراجع" type="number" defaultValue={String(t.references ?? 3)} />
              <TextField name="t_tools" label="الأدوات" type="number" defaultValue={String(t.tools ?? 3)} />
              <TextField name="t_events" label="الفعاليات" type="number" defaultValue={String(t.events ?? 1)} />
            </div>
            <div className="form-grid">
              <TextField name="p_start" label="بداية المرحلة" type="date" defaultValue={p.start ?? ''} />
              <TextField name="p_end" label="نهاية المرحلة" type="date" defaultValue={p.end ?? ''} />
            </div>
          </fieldset>
          <div><SubmitButton>حفظ الإعدادات</SubmitButton></div>
        </ActionForm>
      </section>

      <section className="card stack">
        <h2>سياسة الخصوصية وميثاق المجتمع</h2>
        {current && <Alert tone="info">النسخة الحالية: {current.version} — نُشرت {fmtShort(current.published_at)}. تُحفظ موافقة كل عضو مع رقم النسخة وتاريخها.</Alert>}
        <ActionForm
          action={publishPolicy}
          warnUnsaved
          confirm={{ title: 'نشر نسخة جديدة من السياسة؟', body: 'تصبح النسخة الحالية للأعضاء الجدد، ويُطلب من الأعضاء الحاليين تأكيد موافقتهم عليها.', confirmLabel: 'نشر النسخة' }}
        >
          <div className="form-grid">
            <TextField name="version" label="رقم النسخة الجديدة" dirLtr hint="مثال: 1.1" />
            <TextField name="title" label="العنوان" defaultValue={current?.title ?? 'سياسة الخصوصية وميثاق المجتمع'} />
          </div>
          <div className="field">
            <label htmlFor="body" className="req">النص</label>
            <textarea id="body" name="body" className="input" style={{ minBlockSize: 320 }} required defaultValue={current?.body ?? ''} />
            <span className="hint">«## » لعنوان فرعي، و«- » لعنصر قائمة.</span>
          </div>
          <div><SubmitButton className="btn secondary">نشر نسخة جديدة</SubmitButton></div>
        </ActionForm>
        {policies && policies.length > 1 && (
          <details>
            <summary>النسخ السابقة ({policies.length - 1})</summary>
            <ul>{policies.filter((x) => !x.is_current).map((x) => <li key={x.id}>{x.version} — {fmtShort(x.published_at)}</li>)}</ul>
          </details>
        )}
      </section>
    </>
  );
}
