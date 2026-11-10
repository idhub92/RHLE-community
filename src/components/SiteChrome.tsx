import Link from 'next/link';
import { getSession } from '@/lib/session';
import { isConfigured } from '@/lib/env';
import { NavToggle } from './client';

export const SECTIONS = [
  { href: '/events', label: 'الفعاليات', icon: 'calendar', desc: 'المجلس المهني واللقاءات وورش العمل.' },
  { href: '/clinic', label: 'عيادة المصمم', icon: 'clinic', desc: 'مساحة قادمة لمناقشة تحديات الممارسة الواقعية.' },
  { href: '/library', label: 'مكتبة المصمم', icon: 'book', desc: 'كتب ودراسات وأبحاث وأدلة وإصدارات المجتمع.' },
  { href: '/tools', label: 'أدوات المصمم', icon: 'tool', desc: 'قوالب ونماذج وقوائم تحقق وأطر عمل.' },
  { href: '/blog', label: 'مدونة المجتمع', icon: 'pen', desc: 'مقالات وملخصات وتجارب ودروس مستفادة.' },
  { href: '/opportunities', label: 'فرص المصممين', icon: 'briefcase', desc: 'وظائف ومشاريع وتدريب وتطوع وتعاون.' },
  { href: '/join', label: 'انضم إلينا', icon: 'users', desc: 'العضوية ومسارات المشاركة المستقبلية.' },
] as const;

export async function SiteHeader() {
  const session = await getSession();
  const isMember = session && session.status !== 'incomplete';
  return (
    <>
      {!isConfigured && (
        <div className="config-banner" role="status">
          وضع المعاينة: لم تُربط قاعدة البيانات بعد، لذلك تظهر الصفحات فارغة وتسجيل الدخول معطّل.
        </div>
      )}
      <header className="site-header">
        <div className="container bar">
          <Link href="/" className="brand" aria-label="مجتمعات تصميم — الرئيسية">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/brand/icon-64.png" alt="" width={36} height={36} />
            <span>مجتمعات تصميم</span>
          </Link>
          <NavToggle>
            {SECTIONS.filter((s) => s.href !== '/join' || !isMember).map((s) => (
              <Link key={s.href} href={s.href}>
                {s.label}
              </Link>
            ))}
          </NavToggle>
          <div className="nav-actions">
            {session ? (
              <>
                {session.isTeam && (
                  <Link className="btn ghost sm" href="/admin">
                    إدارة المنصة
                  </Link>
                )}
                <Link className="btn sm" href={session.status === 'incomplete' ? '/onboarding' : '/account'}>
                  {session.status === 'incomplete' ? 'أكمل عضويتك' : 'حسابي'}
                </Link>
              </>
            ) : (
              <>
                <Link className="btn ghost sm" href="/auth/sign-in">
                  تسجيل الدخول
                </Link>
                <Link className="btn sm" href="/join">
                  انضم إلى المجتمع
                </Link>
              </>
            )}
          </div>
        </div>
      </header>
    </>
  );
}

export function SiteFooter({ contactEmail }: { contactEmail?: string | null }) {
  return (
    <footer className="site-footer">
      <div className="container stack" style={{ gap: '.75rem' }}>
        <nav aria-label="روابط التذييل">
          <Link href="/about">عن المجتمع</Link>
          <Link href="/policy">سياسة الخصوصية وميثاق المجتمع</Link>
          <Link href="/join">الانضمام</Link>
          {contactEmail ? (
            <span>
              تواصل معنا: <a className="ltr" href={`mailto:${contactEmail}`}>{contactEmail}</a>
            </span>
          ) : (
            <Link href="/about#contact">تواصل معنا</Link>
          )}
        </nav>
        <p>مجتمعات تصميم — المجتمع المهني للمصممين التعليميين. المرحلة التجريبية ٢٠٢٦.</p>
      </div>
    </footer>
  );
}
