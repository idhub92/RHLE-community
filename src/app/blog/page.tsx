import type { Metadata } from 'next';
import { DeferredSection } from '@/components/Deferred';

export const metadata: Metadata = { title: 'مدونة المجتمع' };

export default function BlogPage() {
  return (
    <DeferredSection
      title="مدونة المجتمع"
      icon="pen"
      lead="مساحة معرفية يسهم فيها الأعضاء بالمقالات وملخصات الكتب والأبحاث والتجارب المهنية والدروس المستفادة في التصميم التعليمي."
      bullets={['مقالات متخصصة يكتبها الأعضاء.', 'ملخصات للكتب والأبحاث.', 'تجارب مهنية ودروس مستفادة من مشاريع حقيقية.']}
      availability="استقبال المساهمات العامة مغلق خلال المرحلة التجريبية. ستُفتح المدونة مع آلية مراجعة تحريرية في مرحلة لاحقة."
    />
  );
}
