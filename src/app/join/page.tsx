import type { Metadata } from 'next';
import Link from 'next/link';
import { Banner } from '@/components/Banner';
import { Alert, Badge, PageHead } from '@/components/ui';
import { getSession } from '@/lib/session';
import { CATEGORY_LABEL } from '@/lib/labels';

export const metadata: Metadata = { title: 'انضم إلينا' };

export default async function JoinPage() {
  const session = await getSession();
  return (
    <div className="container stack-lg">
      <Banner compact />
      <PageHead title="انضم إلينا" lead="اختر مسار مشاركتك في المجتمع. العضوية متاحة الآن، ومسارات التطوع وفريق التشغيل تُفتح لاحقًا." />

      <section className="card accent stack" aria-labelledby="member-path">
        <div className="row-between">
          <h2 id="member-path">العضوية في المجتمع</h2>
          <Badge tone="success">متاحة الآن</Badge>
        </div>
        <p className="muted prose">
          العضوية مفتوحة للطلاب والممارسين والمهتمين بالتصميم التعليمي، وتتيح لك التسجيل في الفعاليات والوصول إلى رابط مجموعة واتساب
          والاطلاع على مستجدات المجتمع.
        </p>
        <ol className="prose" style={{ paddingInlineStart: '1.2rem', margin: 0 }}>
          <li>أنشئ حسابًا بالبريد الإلكتروني وكلمة المرور.</li>
          <li>أكّد بريدك من الرابط المرسل إليك.</li>
          <li>أكمل بياناتك: الاسم والفئة المهنية ({Object.values(CATEGORY_LABEL).join('، ')}).</li>
          <li>اطّلع على سياسة الخصوصية وميثاق المجتمع ووافق عليهما.</li>
        </ol>
        {!session && (
          <div className="row">
            <Link className="btn" href="/auth/sign-up">إنشاء حساب</Link>
            <Link className="btn secondary" href="/auth/sign-in">لديّ حساب: تسجيل الدخول</Link>
          </div>
        )}
        {session?.status === 'incomplete' && (
          <div className="row"><Link className="btn" href="/onboarding">أكمل بيانات عضويتك</Link></div>
        )}
        {session?.status === 'active' && (
          <Alert tone="success" title="أنت عضو نشط في المجتمع">
            يمكنك متابعة فعالياتك وبياناتك من <Link href="/account">حسابي</Link>.
          </Alert>
        )}
        {(session?.status === 'suspended' || session?.status === 'closed') && (
          <Alert tone="warning">عضويتك غير نشطة حاليًا. راجع التفاصيل في <Link href="/account">حسابي</Link>.</Alert>
        )}
      </section>

      <div className="grid-2">
        <section className="card stack" aria-labelledby="vol-path">
          <div className="row-between">
            <h2 id="vol-path">التطوع</h2>
            <Badge tone="warning">لاحقًا</Badge>
          </div>
          <p className="muted">
            سنفتح مسار التطوع في مراحل لاحقة للمساهمة في تنظيم الفعاليات، وإعداد المحتوى ومراجعته، وتيسير نقاشات العيادة.
            سنعلن عن فتح المسار للأعضاء عبر المنصة ومجموعة واتساب.
          </p>
        </section>
        <section className="card stack" aria-labelledby="team-path">
          <div className="row-between">
            <h2 id="team-path">فريق التشغيل</h2>
            <Badge tone="warning">لاحقًا</Badge>
          </div>
          <p className="muted">
            مع توسع المجتمع سنحتاج إلى أعضاء ينضمون إلى فريق التشغيل في المحتوى والفعاليات والتواصل. الانضمام إلى الفريق يتم بقرار من
            الفريق الحالي، ولا يمنح التقديم أي صلاحيات إدارية تلقائيًا؛ تُمنح الصلاحيات لاحقًا لكل شخص بحسب مهمته فقط.
          </p>
        </section>
      </div>
    </div>
  );
}
