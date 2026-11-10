-- =====================================================================
-- مجتمعات تصميم — المخطط الأساسي
-- Core schema: profiles, memberships, roles & permissions, events,
-- registrations, attendance, resources, policies, settings, audit.
-- Authorization is enforced by RLS (next migration) and SECURITY DEFINER
-- functions; the web app never relies on hidden buttons.
-- =====================================================================

-- ---------- enums ----------
create type public.member_category    as enum ('student', 'practitioner', 'interested');
create type public.membership_status  as enum ('incomplete', 'active', 'suspended', 'closed');
create type public.content_status     as enum ('draft', 'in_review', 'published', 'archived');
create type public.resource_kind      as enum ('reference', 'tool');
create type public.event_status       as enum ('draft', 'published', 'completed', 'cancelled', 'archived');
create type public.delivery_mode      as enum ('online', 'in_person', 'hybrid');
create type public.registration_status as enum ('registered', 'cancelled');
create type public.account_request_kind as enum ('closure', 'deletion');
create type public.request_status     as enum ('pending', 'completed', 'rejected');
create type public.setting_visibility as enum ('public', 'members', 'admin');

-- ---------- helper: updated_at ----------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------- profiles ----------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  full_name    text check (full_name is null or char_length(btrim(full_name)) between 2 and 120),
  category     public.member_category,
  institution  text check (institution is null or char_length(institution) <= 160),
  bio          text check (bio is null or char_length(bio) <= 600),
  interests    text[] not null default '{}' check (cardinality(interests) <= 10),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ---------- memberships ----------
create table public.memberships (
  user_id            uuid primary key references auth.users (id) on delete cascade,
  status             public.membership_status not null default 'incomplete',
  joined_at          timestamptz,
  status_changed_at  timestamptz not null default now(),
  status_changed_by  uuid references auth.users (id) on delete set null,
  status_reason      text check (status_reason is null or char_length(status_reason) <= 500),
  created_at         timestamptz not null default now()
);

-- every new auth identity gets an (incomplete) profile + membership
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  insert into public.memberships (user_id) values (new.id) on conflict do nothing;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- permissions & roles ----------
create table public.permissions (
  key       text primary key,
  label_ar  text not null
);

create table public.roles (
  id              uuid primary key default gen_random_uuid(),
  key             text not null unique check (key ~ '^[a-z_]{3,40}$'),
  name_ar         text not null,
  description_ar  text,
  is_system       boolean not null default false,
  created_at      timestamptz not null default now()
);

create table public.role_permissions (
  role_id         uuid not null references public.roles (id) on delete cascade,
  permission_key  text not null references public.permissions (key) on delete cascade,
  primary key (role_id, permission_key)
);

create table public.user_roles (
  user_id     uuid not null references auth.users (id) on delete cascade,
  role_id     uuid not null references public.roles (id) on delete cascade,
  granted_by  uuid references auth.users (id) on delete set null,
  granted_at  timestamptz not null default now(),
  primary key (user_id, role_id)
);

-- public founder / team title, separate from permissions and category
create table public.team_titles (
  user_id       uuid primary key references auth.users (id) on delete cascade,
  public_title  text not null check (char_length(public_title) between 2 and 80),
  sort_order    int not null default 100,
  updated_by    uuid references auth.users (id) on delete set null,
  updated_at    timestamptz not null default now()
);

-- ---------- permission check (live, so revocations apply to open sessions) ----------
create or replace function public.has_permission(p_key text)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
     and exists (
       select 1
       from public.user_roles ur
       join public.role_permissions rp on rp.role_id = ur.role_id
       where ur.user_id = auth.uid()
         and (rp.permission_key = p_key or rp.permission_key = 'platform.admin')
     )
     and not exists (
       select 1 from public.memberships m
       where m.user_id = auth.uid() and m.status in ('suspended', 'closed')
     );
$$;

create or replace function public.is_team_member()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null
     and exists (select 1 from public.user_roles where user_id = auth.uid())
     and not exists (
       select 1 from public.memberships m
       where m.user_id = auth.uid() and m.status in ('suspended', 'closed')
     );
$$;

create or replace function public.my_membership_status()
returns public.membership_status language sql stable security definer set search_path = public as $$
  select status from public.memberships where user_id = auth.uid();
$$;

