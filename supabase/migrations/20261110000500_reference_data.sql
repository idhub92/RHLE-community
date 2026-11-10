-- =====================================================================
-- Reference data required by the platform (NOT demo content):
-- permissions, system roles, the first policy version, default settings.
-- =====================================================================

insert into public.permissions (key, label_ar) values
  ('platform.admin',     'إدارة المنصة'),
  ('content.manage',     'إدارة المحتوى'),
  ('events.manage',      'إدارة الفعاليات'),
  ('members.manage',     'إدارة العضويات'),
  ('reports.view',       'التقارير والتصدير'),
  ('permissions.manage', 'إدارة الصلاحيات');

insert into public.roles (key, name_ar, description_ar, is_system) values
  ('platform_admin',     'مدير المنصة',      'وصول كامل إلى جميع أدوات الإدارة والإعدادات.', true),
  ('content_manager',    'مدير المحتوى',     'إنشاء المراجع والأدوات ومراجعتها ونشرها وأرشفتها.', true),
  ('event_manager',      'مدير الفعاليات',   'إدارة الفعاليات والتسجيلات والحضور.', true),
  ('membership_manager', 'مدير العضويات',    'إدارة سجلات العضوية وحالاتها وطلبات الإغلاق.', true),
  ('report_viewer',      'مطّلع على التقارير', 'الاطلاع على المؤشرات المجمّعة المعتمدة فقط.', true),
  ('permission_manager', 'مدير الصلاحيات',   'منح الأدوار غير الحساسة وسحبها وإدارة الألقاب العامة.', true);

insert into public.role_permissions (role_id, permission_key)
select r.id, x.perm
from public.roles r
join (values
  ('platform_admin',     'platform.admin'),
  ('content_manager',    'content.manage'),
  ('event_manager',      'events.manage'),
  ('membership_manager', 'members.manage'),
  ('report_viewer',      'reports.view'),
  ('permission_manager', 'permissions.manage')
) as x(role_key, perm) on x.role_key = r.key;

insert into public.policies (version, title, body, is_current) values (
  '1.0',
  'سياسة الخصوصية وميثاق المجتمع',
$policy$
## أولًا: ما نجمعه من بيانات
- البريد الإلكتروني وكلمة المرور تُدار عبر مزوّد مصادقة موثوق، ولا يطّلع أي عضو في الفريق على كلمة المرور.
- الاسم الكامل والفئة المهنية (طالب/ممارس/مهتم)، وبيانات اختيارية تختارين أو تختار إضافتها: جهة العمل أو الدراسة، ونبذة قصيرة، والاهتمامات.
- سجل تسجيلك في الفعاليات وحضورك الفعلي لها.
- تاريخ قبولك لهذه السياسة ورقم نسختها.

## ثانيًا: كيف نستخدمها
- لإدارة عضويتك وتسجيلك في الفعاليات وتمكينك من الوصول إلى محتوى المجتمع.
- لإعداد مؤشرات مجمّعة عن المرحلة التجريبية لا تكشف هوية أي عضو.
- لا نبيع بياناتك ولا نشاركها مع أي جهة خارجية لأغراض تسويقية.

## ثالثًا: من يطّلع عليها
- لا يُعرض بريدك الإلكتروني ولا بياناتك الخاصة علنًا.
- يطّلع فريق التشغيل على الحد الأدنى اللازم لمهمته فقط: فريق الفعاليات يرى أسماء المسجّلين وفئاتهم، وفريق العضويات يرى سجلات العضوية.
- أي دليل عام للأعضاء مستقبلًا سيكون بموافقة صريحة منك فقط.

## رابعًا: مجموعة واتساب
- العضوية في المنصة منفصلة عن مجموعة واتساب. الانضمام إلى المجموعة اختياري ويخضع لسياسات واتساب.

## خامسًا: حقوقك
- تعديل بياناتك من صفحة «حسابي» في أي وقت.
- طلب إغلاق العضوية أو حذف الحساب وبياناته من صفحة «حسابي»، ويُعالج الطلب يدويًا خلال مدة معقولة.

## سادسًا: ميثاق المجتمع
- الاحترام المهني في جميع النقاشات والفعاليات.
- نسب المعرفة إلى أصحابها، واحترام حقوق النشر عند مشاركة أي مرجع.
- عدم مشاركة معلومات سرية لجهات العمل أو بيانات المتعلمين.
- عدم استخدام قنوات المجتمع للترويج غير المرغوب فيه.
- يحق لفريق التشغيل تعليق العضوية عند مخالفة الميثاق، مع توضيح السبب.
$policy$,
  true
);

insert into public.settings (key, value, visibility) values
  ('whatsapp_invite_url', 'null'::jsonb, 'members'),
  ('contact_email',       'null'::jsonb, 'public'),
  ('pilot_targets',       '{"members":30,"references":3,"tools":3,"events":1}'::jsonb, 'admin'),
  ('pilot_period',        '{"start":"2026-09-17","end":"2026-11-15"}'::jsonb, 'admin');
