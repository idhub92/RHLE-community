import type { Metadata } from 'next';
import { DeferredSection } from '@/components/Deferred';
import { EmptyState } from '@/components/ui';

export const metadata: Metadata = { title: 'فرص المصممين' };

export default function OpportunitiesPage() {
  return (
    <DeferredSection
      title="فرص المصممين"
      icon="briefcase"
      lead="مساحة لنشر الوظائف والمشاريع المستقلة وفرص التدريب والتطوع والتعاون المرتبطة بمجال التصميم التعليمي."
      bullets={['الوظائف.', 'المشاريع المستقلة وطلبات الأعمال.', 'فرص التدريب والتطوع.', 'فرص التعاون بين الأعضاء.']}
      availability="لا ننشر إلا الفرص التي يراجعها الفريق ويعتمدها. نشر الفرص غير مفعّل خلال المرحلة التجريبية."
      extra={<EmptyState title="لا توجد فرص معتمدة حاليًا">ستظهر هنا الفرص المعتمدة فور تفعيل هذه المساحة.</EmptyState>}
    />
  );
}
