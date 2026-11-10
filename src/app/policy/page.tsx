import type { Metadata } from 'next';
import { PageHead, SimpleText, EmptyState } from '@/components/ui';
import { getCurrentPolicy } from '@/lib/data';
import { fmtDate } from '@/lib/format';

export const metadata: Metadata = { title: 'سياسة الخصوصية وميثاق المجتمع' };

export default async function PolicyPage() {
  const policy = await getCurrentPolicy();
  return (
    <div className="narrow">
      <PageHead
        title={policy?.title ?? 'سياسة الخصوصية وميثاق المجتمع'}
        lead={policy ? `النسخة ${policy.version} — نُشرت ${fmtDate(policy.published_at)}` : undefined}
      />
      <article className="card accent">
        {policy ? <SimpleText text={policy.body} /> : <EmptyState title="السياسة غير متاحة حاليًا" />}
      </article>
    </div>
  );
}
