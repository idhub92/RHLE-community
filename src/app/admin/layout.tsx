import Link from 'next/link';
import { Restricted } from '@/components/ui';
import { adminPage } from '@/lib/admin';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const gate = await adminPage();
  if (!gate.ok) return <Restricted reason={gate.reason} />;
  const can = gate.session.can;
  const links: { href: string; label: string; show: boolean; group?: string }[] = [
    { href: '/admin', label: 'لوحة المتابعة', show: true, group: 'عام' },
    { href: '/admin/resources?kind=reference', label: 'المراجع', show: can('content.manage'), group: 'المحتوى' },
    { href: '/admin/resources?kind=tool', label: 'الأدوات', show: can('content.manage') },
    { href: '/admin/events', label: 'الفعاليات والتسجيلات', show: can('events.manage'), group: 'الفعاليات' },
    { href: '/admin/members', label: 'الأعضاء', show: can('members.manage'), group: 'المجتمع' },
    { href: '/admin/team', label: 'الفريق والصلاحيات', show: can('permissions.manage') },
    { href: '/admin/reports', label: 'التقارير', show: can('reports.view') || can('members.manage') || can('events.manage'), group: 'المتابعة' },
    { href: '/admin/archive', label: 'الأرشيف', show: can('content.manage') || can('events.manage') },
    { href: '/admin/settings', label: 'إعدادات المنصة', show: can('platform.admin') },
  ];
  return (
    <div className="container admin-shell" style={{ paddingBlockStart: '.5rem' }}>
      <nav className="admin-nav" aria-label="أقسام الإدارة">
        {links.filter((l) => l.show).map((l) => (
          <span key={l.href} style={{ display: 'contents' }}>
            {l.group && <span className="group">{l.group}</span>}
            <Link href={l.href}>{l.label}</Link>
          </span>
        ))}
      </nav>
      <div className="stack-lg" style={{ minInlineSize: 0 }}>{children}</div>
    </div>
  );
}
