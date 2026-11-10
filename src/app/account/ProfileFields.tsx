'use client';

import { FieldError, useActionForm } from '@/components/ActionForm';
import { CATEGORY_LABEL } from '@/lib/labels';

export type ProfileValues = {
  full_name?: string | null;
  category?: string | null;
  institution?: string | null;
  bio?: string | null;
  interests?: string[] | null;
};

export function ProfileFields({ v = {} }: { v?: ProfileValues }) {
  const { state } = useActionForm();
  const fe = state.fieldErrors ?? {};
  return (
    <>
      <div className="field">
        <label htmlFor="full_name" className="req">الاسم الكامل</label>
        <input id="full_name" name="full_name" className="input" required minLength={2} maxLength={120}
          autoComplete="name" defaultValue={v.full_name ?? ''} aria-invalid={Boolean(fe.full_name)} />
        <FieldError name="full_name" />
      </div>
      <fieldset className="field">
        <legend className="req">الفئة المهنية</legend>
        <div className="choice-group">
          {Object.entries(CATEGORY_LABEL).map(([k, label]) => (
            <label key={k} className="choice">
              <input type="radio" name="category" value={k} required defaultChecked={v.category === k} />
              <span>{label}</span>
            </label>
          ))}
        </div>
        <span className="hint">الفئة للتعريف فقط ولا تمنح أي صلاحيات.</span>
        <FieldError name="category" />
      </fieldset>
      <div className="field">
        <label htmlFor="institution">جهة الدراسة أو العمل <span className="faint">(اختياري)</span></label>
        <input id="institution" name="institution" className="input" maxLength={160} autoComplete="organization"
          defaultValue={v.institution ?? ''} />
        <FieldError name="institution" />
      </div>
      <div className="field">
        <label htmlFor="bio">نبذة قصيرة <span className="faint">(اختياري)</span></label>
        <textarea id="bio" name="bio" className="input" maxLength={600} defaultValue={v.bio ?? ''} />
        <FieldError name="bio" />
      </div>
      <div className="field">
        <label htmlFor="interests">الاهتمامات <span className="faint">(اختياري)</span></label>
        <input id="interests" name="interests" className="input" maxLength={400}
          placeholder="مثال: التعلم الإلكتروني، التقويم، تصميم السيناريوهات"
          defaultValue={(v.interests ?? []).join('، ')} />
        <span className="hint">افصل بينها بفاصلة. ١٠ اهتمامات كحد أقصى.</span>
      </div>
    </>
  );
}

export function PolicyCheckbox() {
  const { state } = useActionForm();
  return (
    <div className="field">
      <label className="check">
        <input type="checkbox" name="accept_policy" required aria-invalid={Boolean(state.fieldErrors?.accept_policy)} />
        <span>اطّلعت على سياسة الخصوصية وميثاق المجتمع وأوافق عليهما.</span>
      </label>
      <FieldError name="accept_policy" />
    </div>
  );
}
