import Link from 'next/link';
import type { ResourceRow } from '@/lib/data';
import { Icon } from './Icon';
import { Badge, DraftFlag, EmptyState, PageHead } from './ui';
import { ResourceCard } from './cards';
import { Banner } from './Banner';
import { LANGUAGE_LABEL, REFERENCE_TYPES, RESOURCE_TYPE_LABEL, TOOL_CATEGORIES, TOOL_TYPES } from '@/lib/labels';
import { fmtBytes, fmtShort } from '@/lib/format';

const FILE_LABEL: Record<string, string> = {
  'application/pdf': 'PDF',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Word',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Excel',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'PowerPoint',
  'image/png': 'PNG',
  'image/jpeg': 'JPEG',
};

export function ResourceListPage({
  kind,
  items,
  filters,
  categories,
}: {
  kind: 'reference' | 'tool';
  items: ResourceRow[];
  filters: { q?: string; type?: string; category?: string; lang?: string };
  categories: string[];
}) {
  const isRef = kind === 'reference';
  const base = isRef ? '/library' : '/tools';
  const types = isRef ? REFERENCE_TYPES : TOOL_TYPES;
  const filtered = Boolean(filters.q || filters.type || filters.category || filters.lang);
  const cats = Array.from(new Set([...(isRef ? [] : TOOL_CATEGORIES), ...categories]));
  return (
    <div className="container stack-lg">
      <Banner compact />
      <div className="stack">
        <PageHead
          title={isRef ? 'مكتبة المصمم' : 'أدوات المصمم'}
          lead={
            isRef
              ? 'كتب ودراسات وأبحاث وتقارير وأدلة في التصميم التعليمي، وإصدارات المجتمع المعتمدة. نشير دائمًا إلى المصدر الأصلي، ولا نتيح التنزيل إلا عند السماح بالتوزيع.'
              : 'قوالب ونماذج وقوائم تحقق وأطر عمل وأدوات رقمية تدعم عمل المصمم التعليمي. الأدوات الموسومة «نسخة أولية» ما زالت بانتظار اعتماد الفريق.'
          }
        />
        <form className="card toolbar" role="search" action={base} method="get">
          <div className="field">
            <label htmlFor="q">بحث</label>
            <input id="q" name="q" className="input" defaultValue={filters.q} placeholder={isRef ? 'العنوان أو المؤلف أو الموضوع' : 'اسم الأداة أو وصفها'} />
          </div>
          <div className="field">
            <label htmlFor="type">النوع</label>
            <select id="type" name="type" className="input" defaultValue={filters.type ?? ''}>
              <option value="">الكل</option>
              {types.map((t) => <option key={t} value={t}>{RESOURCE_TYPE_LABEL[t]}</option>)}
            </select>
          </div>
          {cats.length > 0 && (
            <div className="field">
              <label htmlFor="category">التصنيف</label>
              <select id="category" name="category" className="input" defaultValue={filters.category ?? ''}>
                <option value="">الكل</option>
                {cats.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}
          {isRef && (
            <div className="field">
              <label htmlFor="lang">اللغة</label>
              <select id="lang" name="lang" className="input" defaultValue={filters.lang ?? ''}>
                <option value="">الكل</option>
                {Object.entries(LANGUAGE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          )}
          <div className="row">
            <button className="btn" type="submit"><Icon name="search" size={18} /> بحث</button>
            {filtered && <Link className="btn ghost" href={base}>مسح التصفية</Link>}
          </div>
        </form>
        <p className="faint" aria-live="polite">{items.length ? `${items.length} نتيجة` : ''}</p>
        {items.length ? (
          <div className="grid">{items.map((r) => <ResourceCard key={r.id} r={r} base={base as '/library' | '/tools'} />)}</div>
        ) : filtered ? (
          <EmptyState title="لا توجد نتائج مطابقة" action={<Link className="btn secondary" href={base}>عرض الكل</Link>}>
            جرّب كلمات بحث أخرى أو أزل بعض عوامل التصفية.
          </EmptyState>
        ) : (
          <EmptyState title={isRef ? 'لم تُنشر مراجع بعد' : 'لم تُنشر أدوات بعد'}>
            {isRef
              ? 'يُضاف كل مرجع بعد مراجعته والتحقق من مصدره وحقوق نشره.'
              : 'الأدوات الأولى قيد الإعداد: قالب تحليل احتياجات المتعلمين، ونموذج تخطيط السيناريوهات، وقائمة تحقق لجودة المحتوى.'}
          </EmptyState>
        )}
      </div>
    </div>
  );
}

export function ResourceDetail({ r, preview = false }: { r: ResourceRow; preview?: boolean }) {
  const isTool = r.kind === 'tool';
  const canDownload = Boolean(r.file_name && r.distribution_allowed);
  return (
    <div className="grid-2" style={{ alignItems: 'start' }}>
      <article className="card accent stack">
        <div className="row" style={{ gap: '.4rem' }}>
          <Badge tone="info">{RESOURCE_TYPE_LABEL[r.resource_type]}</Badge>
          {r.category && <span className="tag">{r.category}</span>}
          {isTool && r.is_initial_draft && <DraftFlag />}
        </div>
        <h1>{r.title}</h1>
        {r.description && <div className="prose">{r.description.split('\n').filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}</div>}
        {isTool && r.purpose && (
          <section className="stack" style={{ gap: '.35rem' }}>
            <h2 style={{ fontSize: '1.1rem' }}>الغرض والاستخدام</h2>
            <div className="prose">{r.purpose.split('\n').filter(Boolean).map((p, i) => <p key={i}>{p}</p>)}</div>
          </section>
        )}
        {isTool && r.instructions && (
          <section className="stack" style={{ gap: '.35rem' }}>
            <h2 style={{ fontSize: '1.1rem' }}>طريقة الاستخدام</h2>
            <ol className="prose" style={{ paddingInlineStart: '1.2rem', margin: 0 }}>
              {r.instructions.split('\n').map((s) => s.replace(/^\s*(\d+[.)-]|-)\s*/, '').trim()).filter(Boolean).map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          </section>
        )}
        {r.tags.length > 0 && <div className="row" style={{ gap: '.35rem' }}>{r.tags.map((t) => <span key={t} className="tag">{t}</span>)}</div>}
      </article>
      <aside className="stack">
        <div className="card stack">
          <dl className="kv">
            {r.author_source && (<><dt>{isTool ? 'الإعداد' : 'المؤلف / المصدر'}</dt><dd>{r.author_source}</dd></>)}
            {r.publication_year && (<><dt>سنة النشر</dt><dd>{r.publication_year}</dd></>)}
            <dt>اللغة</dt><dd>{LANGUAGE_LABEL[r.language]}</dd>
            <dt>الإصدار</dt><dd className="ltr">{r.version}</dd>
            {r.file_name && (<><dt>الملف</dt><dd>{FILE_LABEL[r.file_mime ?? ''] ?? 'ملف'}{r.file_size ? ` — ${fmtBytes(r.file_size)}` : ''}</dd></>)}
            {r.published_at && (<><dt>تاريخ النشر في المنصة</dt><dd>{fmtShort(r.published_at)}</dd></>)}
          </dl>
          <div className="row">
            {canDownload && !preview && (
              <a className="btn" href={`/download/${r.id}`} rel="nofollow"><Icon name="download" size={18} /> تنزيل الملف</a>
            )}
            {canDownload && preview && <span className="btn" aria-disabled="true">تنزيل الملف (معطّل في المعاينة)</span>}
            {r.external_tool_url && (
              <a className="btn secondary" href={r.external_tool_url} target="_blank" rel="noopener noreferrer">
                <Icon name="external" size={18} /> فتح الأداة
              </a>
            )}
            {r.source_url && (
              <a className="btn secondary" href={r.source_url} target="_blank" rel="noopener noreferrer">
                <Icon name="external" size={18} /> المصدر الأصلي
              </a>
            )}
          </div>
          {r.file_name && !r.distribution_allowed && (
            <p className="faint">لا يتيح المصدر إعادة توزيع الملف، لذلك نكتفي بالإشارة إلى المصدر الأصلي.</p>
          )}
        </div>
        {r.usage_notes && (
          <div className="card soft stack" style={{ gap: '.3rem' }}>
            <h2 style={{ fontSize: '1rem' }}>شروط الاستخدام والإسناد</h2>
            <p className="muted">{r.usage_notes}</p>
          </div>
        )}
      </aside>
    </div>
  );
}
