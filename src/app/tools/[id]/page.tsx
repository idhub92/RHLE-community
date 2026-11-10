import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ResourceDetail } from '@/components/ResourceViews';
import { getPublishedResource } from '@/lib/data';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const r = await getPublishedResource('tool', id);
  return { title: r?.title ?? 'أدوات المصمم' };
}

/* Archived, draft and in-review records are not readable through RLS, so old direct links return 404. */
export default async function Page({ params }: Props) {
  const { id } = await params;
  const r = await getPublishedResource('tool', id);
  if (!r) notFound();
  return (
    <div className="container">
      <p style={{ marginBlockEnd: '1rem' }}><Link href="/tools">← أدوات المصمم</Link></p>
      <ResourceDetail r={r} />
    </div>
  );
}
