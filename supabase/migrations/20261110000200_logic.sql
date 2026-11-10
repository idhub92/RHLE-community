-- =====================================================================
-- Workflow guards, audit triggers and RPCs.
-- Errors are raised with stable English keys (MESSAGE) that the app maps
-- to Arabic text; internals are never shown to users.
-- =====================================================================

-- ---------- generic audit trigger ----------
create or replace function public.audit_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  r_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  r_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  r     jsonb := coalesce(r_new, r_old);
  changed text[];
  det jsonb := '{}'::jsonb;
  act text := lower(tg_op);
begin
  if tg_op = 'UPDATE' then
    select array_agg(k order by k) into changed
    from jsonb_object_keys(r_new) k
    where k not in ('updated_at') and r_new -> k is distinct from r_old -> k;
    if changed is null then
      return new; -- nothing meaningful changed
    end if;
    det := jsonb_build_object('changed', to_jsonb(changed));
    if r_new ? 'status' and (r_new ->> 'status') is distinct from (r_old ->> 'status') then
      act := 'status_change';
      det := det || jsonb_build_object('from', r_old ->> 'status', 'to', r_new ->> 'status');
    end if;
  end if;
  -- non-personal descriptive fields only
  if r ? 'title' then det := det || jsonb_build_object('title', r ->> 'title'); end if;
  if r ? 'archive_reason' and (r ->> 'archive_reason') is not null then
    det := det || jsonb_build_object('reason', r ->> 'archive_reason');
  end if;
  if tg_table_name = 'user_roles' then
    det := det || jsonb_build_object('role', (select key from public.roles where id = (r ->> 'role_id')::uuid),
                                     'user', r ->> 'user_id');
  end if;
  if tg_table_name = 'memberships' and r ? 'status_reason' and (r ->> 'status_reason') is not null then
    det := det || jsonb_build_object('reason', r ->> 'status_reason');
  end if;

  insert into public.audit_log (actor, action, entity_type, entity_id, details)
  values (auth.uid(), act, tg_table_name,
          coalesce(r ->> 'id', r ->> 'user_id', r ->> 'key', r ->> 'event_id'), det);
  return coalesce(new, old);
end $$;

-- ---------- resource lifecycle guard ----------
-- Draft -> In review -> Published -> Archived (+ reject, unpublish, restore)
create or replace function public.resources_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'invalid_initial_status' using errcode = 'P0001';
    end if;
    new.created_by := coalesce(uid, new.created_by);
    new.submitted_by := null; new.submitted_at := null;
    new.reviewed_by := null;  new.reviewed_at := null;
    new.published_at := null; new.archived_at := null; new.archived_by := null;
    new.status_before_archive := null;
    return new;
  end if;

  -- immutable / system-stamped columns
  new.id := old.id; new.kind := old.kind;
  new.created_by := old.created_by; new.created_at := old.created_at;
  new.submitted_by := old.submitted_by; new.submitted_at := old.submitted_at;
  new.reviewed_by := old.reviewed_by;  new.reviewed_at := old.reviewed_at;
  new.published_at := old.published_at;
  new.archived_at := old.archived_at; new.archived_by := old.archived_by;
  new.status_before_archive := old.status_before_archive;

  if new.status is not distinct from old.status then
    if old.status = 'archived' then
      raise exception 'archived_readonly' using errcode = 'P0001';
    end if;
    new.archive_reason := old.archive_reason;
    return new;
  end if;

  if old.status = 'draft' and new.status = 'in_review' then
    new.submitted_by := uid; new.submitted_at := now(); new.review_note := null;
  elsif old.status = 'in_review' and new.status = 'draft' then
    -- rejection (with reason) or withdrawal back to editing
    new.reviewed_by := uid; new.reviewed_at := now();
  elsif old.status = 'in_review' and new.status = 'published' then
    new.reviewed_by := uid; new.reviewed_at := now(); new.published_at := now();
    new.review_note := null;
  elsif old.status = 'published' and new.status = 'draft' then
    null; -- unpublish: removed from public view, kept as draft
  elsif old.status <> 'archived' and new.status = 'archived' then
    if coalesce(btrim(new.archive_reason), '') = '' then
      raise exception 'archive_reason_required' using errcode = 'P0001';
    end if;
    new.status_before_archive := old.status;
    new.archived_at := now(); new.archived_by := uid;
  elsif old.status = 'archived' and new.status in ('draft', 'published') then
    if new.status = 'published' and old.status_before_archive is distinct from 'published' then
      raise exception 'restore_publish_not_allowed' using errcode = 'P0001';
    end if;
    if new.status = 'published' then new.published_at := now(); end if;
    new.archived_at := null; new.archived_by := null; new.archive_reason := null;
    new.status_before_archive := null;
  else
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;
  return new;
