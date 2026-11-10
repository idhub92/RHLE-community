import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Banner } from '@/components/Banner';
import { ActionForm, SubmitButton } from '@/components/ActionForm';
import { PolicyDialog } from '@/components/client';
import { Alert, SimpleText } from '@/components/ui';
import { ProfileFields, PolicyCheckbox } from '../account/ProfileFields';
import { completeMembership } from '../account/actions';
import { getSession } from '@/lib/session';
import { getCurrentPolicy } from '@/lib/data';
import { createClient } from '@/lib/supabase/server';
import { safeNext } from '@/lib/safe-next';

export const metadata: Metadata = { title: 'إكمال العضوية' };

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const nxt = safeNext(next, '');
  const session = await getSession();
  if (!session) redirect(`/auth/sign-in?next=${encodeURIComponent('/onboarding')}`);
  if (session.status === 'active') redirect(nxt || '/account');

  const [policy, supabase] = await Promise.all([getCurrentPolicy(), createClient()]);
  const { data: profile } = await supabase!.from('profiles').select('full_name,category,institution,bio,interests').eq('id', session.userId).maybeSingle();

  return (
    <div className="narrow" style={{ inlineSize: 'min(680px, 100% - 2rem)' }}>
      <Banner compact />
      {session.status === 'suspended' || session.status === 'closed' ? (
        <Alert tone="warning" title="لا يمكن إكمال العضوية">
          عضويتك {session.status === 'suspended' ? 'موقوفة' : 'مغلقة'}. راجع <Link href="/account">حسابي</Link> أو تواصل مع الفريق.
        </Alert>
      ) : !session.emailConfirmed ? (
        <Alert tone="warning" title="أكّد بريدك أولًا">
          افتح رابط التأكيد المرسل إلى بريدك، أو <Link href={`/auth/verify?email=${encodeURIComponent(session.email ?? '')}`}>اطلب رابطًا جديدًا</Link>.
        </Alert>
      ) : (
        <div className="card accent stack">
          <div className="stack" style={{ gap: '.3rem' }}>
            <h1 style={{ fontSize: '1.45rem' }}>أكمل بيانات عضويتك</h1>
            <p className="muted">الخطوة ٣ من ٣. حسابك جاهز، وتبقّى تعريفنا بك والموافقة على ميثاق المجتمع.</p>
          </div>
          {nxt.startsWith('/events/') && <Alert tone="info">بعد إكمال العضوية ستعود إلى صفحة الفعالية لإتمام التسجيل.</Alert>}
          <ActionForm action={completeMembership}>
            <input type="hidden" name="next" value={nxt} />
            <input type="hidden" name="policy_version" value={policy?.version ?? ''} />
            <ProfileFields v={profile ?? {}} />
            <div className="card soft stack" style={{ gap: '.4rem' }}>
              <div className="row-between">
                <strong>سياسة الخصوصية وميثاق المجتمع {policy ? `(النسخة ${policy.version})` : ''}</strong>
                {policy && (
                  <PolicyDialog label="قراءة السياسة" title={policy.title}>
                    <SimpleText text={policy.body} />
                  </PolicyDialog>
                )}
              </div>
              <p className="faint">لا نعرض بريدك أو بياناتك الخاصة علنًا، ولا نطلب رقم جوالك.</p>
              <PolicyCheckbox />
            </div>
            <SubmitButton pendingLabel="جارٍ تفعيل العضوية…">تفعيل عضويتي</SubmitButton>
          </ActionForm>
        </div>
      )}
    </div>
  );
}
