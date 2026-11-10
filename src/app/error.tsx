'use client';

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="narrow" style={{ paddingBlock: '2rem' }}>
      <div className="card accent stack">
        <h1 style={{ fontSize: '1.4rem' }}>حدث خطأ غير متوقع</h1>
        <p className="muted">تعذّر عرض هذه الصفحة الآن. أعد المحاولة، وإن تكرر الخطأ فتواصل مع فريق المجتمع.</p>
        <div className="row">
          <button className="btn" onClick={() => reset()}>إعادة المحاولة</button>
          <a className="btn secondary" href="/">الرئيسية</a>
        </div>
      </div>
    </div>
  );
}