end $$;

create trigger resources_guard before insert or update on public.resources
  for each row execute function public.resources_guard();

-- ---------- event lifecycle guard ----------
create or replace function public.events_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if tg_op = 'INSERT' then
    if new.status <> 'draft' then
      raise exception 'invalid_initial_status' using errcode = 'P0001';
    end if;
    new.created_by := coalesce(uid, new.created_by);
    new.registration_open := false;
    new.published_at := null; new.completed_at := null; new.archived_at := null;
    new.archived_by := null; new.status_before_archive := null; new.rescheduled_from := null;
    return new;
  end if;

  new.id := old.id; new.created_by := old.created_by; new.created_at := old.created_at;
  new.published_at := old.published_at; new.completed_at := old.completed_at;
  new.archived_at := old.archived_at; new.archived_by := old.archived_by;
  new.status_before_archive := old.status_before_archive;
  new.rescheduled_from := old.rescheduled_from;

  if old.status = 'archived' and new.status = 'archived' then
    raise exception 'archived_readonly' using errcode = 'P0001';
  end if;

  -- rescheduling a published event keeps the original date for notices
  if old.status = 'published' and new.starts_at is distinct from old.starts_at then
    new.rescheduled_from := coalesce(old.rescheduled_from, old.starts_at);
  end if;

  if new.status is distinct from old.status then
    if old.status = 'draft' and new.status = 'published' then
      new.published_at := now();
    elsif old.status = 'published' and new.status = 'draft' then
      if exists (select 1 from public.event_registrations
                 where event_id = old.id and status = 'registered') then
        raise exception 'event_has_registrations' using errcode = 'P0001';
      end if;
    elsif old.status = 'published' and new.status = 'completed' then
      new.completed_at := now();
    elsif old.status = 'published' and new.status = 'cancelled' then
      if coalesce(btrim(new.status_note), '') = '' then
        raise exception 'cancel_reason_required' using errcode = 'P0001';
      end if;
    elsif old.status <> 'archived' and new.status = 'archived' then
      if coalesce(btrim(new.archive_reason), '') = '' then
        raise exception 'archive_reason_required' using errcode = 'P0001';
      end if;
      new.status_before_archive := old.status;
      new.archived_at := now(); new.archived_by := uid;
    elsif old.status = 'archived' and new.status = old.status_before_archive then
      new.archived_at := null; new.archived_by := null; new.archive_reason := null;
      new.status_before_archive := null;
    else
      raise exception 'invalid_transition' using errcode = 'P0001';
    end if;
  end if;

  -- registration can only be open on a published event
  if new.status <> 'published' then
    new.registration_open := false;
  end if;
  return new;
end $$;

create trigger events_guard before insert or update on public.events
  for each row execute function public.events_guard();

-- ---------- membership status guard (defined below with RPCs) ----------

-- ---------- role grant guard ----------
create or replace function public.user_roles_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  rid uuid := coalesce(new.role_id, old.role_id);
  sensitive boolean;
begin
  select exists (
    select 1 from public.role_permissions
    where role_id = rid and permission_key in ('platform.admin', 'permissions.manage')
  ) into sensitive;

  -- auth.uid() is null only for privileged server-side setup (service role / SQL editor)
  if auth.uid() is not null and sensitive and not public.has_permission('platform.admin') then
    raise exception 'requires_platform_admin' using errcode = 'P0001';
  end if;

  if tg_op = 'INSERT' then
    new.granted_by := auth.uid();
    new.granted_at := now();
    return new;
  end if;

  -- never remove the last platform administrator
  if tg_op = 'DELETE' and exists (
       select 1 from public.role_permissions where role_id = old.role_id and permission_key = 'platform.admin')
     and (select count(distinct ur.user_id) from public.user_roles ur
          join public.role_permissions rp on rp.role_id = ur.role_id
          where rp.permission_key = 'platform.admin') <= 1 then
    raise exception 'last_platform_admin' using errcode = 'P0001';
  end if;
  return old;
