import Link from 'next/link';
import { notFound } from 'next/navigation';
import { EventDetail } from '@/components/EventDetail';
import { Restricted } from '@/components/ui';
import { adminPage, UUID_RE } from '@/lib/admin';
import { EVENT_STATUS_LABEL } from '@/lib/labels';
import type { EventRow } from '@/lib/data';

export default async function PreviewEvent({ params }: { params: Promise<{ id: string }> }) {
  const gate = await adminPage('events.manage');
  if (!gate.ok) return <Restricted reason={gate.reason} />;
  const { id } = await params;
  if (!UUID_RE.test(id)) notFound();
  const { data } = await gate.supabase.from('events').select('*').eq('id', id).maybeSingle();
  if (!data) notFound();
  const e = data as EventRow;
  return (
    <>
      <div className="preview-banner row-between">
        <span>معاينة كما ستظهر للزوار — الحالة الحالية: {EVENT_STATUS_LABEL[e.status]}</span>
        <Link className="btn secondary sm" href={`/admin/events/${id}`}>العودة للتحرير</Link>
      </div>
      <EventDetail event={e} availability={null} panel={<p className="faint">لوحة التسجيل تظهر هنا للزوار.</p>} />
    </>
  );
}
