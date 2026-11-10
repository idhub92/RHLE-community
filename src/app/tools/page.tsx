import type { Metadata } from 'next';
import { ResourceListPage } from '@/components/ResourceViews';
import { listPublishedResources } from '@/lib/data';

export const metadata: Metadata = { title: 'أدوات المصمم' };

type SP = Promise<{ q?: string; type?: string; category?: string }>;

export default async function ToolsPage({ searchParams }: { searchParams: SP }) {
  const f = await searchParams;
  const [items, all] = await Promise.all([listPublishedResources('tool', f), listPublishedResources('tool')]);
  const categories = Array.from(new Set(all.map((r) => r.category).filter(Boolean) as string[]));
  return <ResourceListPage kind="tool" items={items} filters={f} categories={categories} />;
}
