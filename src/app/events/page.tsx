import type { Metadata } from 'next';
import Link from 'next/link';
import { Banner } from '@/components/Banner';
import { EventCard } from '@/components/cards';
import { EmptyState, PageHead } from '@/components/ui';
import { listPublicEvents } from '@/lib/data';

export const metadata: Metadata = { title: 'الفعاليات' };

export default async function EventsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  const showPast = view === 'past';
  const { upcoming, past } = await listPublicEvents();
  const list = showPast ? past : upcoming;
  return (
    <div className="container stack-lg">
      <Banner compact />
      <div>
        <PageHead title="الفعاليات" lead="المجلس المهني واللقاءات وورش العمل التي ينظمها المجتمع." />
        <nav className="tabs" aria-label="تصفية الفعاليات">
          <Link href="/events" aria-current={!showPast ? 'page' : undefined}>القادمة</Link>
          <Link href="/events?view=past" aria-current={showPast ? 'page' : undefined}>السابقة</Link>
        </nav>
        {list.length ? (
          <div className="stack">
            {list.map((e) => <EventCard key={e.id} e={e} />)}
          </div>
        ) : showPast ? (
          <EmptyState title="لا توجد فعاليات سابقة منشورة" />
        ) : (
          <EmptyState title="لا توجد فعاليات قادمة معلنة حاليًا">
            نعلن عن اللقاءات هنا فور اعتمادها من الفريق. يصل الأعضاء أيضًا إلى الإعلانات عبر مجموعة واتساب.
          </EmptyState>
        )}
      </div>
    </div>
  );
}
