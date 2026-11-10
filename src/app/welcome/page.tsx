import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Banner } from '@/components/Banner';
import { ConfirmLink } from '@/components/client';
import { Icon } from '@/components/Icon';
import { getSession } from '@/lib/session';
import { getSetting } from '@/lib/data';
import { safeNext } from '@/lib/safe-next';

export const metadata: Metadata = { title: 'مرحبًا بك' };

export default async function WelcomePage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const session = await getSession();
  if (!session) redirect('/auth/sign-in');
  if (session.status === 'incomplete') redirect('/onboarding');
  const nxt = safeNext(next, '');
  const whatsapp = session.status === 'active' ? await getSetting<string>('whatsapp_invite_url') : null;
  return (
    <div className="narrow" style={{ inlineSize: 'min(680px, 100% - 2rem)' }}>
      <Banner compact />
      <div className="card accent stack">
        <h1 style={{ fontSize: '1.5rem' }}>أهلًا بك في مجتمعات تصميم{session.fullName ? `، ${session.fullName}` : ''}</h1>
        <p className="muted">أصبحت عضويتك نشطة. هذه خطواتك التالية:</p>
        <div className="stack">
          {nxt.startsWith('/events/') && (
            <Link className="btn" href={nxt}><Icon name="calendar" size={18} /> العودة إلى الفعالية لإتمام التسجيل</Link>
          )}
          {whatsapp ? (
            <ConfirmLink
              href={whatsapp}
              className="btn secondary"
              title="الانتقال إلى واتساب"
              body="سيُفتح رابط دعوة مجموعة المجتمع في واتساب. الانضمام إلى المجموعة اختياري ومنفصل عن عضويتك في المنصة."
            >
              <Icon name="whatsapp" size={18} /> الانضمام إلى مجموعة واتساب
            </ConfirmLink>
          ) : (
            <p className="faint">سيظهر رابط مجموعة واتساب في «حسابي» عند إتاحته من الفريق.</p>
          )}
          <div className="row">
            <Link className="btn secondary" href="/events">تصفح الفعاليات</Link>
            <Link className="btn secondary" href="/library">مكتبة المصمم</Link>
            <Link className="btn ghost" href="/account">حسابي</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
