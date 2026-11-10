'use client';

import { FieldError, useActionForm } from '@/components/ActionForm';

export function TextField({
  name,
  label,
  type = 'text',
  autoComplete,
  required = true,
  hint,
  defaultValue,
  dirLtr = false,
  maxLength,
}: {
  name: string;
  label: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  hint?: string;
  defaultValue?: string;
  dirLtr?: boolean;
  maxLength?: number;
}) {
  const { state } = useActionForm();
  const invalid = Boolean(state.fieldErrors?.[name]);
  return (
    <div className="field">
      <label htmlFor={name} className={required ? 'req' : ''}>{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        className={`input${dirLtr ? ' ltr-field' : ''}`}
        autoComplete={autoComplete}
        required={required}
        defaultValue={defaultValue}
        maxLength={maxLength}
        aria-invalid={invalid}
        aria-describedby={invalid ? `${name}-err` : hint ? `${name}-hint` : undefined}
        dir={dirLtr ? 'ltr' : undefined}
      />
      {hint && <span className="hint" id={`${name}-hint`}>{hint}</span>}
      <FieldError name={name} />
    </div>
  );
}
