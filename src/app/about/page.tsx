import type { Metadata } from 'next';
import Link from 'next/link';
import { Banner } from '@/components/Banner';
import { PageHead } from '@/components/ui';
import { SECTIONS } from '@/components/SiteChrome';
import { getPublicTeam, getSetting } from '@/lib/data';

export const metadata: Metadata = { title: 'عن المجتمع' };

export default async function AboutPage() {
  const [team, contact] = await Promise.all([getPublicTeam(), getSetting<string>('contact_email')]);
  return (
    <div className="container stack-lg">
      <Banner compact />
      <PageHead
        title="عن المجتمع"
        lead="مجتمع مهني يجمع المصممين التعليميين والممارسين والطلاب والمهتمين في بيئة رقمية تفاعلية، لتبادل المعرفة والخبرات ومناقشة التحديات المهنية والوصول إلى المصادر والأدوات والفرص."
      />
      <div className="grid-2">
        <section className="card accent stack">
          <h2>أهدافنا</h2>
          <ul className="prose" style={{ paddingInlineStart: '1.2rem', margin: 0 }}>
            <li>بناء مجتمع مهني يعزز التواصل وتبادل الخبرات بين المصممين التعليميين.</li>
            <li>الإسهام في إثراء المحتوى العربي المتخصص في التصميم التعليمي.</li>
            <li>دعم تبادل الممارسات المهنية ومناقشة التحديات الواقعية.</li>
            <li>تسهيل الوصول إلى المراجع والأدوات والنماذج.</li>
            <li>تعزيز التعلم من الأقران والاستفادة من خبرات الممارسين.</li>
            <li>ربط الأعضاء بالفرص المهنية من وظائف ومشاريع وتدريب وتطوع.</li>
          </ul>
        </section>
        <section className="card stack">
          <h2>المرحلة التجريبية</h2>
          <p className="muted">
            نبدأ بمرحلة تجريبية مدتها شهران لاختبار نموذج المجتمع وتطويره. يتضمن نطاقها إطلاق المساحات السبع، واستقطاب الدفعة الأولى
            من الأعضاء، وعقد مجلس مهني واحد على الأقل، ونشر عدد محدود من المراجع والأدوات. أما عيادة المصمم ومدونة المجتمع وفرص
            المصممين ومسارات التطوع فتُفعَّل في مراحل لاحقة.
          </p>
        </section>
      </div>

      <section className="stack">
        <h2>المساحات السبع</h2>
        <div className="table-wrap">
          <table>
            <thead><tr><th>المساحة</th><th>نبذة</th></tr></thead>
            <tbody>
              {SECTIONS.map((s) => (
                <tr key={s.href}>
                  <td><Link href={s.href}>{s.label}</Link></td>
                  <td>{s.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {team.length > 0 && (
        <section className="stack">
          <h2>فريق التأسيس</h2>
          <div className="grid">
            {team.map((m) => (
              <div key={m.full_name + m.public_title} className="card">
                <h3>{m.full_name}</h3>
                <p className="muted">{m.public_title}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section id="contact" className="card soft stack" style={{ gap: '.4rem' }}>
        <h2>التواصل</h2>
        {contact ? (
          <p>
            راسلنا على <a className="ltr" href={`mailto:${contact}`}>{contact}</a>
          </p>
        ) : (
          <p className="muted">ستُنشر وسيلة التواصل الرسمية هنا قريبًا. الأعضاء يمكنهم التواصل عبر مجموعة واتساب من صفحة «حسابي».</p>
        )}
      </section>
    </div>
  );
}
