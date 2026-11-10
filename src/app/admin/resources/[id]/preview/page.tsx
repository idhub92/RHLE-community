import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ResourceDetail } from '@/components/ResourceViews';
import { Restricted } from '@/components/ui';
import { adminPage, UUID_RE } from '@/lib/admin';
import { CONTENT_STATUS_LABEL } from '@/lib/labels';
import type { ResourceRow } from '@/lib/data';

export default async function PreviewResource({ params }: { params: Promise<{ id: string }> }) {
  const gate = await adminPage('content.manage');
  if (!gate.ok) return <Restricted reason={gate.reason} />;
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const { data } = await gate.supabase.from('resources').select('*').eq('id', id).maybeSingle();
  if (!data) notFound();
  const r = data as ResourceRow;
  return (
    <>
      <div className="preview-banner row-between">
        <span>معاينة كما ستظهر للزوار — الحالة الحالية: {CONTENT_STATUS_LABEL[r.status]}</span>
        <Link className="btn secondary sm" href={`/admin/resources/${id}`}>العودة للتحرير</Link>
      </div>
      <ResourceDetail r={r} preview />
    </>
  );
}