end $$;

create trigger user_roles_guard before insert or delete on public.user_roles
  for each row execute function public.user_roles_guard();

-- ---------- registration status guard (admin cancellation) ----------
create or replace function public.registrations_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.id := old.id; new.event_id := old.event_id; new.user_id := old.user_id;
  new.registered_at := old.registered_at;
  if old.status = 'cancelled' and new.status = 'registered' then
    raise exception 'invalid_transition' using errcode = 'P0001';
  end if;
  if new.status = 'cancelled' and old.status = 'registered' then
    new.cancelled_at := now(); new.cancelled_by := auth.uid();
  else
    new.cancelled_at := old.cancelled_at; new.cancelled_by := old.cancelled_by;
  end if;
  return new;
end $$;

create trigger registrations_guard before update on public.event_registrations
  for each row execute function public.registrations_guard();

-- ---------- stamp helpers ----------
create or replace function public.stamp_updated_by()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_by := auth.uid();
  new.updated_at := now();
  return new;
end $$;
create trigger settings_stamp before insert or update on public.settings
  for each row execute function public.stamp_updated_by();
create trigger team_titles_stamp before insert or update on public.team_titles
  for each row execute function public.stamp_updated_by();

create or replace function public.stamp_attendance()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.recorded_by := auth.uid();
  new.recorded_at := now();
  return new;
end $$;
create trigger attendance_stamp before insert or update on public.event_attendance
  for each row execute function public.stamp_attendance();

-- ---------- audit wiring ----------
create trigger audit_resources   after insert or update or delete on public.resources        for each row execute function public.audit_trigger();
create trigger audit_events      after insert or update or delete on public.events           for each row execute function public.audit_trigger();
create trigger audit_memberships after update on public.memberships                          for each row execute function public.audit_trigger();
create trigger audit_user_roles  after insert or delete on public.user_roles                 for each row execute function public.audit_trigger();
create trigger audit_role_perms  after insert or delete on public.role_permissions           for each row execute function public.audit_trigger();
create trigger audit_roles       after insert or update or delete on public.roles            for each row execute function public.audit_trigger();
create trigger audit_settings    after insert or update on public.settings                   for each row execute function public.audit_trigger();
create trigger audit_titles      after insert or update or delete on public.team_titles      for each row execute function public.audit_trigger();
create trigger audit_attendance  after insert or update on public.event_attendance           for each row execute function public.audit_trigger();
create trigger audit_policies    after insert or update on public.policies                   for each row execute function public.audit_trigger();
create trigger audit_acct_req    after update on public.account_requests                     for each row execute function public.audit_trigger();

-- =====================================================================
-- RPCs
-- =====================================================================

-- Membership status guard: blocks own-status changes except the sanctioned
-- activation path inside complete_membership (transaction-local flag).
create or replace function public.memberships_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.user_id := old.user_id;
  new.created_at := old.created_at;
  if new.status is distinct from old.status then
    if auth.uid() is not null and auth.uid() = old.user_id
       and not (old.status = 'incomplete' and new.status = 'active'
                and coalesce(current_setting('tasmim.activation', true), '') = 'on') then
      raise exception 'cannot_change_own_status' using errcode = 'P0001';
    end if;
    if new.status = 'active' and not exists (
      select 1 from public.profiles p
      where p.id = old.user_id and p.full_name is not null and p.category is not null) then
      raise exception 'profile_incomplete' using errcode = 'P0001';
    end if;
    new.status_changed_at := now();
    new.status_changed_by := auth.uid();
    new.joined_at := case when new.status = 'active' then coalesce(old.joined_at, now()) else old.joined_at end;
  else
    new.joined_at := old.joined_at;
    new.status_changed_at := old.status_changed_at;
    new.status_changed_by := old.status_changed_by;
  end if;
  return new;
end $$;

