'use client';

import { FieldError, useActionForm } from '@/components/ActionForm';
import { LANGUAGE_LABEL, REFERENCE_TYPES, RESOURCE_TYPE_LABEL, TOOL_CATEGORIES, TOOL_TYPES } from '@/lib/labels';

export type ResourceValues = Partial<{
  resource_type: string;
  title: string;
  description: string | null;
  category: string | null;
  tags: string[];
  language: string;
  author_source: string | null;
  publication_year: number | null;
  source_url: string | null;
  external_tool_url: string | null;
  purpose: string | null;
  instructions: string | null;
  usage_notes: string | null;
  version: string;
  is_initial_draft: boolean;
  distribution_allowed: boolean;
  file_name: string | null;
}>;

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

export function ResourceFields({ kind, v = {}, disabled = false }: { kind: 'reference' | 'tool'; v?: ResourceValues; disabled?: boolean }) {
  const { state } = useActionForm();
  const inv = (n: string) => Boolean(state.fieldErrors?.[n]);
  const isTool = kind === 'tool';
  const types = isTool ? TOOL_TYPES : REFERENCE_TYPES;
  return (
    <fieldset disabled={disabled} className="form">
      <input type="hidden" name="kind" value={kind} />
      <div className="form-grid">
        <F name="resource_type" label="النوع" req>
          <select id="resource_type" name="resource_type" className="input" required defaultValue={v.resource_type ?? ''} aria-invalid={inv('resource_type')}>
            <option value="" disabled>اختر…</option>
            {types.map((t) => <option key={t} value={t}>{RESOURCE_TYPE_LABEL[t]}</option>)}
          </select>
        </F>
        <F name="category" label="التصنيف" hint={isTool ? 'التصنيفات الأولى مقترحة في القائمة.' : 'مثال: التقويم، التعلم الإلكتروني'}>
          <input id="category" name="category" className="input" list={isTool ? 'tool-cats' : undefined} maxLength={80} defaultValue={v.category ?? ''} />
          {isTool && <datalist id="tool-cats">{TOOL_CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>}
        </F>
      </div>
      <F name="title" label="العنوان" req>
        <input id="title" name="title" className="input" required minLength={3} maxLength={200} defaultValue={v.title ?? ''} aria-invalid={inv('title')} />
      </F>
      <F name="description" label="الوصف">
        <textarea id="description" name="description" className="input" maxLength={4000} defaultValue={v.description ?? ''} />
      </F>
      {isTool && (
        <>
          <F name="purpose" label="الغرض والاستخدام المقصود">
            <textarea id="purpose" name="purpose" className="input" maxLength={2000} defaultValue={v.purpose ?? ''} />
          </F>
          <F name="instructions" label="التعليمات" hint="خطوة في كل سطر.">
            <textarea id="instructions" name="instructions" className="input" maxLength={6000} defaultValue={v.instructions ?? ''} />
          </F>
        </>
      )}
      <div className="form-grid">
        <F name="author_source" label={isTool ? 'الإعداد / الجهة' : 'المؤلف أو المصدر'}>
          <input id="author_source" name="author_source" className="input" maxLength={300} defaultValue={v.author_source ?? ''} />
        </F>
        {!isTool && (
          <F name="publication_year" label="سنة النشر">
            <input id="publication_year" name="publication_year" className="input" inputMode="numeric" pattern="\d{4}" defaultValue={v.publication_year ?? ''} aria-invalid={inv('publication_year')} />
          </F>
        )}
        <F name="language" label="اللغة">
          <select id="language" name="language" className="input" defaultValue={v.language ?? 'ar'}>
            {Object.entries(LANGUAGE_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </F>
        <F name="version" label="الإصدار" req>
          <input id="version" name="version" className="input ltr-field" dir="ltr" required maxLength={20} defaultValue={v.version ?? '0.1'} />
        </F>
      </div>
      <div className="form-grid">
        <F name="source_url" label="رابط المصدر الأصلي">
          <input id="source_url" name="source_url" type="url" className="input" dir="ltr" maxLength={500} defaultValue={v.source_url ?? ''} aria-invalid={inv('source_url')} />
        </F>
        {isTool && (
          <F name="external_tool_url" label="رابط الأداة الخارجية" hint="https فقط.">
            <input id="external_tool_url" name="external_tool_url" type="url" className="input" dir="ltr" maxLength={500} defaultValue={v.external_tool_url ?? ''} aria-invalid={inv('external_tool_url')} />
          </F>
        )}
      </div>
      <F name="tags" label="الوسوم" hint="افصل بينها بفاصلة. ١٢ وسمًا كحد أقصى.">
        <input id="tags" name="tags" className="input" maxLength={400} defaultValue={(v.tags ?? []).join('، ')} />
      </F>
      <F name="usage_notes" label="شروط الاستخدام والإسناد">
        <textarea id="usage_notes" name="usage_notes" className="input" maxLength={1000} defaultValue={v.usage_notes ?? ''} style={{ minBlockSize: 70 }} />
      </F>

      <div className="card soft stack" style={{ gap: '.6rem' }}>
        <strong>الملف</strong>
        {v.file_name && (
          <div className="row">
            <span className="tag ltr">{v.file_name}</span>
            <label className="check"><input type="checkbox" name="remove_file" /> <span>إزالة الملف الحالي</span></label>
          </div>
        )}
        <F name="file" label={v.file_name ? 'استبدال الملف' : 'رفع ملف'} hint="PDF أو Word أو Excel أو PowerPoint أو PNG أو JPEG، حتى ٢٥ م.ب. يُحفظ في مستودع خاص.">
          <input id="file" name="file" type="file" className="input" accept=".pdf,.docx,.xlsx,.pptx,.png,.jpg,.jpeg" />
        </F>
        <label className="check">
          <input type="checkbox" name="distribution_allowed" defaultChecked={v.distribution_allowed ?? false} />
          <span>يُسمح بتوزيع الملف (لدينا إذن صريح أو أن الترخيص يسمح بإعادة النشر). بدون ذلك يظهر رابط المصدر فقط.</span>
        </label>
      </div>
      {isTool && (
        <label className="check">
          <input type="checkbox" name="is_initial_draft" defaultChecked={v.is_initial_draft ?? true} />
          <span>نسخة أولية بانتظار اعتماد الفريق (تظهر بوسم واضح للزوار)</span>
        </label>
      )}
      {!isTool && <input type="hidden" name="is_initial_draft" value="" />}
    </fieldset>
  );
}
