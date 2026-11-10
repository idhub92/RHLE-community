import { ActionForm, SubmitButton, type ConfirmSpec } from '@/components/ActionForm';
import { transitionResource, deleteResource } from './actions';

type Op = { op: string; label: string; cls?: string; confirm?: ConfirmSpec };

export function ResourceWorkflow({ id, status, before, isAdmin }: { id: string; status: string; before: string | null; isAdmin: boolean }) {
  const ops: Op[] = [];
  if (status === 'draft') ops.push({ op: 'submit', label: 'إرسال للمراجعة' });
  if (status === 'in_review') {
    ops.push({ op: 'publish', label: 'اعتماد ونشر', confirm: { title: 'اعتماد المحتوى ونشره؟', body: 'سيظهر للزوار فورًا في القوائم والبحث.', confirmLabel: 'اعتماد ونشر' } });
    ops.push({ op: 'reject', label: 'إعادة للتحرير', cls: 'btn secondary', confirm: { title: 'إعادة المحتوى للتحرير', confirmLabel: 'إعادة مع الملاحظة', reasonField: 'reason', reasonLabel: 'سبب الإعادة (يظهر للمحرر)', reasonRequired: true } });
    ops.push({ op: 'withdraw', label: 'سحب من المراجعة', cls: 'btn ghost' });
  }
  if (status === 'published') {
    ops.push({ op: 'unpublish', label: 'إزالة من العرض العام', cls: 'btn secondary', confirm: { title: 'إزالة من العرض العام؟', body: 'يصبح مسودة ويختفي من القوائم والروابط المباشرة، دون أرشفته.', confirmLabel: 'إزالة من العرض' } });
  }
  if (status !== 'archived') {
    ops.push({ op: 'archive', label: 'أرشفة', cls: 'btn danger-outline', confirm: { title: 'نقل إلى الأرشيف', body: 'يختفي من العرض العام والبحث والروابط المباشرة، ويبقى محفوظًا بمصدره وسجله ويمكن استعادته.', confirmLabel: 'أرشفة', tone: 'danger', reasonField: 'reason', reasonLabel: 'سبب الأرشفة', reasonRequired: true } });
  }
  if (status === 'archived') {
    ops.push({ op: 'restore_draft', label: 'استعادة كمسودة', cls: 'btn secondary', confirm: { title: 'استعادة كمسودة؟', body: 'يعود السجل للتحرير ولا يظهر للزوار حتى يُنشر.', confirmLabel: 'استعادة' } });
    if (before === 'published')
      ops.push({ op: 'restore_published', label: 'استعادة ونشر', confirm: { title: 'استعادة ونشر؟', body: 'كان منشورًا قبل الأرشفة وسيظهر للزوار فورًا.', confirmLabel: 'استعادة ونشر' } });
  }
  return (
    <div className="stack" style={{ gap: '.5rem' }}>
      {ops.map((o) => (
        <ActionForm key={o.op} action={transitionResource.bind(null, id)} confirm={o.confirm} className="stack">
          <input type="hidden" name="op" value={o.op} />
          <SubmitButton className={o.cls ?? 'btn'}>{o.label}</SubmitButton>
        </ActionForm>
      ))}
      {isAdmin && (status === 'draft' || status === 'archived') && (
        <ActionForm
          action={deleteResource.bind(null, id)}
          className="stack"
          confirm={{ title: 'حذف نهائي', body: 'يُحذف السجل وملفه نهائيًا ولا يمكن استعادته. للاحتفاظ بالسجل استخدم الأرشفة بدلًا من ذلك.', confirmLabel: 'حذف نهائيًا', tone: 'danger' }}
        >
          <SubmitButton className="btn ghost" pendingLabel="جارٍ الحذف…">حذف نهائي…</SubmitButton>
        </ActionForm>
      )}
    </div>
  );
}
