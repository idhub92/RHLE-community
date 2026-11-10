export default function Loading() {
  return (
    <div className="container stack" aria-busy="true" aria-live="polite" style={{ paddingBlock: '2rem' }}>
      <span className="sr-only">جارٍ التحميل…</span>
      <div className="card stack">
        <div className="skeleton" style={{ inlineSize: '40%', blockSize: '1.6rem' }} />
        <div className="skeleton" style={{ inlineSize: '85%' }} />
        <div className="skeleton" style={{ inlineSize: '70%' }} />
      </div>
    </div>
  );
}