-- ---------- events ----------
create table public.events (
  id                     uuid primary key default gen_random_uuid(),
  title                  text not null check (char_length(btrim(title)) between 3 and 200),
  summary                text check (summary is null or char_length(summary) <= 400),
  description            text check (description is null or char_length(description) <= 8000),
  event_type             text not null default 'council'
                           check (event_type in ('council', 'meeting', 'workshop')),
  starts_at              timestamptz not null,
  timezone               text not null default 'Asia/Riyadh',
  duration_minutes       int not null default 90 check (duration_minutes between 10 and 1440),
  delivery_mode          public.delivery_mode not null default 'online',
  location               text check (location is null or char_length(location) <= 300),
  capacity               int check (capacity is null or capacity > 0),
  registration_deadline  timestamptz,
  registration_open      boolean not null default false,
  status                 public.event_status not null default 'draft',
  status_note            text check (status_note is null or char_length(status_note) <= 1000),
  rescheduled_from       timestamptz,
  show_when_past         boolean not null default true,
  published_at           timestamptz,
  completed_at           timestamptz,
  archived_at            timestamptz,
  archived_by            uuid references auth.users (id) on delete set null,
  archive_reason         text,
  status_before_archive  public.event_status,
  created_by             uuid references auth.users (id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  check (registration_deadline is null or registration_deadline <= starts_at + interval '1 day')
);
create index events_status_starts_idx on public.events (status, starts_at);
create trigger events_touch before update on public.events
  for each row execute function public.touch_updated_at();

-- meeting links are only revealed to registered members and event managers
create table public.event_private (
  event_id     uuid primary key references public.events (id) on delete cascade,
  meeting_url  text check (meeting_url is null or meeting_url ~* '^https://'),
  updated_at   timestamptz not null default now()
);

create table public.event_registrations (
  id             uuid primary key default gen_random_uuid(),
  event_id       uuid not null references public.events (id) on delete restrict,
  user_id        uuid not null references auth.users (id) on delete cascade,
  status         public.registration_status not null default 'registered',
  registered_at  timestamptz not null default now(),
  cancelled_at   timestamptz,
  cancelled_by   uuid references auth.users (id) on delete set null
);
-- no duplicate *active* registrations
create unique index event_registrations_one_active
  on public.event_registrations (event_id, user_id) where status = 'registered';
create index event_registrations_user_idx on public.event_registrations (user_id);

-- attendance is recorded separately from registration
create table public.event_attendance (
  event_id     uuid not null references public.events (id) on delete restrict,
  user_id      uuid not null references auth.users (id) on delete cascade,
  attended     boolean not null,
  recorded_by  uuid references auth.users (id) on delete set null,
  recorded_at  timestamptz not null default now(),
  primary key (event_id, user_id)
);

-- ---------- resources (references + tools) ----------
create table public.resources (
  id                     uuid primary key default gen_random_uuid(),
  kind                   public.resource_kind not null,
  resource_type          text not null check (resource_type in (
                           'book', 'study', 'research', 'report', 'guide', 'community_publication',
                           'template', 'checklist', 'framework', 'digital_tool')),
  title                  text not null check (char_length(btrim(title)) between 3 and 200),
  description            text check (description is null or char_length(description) <= 4000),
  category               text check (category is null or char_length(category) <= 80),
  tags                   text[] not null default '{}' check (cardinality(tags) <= 12),
  language               text not null default 'ar' check (language in ('ar', 'en', 'other')),
  author_source          text check (author_source is null or char_length(author_source) <= 300),
  publication_year       int check (publication_year is null or publication_year between 1900 and 2100),
  source_url             text check (source_url is null or source_url ~* '^https?://'),
  external_tool_url      text check (external_tool_url is null or external_tool_url ~* '^https://'),
  purpose                text check (purpose is null or char_length(purpose) <= 2000),
  instructions           text check (instructions is null or char_length(instructions) <= 6000),
  usage_notes            text check (usage_notes is null or char_length(usage_notes) <= 1000),
  version                text not null default '0.1' check (char_length(version) <= 20),
  is_initial_draft       boolean not null default true,
  distribution_allowed   boolean not null default false,
  file_path              text,
  file_name              text,
  file_mime              text,
  file_size              bigint check (file_size is null or file_size >= 0),
  status                 public.content_status not null default 'draft',
  review_note            text check (review_note is null or char_length(review_note) <= 1000),
  created_by             uuid references auth.users (id) on delete set null,
  submitted_by           uuid references auth.users (id) on delete set null,
  submitted_at           timestamptz,
  reviewed_by            uuid references auth.users (id) on delete set null,
  reviewed_at            timestamptz,
  published_at           timestamptz,
  archived_at            timestamptz,
  archived_by            uuid references auth.users (id) on delete set null,
  archive_reason         text,
  status_before_archive  public.content_status,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  check ((kind = 'reference' and resource_type in ('book','study','research','report','guide','community_publication'))
      or (kind = 'tool' and resource_type in ('template','checklist','framework','digital_tool')))
);
create index resources_kind_status_idx on public.resources (kind, status);
create trigger resources_touch before update on public.resources
  for each row execute function public.touch_updated_at();

-- ---------- policies & acceptance ----------
create table public.policies (
  id            uuid primary key default gen_random_uuid(),
  version       text not null unique,
  title         text not null,
  body          text not null,
  published_at  timestamptz not null default now(),
  is_current    boolean not null default false
);
create unique index policies_one_current on public.policies (is_current) where is_current;

create table public.policy_acceptances (
  user_id      uuid not null references auth.users (id) on delete cascade,
  policy_id    uuid not null references public.policies (id) on delete restrict,
  accepted_at  timestamptz not null default now(),
  primary key (user_id, policy_id)
);

-- ---------- settings ----------
create table public.settings (
  key         text primary key,
  value       jsonb not null,
  visibility  public.setting_visibility not null default 'admin',
  updated_by  uuid references auth.users (id) on delete set null,
  updated_at  timestamptz not null default now()
);

-- ---------- account closure / deletion requests ----------
create table public.account_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  kind        public.account_request_kind not null,
  reason      text check (reason is null or char_length(reason) <= 1000),
  status      public.request_status not null default 'pending',
  created_at  timestamptz not null default now(),
  handled_by  uuid references auth.users (id) on delete set null,
  handled_at  timestamptz,
  handler_note text
);
create unique index account_requests_one_pending
  on public.account_requests (user_id) where status = 'pending';

-- ---------- audit ----------
create table public.audit_log (
  id           bigint generated always as identity primary key,
  actor        uuid,
  action       text not null,
  entity_type  text not null,
  entity_id    text,
  details      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log (created_at desc);
