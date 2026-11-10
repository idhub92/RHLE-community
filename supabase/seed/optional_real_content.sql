-- =====================================================================
-- OPTIONAL — real content supplied by the team (not demo data).
-- Run once in the Supabase SQL editor after the migrations, if wanted.
-- The first professional meeting, taken from the registration survey header.
-- It is inserted as a draft and then marked completed so it appears under
-- «الفعاليات السابقة». Review the text before running.
-- =====================================================================
do $$
declare eid uuid;
begin
  insert into public.events (title, summary, description, event_type, starts_at, timezone, duration_minutes,
                             delivery_mode, location, show_when_past)
  values (
    'ماوراء المسمّى: ثلاث تجارب واقعية في التصميم التعليمي',
    'اللقاء المهني الأول لمجتمع المصممين التعليميين، بمشاركة ثلاثة ممارسين.',
    'يسرّ مجتمع المصممين التعليميين دعوتكم لحضور لقائه المهني الأول، الذي نستضيف فيه ثلاثة ممارسين لمشاركة تجاربهم الواقعية، والتعرف على تنوع الأدوار والمسؤوليات والتحديات في مجال التصميم التعليمي.',
    'council',
    '2026-11-07 19:00:00+03', 'Asia/Riyadh', 90,
    'online', 'عن بُعد عبر Teams', true
  ) returning id into eid;
  update public.events set status = 'published' where id = eid;
  update public.events set status = 'completed' where id = eid;
end $$;
