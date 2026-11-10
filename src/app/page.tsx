import Link from 'next/link';
import { Banner } from '@/components/Banner';
import { Icon } from '@/components/Icon';
import { SECTIONS } from '@/components/SiteChrome';
import { EventCard, ResourceCard } from '@/components/cards';
import { EmptyState } from '@/components/ui';
import { listPublicEvents, listPublishedResources } from '@/lib/data';
import { getSession } from '@/lib/session';

export default async function HomePage() {
  const [session, events, refs, tools] = await Promise.all([
    getSession(),
    listPublicEvents(),
    listPublishedResources('reference'),
    listPublishedResources('tool'),
  ]);
  const next = events.upcoming.find((e) => e.status === 'published');
  const active = session?.status === 'active';

  return (
    <div className="container stack-lg">
      <Banner />

      <section className="card accent hero" aria-labelledby="intro-title">
        <div className="stack">
          <h1 id="intro-title">مساحة مهنية تجمع المصممين التعليميين</h1>
          <p className="muted prose">
            مجتمع عربي للمصممين التعليميين والممارسين والطلاب والمهتمين بالمجال، نتبادل فيه المعرفة والخبرات، ونصل معًا إلى مراجع
            عربية وأدوات عملية وفعاليات مهنية تربط المعرفة بالممارسة.
          </p>
          <div className="row">
            {!session && (
              <>
                <Link className="btn" href="/join">انضم إلى المجتمع</Link>
                <Link className="btn secondary" href="/auth/sign-in">تسجيل الدخول</Link>
              </>
            )}
            {session && session.status === 'incomplete' && (
              <Link className="btn" href="/onboarding">أكمل بيانات عضويتك</Link>
            )}
            {active && <Link className="btn" href="/account">حسابي</Link>}
            <Link className="btn ghost" href="/about">تعرّف على المجتمع</Link>
          </div>
        </div>
        <ul className="stack" style={{ listStyle: 'none', padding: 0, margin: 0, gap: '.6rem' }}>
          {[
            'التواصل المهني والتعلّم من الأقران',
            'مراجع عربية وأدوات عملية معتمدة من الفريق',
            'فعاليات مهنية ومشاركة المعرفة',
            'مساهمات ونقاشات وفرص مهنية في المراحل القادمة',
          ].map((t) => (
            <li key={t} className="row" style={{ flexWrap: 'nowrap', alignItems: 'flex-start', gap: '.5rem' }}>
              <span style={{ color: 'var(--primary)', marginBlockStart: '.2rem' }}><Icon name="check" size={18} /></span>
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="spaces-title">
        <div className="section-head">
          <h2 id="spaces-title">مساحات المجتمع</h2>
          <span className="faint">سبع مساحات، بعضها يُفعَّل في مراحل لاحقة</span>
        </div>
        <div className="grid">
          {SECTIONS.map((s) => (
            <Link key={s.href} href={s.href} className="card card-link space-card">
              <span className="ico"><Icon name={s.icon} /></span>
              <span className="stack" style={{ gap: '.15rem' }}>
                <h3>{s.label}</h3>
                <p>{s.desc}</p>
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="next-event">
        <div className="section-head">
          <h2 id="next-event">الفعالية القادمة</h2>
          <Link href="/events">كل الفعاليات</Link>
        </div>
        {next ? (
          <EventCard e={next} />
        ) : (
          <EmptyState title="لا توجد فعالية قادمة معلنة حاليًا">
            نعلن عن اللقاءات هنا فور اعتمادها. يمكنك الاطلاع على الفعاليات السابقة في صفحة الفعاليات.
          </EmptyState>
        )}
      </section>

      <div className="grid-2">
        <section aria-labelledby="refs-title" className="stack">
          <div className="section-head" style={{ marginBlockEnd: 0 }}>
            <h2 id="refs-title">من مكتبة المصمم</h2>
            <Link href="/library">المكتبة</Link>
          </div>
          {refs.length ? (
            refs.slice(0, 3).map((r) => <ResourceCard key={r.id} r={r} base="/library" />)
          ) : (
            <EmptyState title="لم تُنشر مراجع بعد">تُضاف المراجع بعد مراجعتها واعتمادها من فريق المحتوى.</EmptyState>
          )}
        </section>
        <section aria-labelledby="tools-title" className="stack">
          <div className="section-head" style={{ marginBlockEnd: 0 }}>
            <h2 id="tools-title">من أدوات المصمم</h2>
            <Link href="/tools">الأدوات</Link>
          </div>
          {tools.length ? (
            tools.slice(0, 3).map((r) => <ResourceCard key={r.id} r={r} base="/tools" />)
          ) : (
            <EmptyState title="لم تُنشر أدوات بعد">
              نعمل على ثلاث أدوات أولى: تحليل احتياجات المتعلمين، وتخطيط السيناريوهات، وقائمة تحقق لجودة المحتوى.
            </EmptyState>
          )}
        </section>
      </div>

      <section className="card soft" aria-labelledby="purpose-title">
        <div className="stack" style={{ gap: '.5rem' }}>
          <h2 id="purpose-title">لماذا هذا المجتمع؟</h2>
          <p className="muted prose">
            مع تنامي مجال التصميم التعليمي وتعدد مجالات العمل فيه، نحتاج إلى مساحة مهنية تربط المعرفة الأكاديمية بالممارسة، وتنظّم
            الوصول إلى المعرفة والأدوات باللغة العربية، وتتيح للممارسين مشاركة خبراتهم والإسهام في إثراء المحتوى العربي المتخصص.
          </p>
        </div>
      </section>
    </div>
  );
}
