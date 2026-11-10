import { Banner } from '@/components/Banner';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="narrow" style={{ inlineSize: 'min(560px, 100% - 2rem)' }}>
      <Banner compact />
      {children}
    </div>
  );
}
