import Link from 'next/link';

export default function AuthErrorPage() {
  return (
    <div className="card accent stack">
      <h1 style={{ fontSize: '1.4rem' }}>الرابط غير صالح أو منتهي الصلاحية</h1>
      <p className="muted">روابط التأكيد والاستعادة تُستخدم مرة واحدة ولمدة محدودة. اطلب رابطًا جديدًا.</p>
      <div className="row">
        <Link className="btn" href="/auth/verify">رابط تأكيد جديد</Link>
        <Link className="btn secondary" href="/auth/forgot">استعادة كلمة المرور</Link>
      </div>
    </div>
  );
}
