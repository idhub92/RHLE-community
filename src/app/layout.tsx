import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SiteFooter, SiteHeader } from '@/components/SiteChrome';
import { getSetting } from '@/lib/data';

// session-aware header on every page
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { default: 'مجتمعات تصميم', template: '%s | مجتمعات تصميم' },
  description: 'مجتمعات تصميم — المجتمع المهني للمصممين التعليميين: فعاليات ومراجع عربية وأدوات عملية.',
  icons: { icon: '/brand/icon-64.png', apple: '/apple-touch-icon.png' },
};

export const viewport: Viewport = { themeColor: '#f0f5e8', width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const contactEmail = await getSetting<string>('contact_email');
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>
        <a className="skip" href="#main">تخطَّ إلى المحتوى</a>
        <SiteHeader />
        <main id="main">{children}</main>
        <SiteFooter contactEmail={contactEmail} />
      </body>
    </html>
  );
}