create trigger memberships_guard before update on public.memberships
  for each row execute function public.memberships_guard();

-- Complete membership: server validates, records policy acceptance, activates.
create or replace function public.complete_membership(
  p_full_name text,
  p_category public.member_category,
  p_institution text,
  p_bio text,
  p_interests text[],
  p_policy_version text
) returns public.membership_status
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  st public.membership_status;
  pol uuid;
  clean_interests text[];
begin
  if uid is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;

  if not exists (select 1 from auth.users where id = uid and email_confirmed_at is not null) then
    raise exception 'email_unverified' using errcode = 'P0001';
  end if;

  select status into st from public.memberships where user_id = uid for update;
  if st is null then
    insert into public.profiles (id) values (uid) on conflict do nothing;
    insert into public.memberships (user_id) values (uid) returning status into st;
  end if;
  if st in ('suspended', 'closed') then
    raise exception 'membership_blocked' using errcode = 'P0001';
  end if;

  if p_full_name is null or char_length(btrim(p_full_name)) not between 2 and 120 then
    raise exception 'invalid_full_name' using errcode = 'P0001';
  end if;
  if p_category is null then
    raise exception 'invalid_category' using errcode = 'P0001';
  end if;

  select id into pol from public.policies where version = p_policy_version and is_current;
  if pol is null then
    raise exception 'policy_outdated' using errcode = 'P0001';
  end if;

  select coalesce(array_agg(distinct left(btrim(x), 40)) filter (where btrim(x) <> ''), '{}')
    into clean_interests
  from unnest(coalesce(p_interests, '{}')) as x;
  if cardinality(clean_interests) > 10 then
    clean_interests := clean_interests[1:10];
  end if;

  update public.profiles
     set full_name   = btrim(p_full_name),
         category    = p_category,
         institution = nullif(btrim(coalesce(p_institution, '')), ''),
         bio         = nullif(btrim(coalesce(p_bio, '')), ''),
         interests   = clean_interests
   where id = uid;

  insert into public.policy_acceptances (user_id, policy_id) values (uid, pol)
  on conflict do nothing;

  if st = 'incomplete' then
    perform set_config('tasmim.activation', 'on', true);
    update public.memberships set status = 'active' where user_id = uid;
    perform set_config('tasmim.activation', '', true);
  end if;
  return 'active';
end $$;

