import type { Metadata } from 'next';
import { ResourceListPage } from '@/components/ResourceViews';
import { listPublishedResources } from '@/lib/data';

export const metadata: Metadata = { title: 'مكتبة المصمم' };

type SP = Promise<{ q?: string; type?: string; category?: string; lang?: string }>;

export default async function LibraryPage({ searchParams }: { searchParams: SP }) {
  const f = await searchParams;
  const [items, all] = await Promise.all([listPublishedResources('reference', f), listPublishedResources('reference')]);
  const categories = Array.from(new Set(all.map((r) => r.category).filter(Boolean) as string[]));
  return <ResourceListPage kind="reference" items={items} filters={f} categories={categories} />;
}
