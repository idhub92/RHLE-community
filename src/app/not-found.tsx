import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="narrow" style={{ paddingBlock: '2rem' }}>
      <div className="card accent stack">
        <h1 style={{ fontSize: '1.4rem' }}>الصفحة غير متاحة</h1>
        <p className="muted">قد يكون الرابط غير صحيح، أو أن المحتوى أُزيل من العرض العام أو نُقل إلى الأرشيف.</p>
        <div className="row">
          <Link className="btn" href="/">الرئيسية</Link>
          <Link className="btn secondary" href="/library">مكتبة المصمم</Link>
          <Link className="btn secondary" href="/events">الفعاليات</Link>
        </div>
      </div>
    </div>
  );
}
