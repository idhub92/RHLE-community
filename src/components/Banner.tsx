/* The only decorated surface on the site, modelled on the community's survey header. */
export function Banner({ compact = false, title }: { compact?: boolean; title?: string }) {
  return (
    <section className={`banner${compact ? ' compact' : ''}`} aria-label="مجتمعات تصميم">
      <div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="mark" src="/brand/mark-256.png" alt="" width={84} height={84} />
        <p className="name">{title ?? 'مجتمعات تصميم'}</p>
        <p className="tagline">المجتمع المهني للمصممين التعليميين</p>
      </div>
    </section>
  );
}
