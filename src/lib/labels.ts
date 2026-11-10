export const CATEGORY_LABEL: Record<string, string> = {
  student: 'طالب / طالبة',
  practitioner: 'ممارس / ممارسة',
  interested: 'مهتم / مهتمة',
};

export const MEMBERSHIP_LABEL: Record<string, string> = {
  incomplete: 'غير مكتملة',
  active: 'نشطة',
  suspended: 'موقوفة',
  closed: 'مغلقة',
};

export const CONTENT_STATUS_LABEL: Record<string, string> = {
  draft: 'مسودة',
  in_review: 'قيد المراجعة',
  published: 'منشور',
  archived: 'مؤرشف',
};

export const EVENT_STATUS_LABEL: Record<string, string> = {
  draft: 'مسودة',
  published: 'منشورة',
  completed: 'منتهية',
  cancelled: 'ملغاة',
  archived: 'مؤرشفة',
};

export const EVENT_TYPE_LABEL: Record<string, string> = {
  council: 'مجلس مهني',
  meeting: 'لقاء',
  workshop: 'ورشة عمل',
};

export const DELIVERY_LABEL: Record<string, string> = {
  online: 'عن بُعد',
  in_person: 'حضوري',
  hybrid: 'مدمج',
};

export const RESOURCE_TYPE_LABEL: Record<string, string> = {
  book: 'كتاب',
  study: 'دراسة',
  research: 'بحث',
  report: 'تقرير',
  guide: 'دليل',
  community_publication: 'إصدار المجتمع',
  template: 'قالب',
  checklist: 'قائمة تحقق',
  framework: 'إطار عمل',
  digital_tool: 'أداة رقمية',
};

export const REFERENCE_TYPES = ['book', 'study', 'research', 'report', 'guide', 'community_publication'] as const;
export const TOOL_TYPES = ['template', 'checklist', 'framework', 'digital_tool'] as const;

/** Initial tool categories from the project brief */
export const TOOL_CATEGORIES = ['تحليل احتياجات المتعلمين', 'تخطيط السيناريوهات', 'جودة المحتوى'];

export const LANGUAGE_LABEL: Record<string, string> = { ar: 'العربية', en: 'الإنجليزية', other: 'أخرى' };

export const PERMISSION_LABEL: Record<string, string> = {
  'platform.admin': 'إدارة المنصة',
  'content.manage': 'إدارة المحتوى',
  'events.manage': 'إدارة الفعاليات',
  'members.manage': 'إدارة العضويات',
  'reports.view': 'التقارير والتصدير',
  'permissions.manage': 'إدارة الصلاحيات',
};

export const TONE: Record<string, 'neutral' | 'info' | 'success' | 'warning' | 'danger'> = {
  draft: 'neutral',
  in_review: 'info',
  published: 'success',
  archived: 'warning',
  completed: 'neutral',
  cancelled: 'danger',
  incomplete: 'warning',
  active: 'success',
  suspended: 'danger',
  closed: 'neutral',
  registered: 'success',
};