-- Atomic event registration: the event row is locked, so concurrent
-- requests are serialised and capacity cannot be exceeded.
create or replace function public.register_for_event(p_event uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  st public.membership_status;
  ev public.events%rowtype;
  taken int;
  rid uuid;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;

  select status into st from public.memberships where user_id = uid;
  if st is null or st = 'incomplete' then
    raise exception 'membership_incomplete' using errcode = 'P0001';
  elsif st <> 'active' then
    raise exception 'membership_inactive' using errcode = 'P0001';
  end if;

  select * into ev from public.events where id = p_event for update;
  if not found or ev.status in ('draft', 'archived') then
    raise exception 'event_unavailable' using errcode = 'P0001';
  elsif ev.status = 'cancelled' then
    raise exception 'event_cancelled' using errcode = 'P0001';
  elsif ev.status = 'completed' or ev.starts_at <= now() then
    raise exception 'event_started' using errcode = 'P0001';
  elsif not ev.registration_open then
    raise exception 'registration_closed' using errcode = 'P0001';
  elsif ev.registration_deadline is not null and ev.registration_deadline < now() then
    raise exception 'deadline_passed' using errcode = 'P0001';
  end if;

  if exists (select 1 from public.event_registrations
             where event_id = p_event and user_id = uid and status = 'registered') then
    raise exception 'already_registered' using errcode = 'P0001';
  end if;

  if ev.capacity is not null then
    select count(*) into taken from public.event_registrations
     where event_id = p_event and status = 'registered';
    if taken >= ev.capacity then
      raise exception 'capacity_full' using errcode = 'P0001';
    end if;
  end if;

  insert into public.event_registrations (event_id, user_id)
  values (p_event, uid) returning id into rid;
  return rid;
end $$;

create or replace function public.cancel_event_registration(p_event uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  ev public.events%rowtype;
begin
  if uid is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  select * into ev from public.events where id = p_event for update;
  if not found then raise exception 'event_unavailable' using errcode = 'P0001'; end if;
  if ev.starts_at <= now() or ev.status in ('completed', 'archived') then
    raise exception 'cancellation_closed' using errcode = 'P0001';
  end if;
  update public.event_registrations
     set status = 'cancelled'
   where event_id = p_event and user_id = uid and status = 'registered';
  if not found then
    raise exception 'not_registered' using errcode = 'P0001';
  end if;
end $$;

-- Public availability for an event (count only, no personal data).
create or replace function public.event_availability(p_event uuid)
returns table (registered_count int, capacity int, seats_left int)
language sql stable security definer set search_path = public as $$
  select
    (select count(*)::int from public.event_registrations r where r.event_id = e.id and r.status = 'registered'),
    e.capacity,
    case when e.capacity is null then null
         else greatest(e.capacity - (select count(*)::int from public.event_registrations r
                                     where r.event_id = e.id and r.status = 'registered'), 0) end
  from public.events e
  where e.id = p_event and e.status in ('published', 'completed', 'cancelled');
$$;

-- Registrants for event managers: name + category, no e-mail.
create or replace function public.event_registrants(p_event uuid)
returns table (registration_id uuid, user_id uuid, full_name text, category public.member_category,
               status public.registration_status, registered_at timestamptz, cancelled_at timestamptz,
               attended boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_permission('events.manage') then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  return query
    select r.id, r.user_id, p.full_name, p.category, r.status, r.registered_at, r.cancelled_at, a.attended
    from public.event_registrations r
    join public.profiles p on p.id = r.user_id
    left join public.event_attendance a on a.event_id = r.event_id and a.user_id = r.user_id
    where r.event_id = p_event
    order by r.registered_at;
end $$;

-- Member directory for membership managers (includes e-mail).
create or replace function public.member_directory()
returns table (user_id uuid, email text, full_name text, category public.member_category,
               institution text, status public.membership_status, joined_at timestamptz,
               created_at timestamptz, roles text[], pending_request public.account_request_kind)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_permission('members.manage') then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  return query
    select m.user_id, u.email::text, p.full_name, p.category, p.institution, m.status, m.joined_at,
           m.created_at,
           coalesce((select array_agg(ro.name_ar order by ro.name_ar) from public.user_roles ur
                     join public.roles ro on ro.id = ur.role_id where ur.user_id = m.user_id), '{}'),
           (select ar.kind from public.account_requests ar
             where ar.user_id = m.user_id and ar.status = 'pending' limit 1)
    from public.memberships m
    join public.profiles p on p.id = m.user_id
    join auth.users u on u.id = m.user_id
    order by m.created_at desc;
end $$;

-- Team list for permission managers (needs e-mail to identify accounts).
create or replace function public.team_directory()
returns table (user_id uuid, email text, full_name text, role_keys text[], public_title text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.has_permission('permissions.manage') then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  return query
    select u.id, u.email::text, p.full_name,
           coalesce((select array_agg(ro.key order by ro.key) from public.user_roles ur
                     join public.roles ro on ro.id = ur.role_id where ur.user_id = u.id), '{}'),
           t.public_title
    from auth.users u
    join public.profiles p on p.id = u.id
    left join public.team_titles t on t.user_id = u.id
    where exists (select 1 from public.user_roles ur where ur.user_id = u.id)
       or t.user_id is not null
    order by p.full_name nulls last;
end $$;

-- Find an account by exact e-mail (for granting roles). Returns id only.
create or replace function public.find_user_by_email(p_email text)
returns uuid language plpgsql stable security definer set search_path = public as $$
declare uid uuid;
begin
  if not public.has_permission('permissions.manage') then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  select id into uid from auth.users where lower(email) = lower(btrim(p_email)) and email_confirmed_at is not null;
  return uid;
end $$;

-- Public team / founders list (opt-in by having a public title).
create or replace function public.public_team()
returns table (full_name text, public_title text)
language sql stable security definer set search_path = public as $$
  select p.full_name, t.public_title
  from public.team_titles t
  join public.profiles p on p.id = t.user_id
  join public.memberships m on m.user_id = t.user_id
  where p.full_name is not null and m.status in ('active', 'incomplete')
  order by t.sort_order, p.full_name;
$$;

-- Dashboard metrics: actual results only, shown beside targets in the app.
create or replace function public.admin_metrics()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not (public.has_permission('reports.view') or public.is_team_member()) then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  return jsonb_build_object(
    'active_members',        (select count(*) from public.memberships where status = 'active'),
    'incomplete_members',    (select count(*) from public.memberships where status = 'incomplete'),
    'suspended_members',     (select count(*) from public.memberships where status = 'suspended'),
    'published_references',  (select count(*) from public.resources where kind = 'reference' and status = 'published'),
    'published_tools',       (select count(*) from public.resources where kind = 'tool' and status = 'published'),
    'approved_tools',        (select count(*) from public.resources where kind = 'tool' and status = 'published' and not is_initial_draft),
    'in_review',             (select count(*) from public.resources where status = 'in_review'),
    'archived_resources',    (select count(*) from public.resources where status = 'archived'),
    'archived_events',       (select count(*) from public.events where status = 'archived'),
    'events_published',      (select count(*) from public.events where status = 'published'),
    'events_upcoming',       (select count(*) from public.events where status = 'published' and starts_at > now()),
    'events_completed',      (select count(*) from public.events where status = 'completed'),
    'active_registrations',  (select count(*) from public.event_registrations where status = 'registered'),
    'attended',              (select count(*) from public.event_attendance where attended),
    'pending_account_requests', (select count(*) from public.account_requests where status = 'pending')
  );
end $$;

-- Session context for the app: status, name, effective permissions, policy state.
create or replace function public.my_context()
returns jsonb language sql stable security definer set search_path = public as $$
  select case when auth.uid() is null then null else jsonb_build_object(
    'status',      m.status,
    'full_name',   p.full_name,
    'category',    p.category,
    'permissions', case when m.status in ('suspended', 'closed') then '[]'::jsonb else coalesce((
                     select jsonb_agg(distinct rp.permission_key)
                     from public.user_roles ur
                     join public.role_permissions rp on rp.role_id = ur.role_id
                     where ur.user_id = auth.uid()), '[]'::jsonb) end,
    'is_team',     public.is_team_member(),
    'accepted_current_policy', exists (
                     select 1 from public.policy_acceptances a
                     join public.policies po on po.id = a.policy_id and po.is_current
                     where a.user_id = auth.uid())
  ) end
  from public.memberships m
  join public.profiles p on p.id = m.user_id
  where m.user_id = auth.uid();
$$;

-- Names of team members (for "archived by", "reviewed by" etc.). Team only.
create or replace function public.staff_names(p_ids uuid[])
returns table (user_id uuid, full_name text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_team_member() then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  return query
    select p.id, p.full_name from public.profiles p
    where p.id = any (p_ids)
      and (exists (select 1 from public.user_roles ur where ur.user_id = p.id)
           or exists (select 1 from public.audit_log al where al.actor = p.id));
end $$;

-- Accept the current policy version (after the team publishes a new one).
create or replace function public.accept_current_policy()
returns void language plpgsql security definer set search_path = public as $$
declare pol uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated' using errcode = 'P0001'; end if;
  select id into pol from public.policies where is_current;
  if pol is null then raise exception 'policy_outdated' using errcode = 'P0001'; end if;
  insert into public.policy_acceptances (user_id, policy_id) values (auth.uid(), pol)
  on conflict do nothing;
end $$;

-- Publish a new policy version and make it current (platform admins).
create or replace function public.publish_policy(p_version text, p_title text, p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare pid uuid;
begin
  if not public.has_permission('platform.admin') then
    raise exception 'forbidden' using errcode = 'P0001';
  end if;
  if coalesce(btrim(p_version), '') = '' or coalesce(btrim(p_body), '') = '' then
    raise exception 'invalid_input' using errcode = 'P0001';
  end if;
  update public.policies set is_current = false where is_current;
  insert into public.policies (version, title, body, is_current)
  values (btrim(p_version), coalesce(nullif(btrim(p_title), ''), 'سياسة الخصوصية وميثاق المجتمع'), p_body, true)
  returning id into pid;
  return pid;
end $$;
