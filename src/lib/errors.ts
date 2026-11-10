/** Map database / auth error keys to friendly Arabic text. Internals are never shown. */
const MESSAGES: Record<string, string> = {
  not_authenticated: 'انتهت جلستك. سجّل الدخول مرة أخرى للمتابعة.',
  email_unverified: 'لم يُؤكَّد بريدك الإلكتروني بعد. افتح رابط التأكيد المرسل إليك أولًا.',
  membership_blocked: 'عضويتك موقوفة أو مغلقة، لذلك لا يمكن تنفيذ هذا الإجراء.',
  membership_incomplete: 'أكمل بيانات عضويتك أولًا ثم أعد المحاولة.',
  membership_inactive: 'عضويتك غير نشطة حاليًا، لذلك لا يمكنك التسجيل في الفعاليات.',
  invalid_full_name: 'اكتب الاسم الكامل (من حرفين إلى ١٢٠ حرفًا).',
  invalid_category: 'اختر الفئة المهنية.',
  policy_outdated: 'تحدّثت السياسة أثناء التسجيل. أعد تحميل الصفحة واطّلع على النسخة الحالية.',
  event_unavailable: 'هذه الفعالية غير متاحة.',
  event_cancelled: 'أُلغيت هذه الفعالية.',
  event_started: 'بدأت الفعالية أو انتهت، ولم يعد التسجيل متاحًا.',
  registration_closed: 'التسجيل في هذه الفعالية مغلق حاليًا.',
  deadline_passed: 'انتهى موعد التسجيل في هذه الفعالية.',
  already_registered: 'أنت مسجّل في هذه الفعالية مسبقًا.',
  capacity_full: 'اكتمل العدد المتاح لهذه الفعالية.',
  cancellation_closed: 'لم يعد إلغاء التسجيل متاحًا لهذه الفعالية.',
  not_registered: 'لا يوجد تسجيل نشط لك في هذه الفعالية.',
  forbidden: 'ليست لديك صلاحية لتنفيذ هذا الإجراء.',
  requires_platform_admin: 'منح هذا الدور يتطلب صلاحية إدارة المنصة.',
  last_platform_admin: 'لا يمكن سحب الدور من آخر مدير للمنصة.',
  archive_reason_required: 'اكتب سبب الأرشفة.',
  cancel_reason_required: 'اكتب سبب إلغاء الفعالية.',
  archived_readonly: 'السجل مؤرشف ولا يمكن تعديله. استعده أولًا.',
  restore_publish_not_allowed: 'لا يمكن استعادة هذا السجل منشورًا لأنه لم يكن منشورًا قبل الأرشفة.',
  invalid_transition: 'لا يمكن نقل السجل إلى هذه الحالة من حالته الحالية.',
  invalid_initial_status: 'يبدأ كل سجل جديد مسودة.',
  event_has_registrations: 'لا يمكن إعادة الفعالية إلى مسودة وفيها تسجيلات نشطة. يمكنك إلغاؤها مع ذكر السبب.',
  cannot_change_own_status: 'لا يمكنك تغيير حالة عضويتك بنفسك.',
  profile_incomplete: 'لا يمكن تفعيل العضوية قبل اكتمال بيانات الملف.',
  invalid_input: 'تحقّق من الحقول المطلوبة.',
  permission_denied: 'ليست لديك صلاحية لتنفيذ هذا الإجراء.',
  duplicate: 'هذا السجل موجود مسبقًا.',
  quota: 'تجاوزت الحد المسموح. حاول لاحقًا.',
  network: 'تعذّر الاتصال بالخادم. تحقّق من الاتصال وأعد المحاولة؛ بياناتك ما زالت في النموذج.',
  not_configured: 'المنصة غير مهيّأة بعد: لم تُضبط إعدادات قاعدة البيانات.',
};

export function friendlyError(err: unknown): string {
  const raw =
    typeof err === 'string'
      ? err
      : err && typeof err === 'object' && 'message' in err
        ? String((err as { message: unknown }).message)
        : '';
  const code = err && typeof err === 'object' && 'code' in err ? String((err as { code: unknown }).code) : '';
  for (const key of Object.keys(MESSAGES)) {
    if (raw === key || raw.startsWith(key + ' ') || raw.includes(key)) return MESSAGES[key];
  }
  if (code === '42501' || /permission denied|row-level security/i.test(raw)) return MESSAGES.permission_denied;
  if (code === '23505') return MESSAGES.duplicate;
  if (/fetch failed|network/i.test(raw)) return MESSAGES.network;
  if (raw) console.error('[action error]', code, raw);
  return 'تعذّر إتمام الطلب. أعد المحاولة، وإن تكرر الخطأ فتواصل مع فريق المجتمع.';
}

export function isAuthError(err: unknown): boolean {
  const raw = err && typeof err === 'object' && 'message' in err ? String((err as { message: unknown }).message) : '';
  return raw.includes('not_authenticated') || /JWT expired|invalid JWT/i.test(raw);
}
