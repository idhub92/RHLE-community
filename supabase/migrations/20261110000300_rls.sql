-- =====================================================================
-- Row-level security and column grants.
-- Default: deny. Every table has RLS enabled; access is opened per rule.
-- =====================================================================

alter table public.profiles            enable row level security;
alter table public.memberships         enable row level security;
alter table public.permissions         enable row level security;
alter table public.roles               enable row level security;
alter table public.role_permissions    enable row level security;
alter table public.user_roles          enable row level security;
alter table public.team_titles         enable row level security;
alter table public.events              enable row level security;
alter table public.event_private       enable row level security;
alter table public.event_registrations enable row level security;
alter table public.event_attendance    enable row level security;
alter table public.resources           enable row level security;
alter table public.policies            enable row level security;
alter table public.policy_acceptances  enable row level security;
alter table public.settings            enable row level security;
alter table public.account_requests    enable row level security;
alter table public.audit_log           enable row level security;

-- ---------- table/column privileges ----------
revoke all on all tables in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated, public;

-- read access (rows still filtered by RLS)
grant select on public.events, public.resources, public.policies, public.settings to anon, authenticated;
grant select on public.profiles, public.memberships, public.permissions, public.roles,
               public.role_permissions, public.user_roles, public.team_titles,
               public.event_private, public.event_registrations, public.event_attendance,
               public.policy_acceptances, public.account_requests, public.audit_log
  to authenticated;

-- members may only edit these profile columns (never roles or status)
grant update (full_name, category, institution, bio, interests) on public.profiles to authenticated;

-- managers: write access, rows gated by RLS + permission checks
grant update (status, status_reason) on public.memberships to authenticated;
grant insert, update, delete on public.events, public.event_private to authenticated;
grant update (status) on public.event_registrations to authenticated;
grant insert, update on public.event_attendance to authenticated;
grant insert, update, delete on public.resources to authenticated;
grant insert, delete on public.user_roles to authenticated;
grant insert, update, delete on public.roles, public.role_permissions to authenticated;
grant insert, update, delete on public.team_titles to authenticated;
grant insert, update on public.settings to authenticated;
grant insert, update on public.policies to authenticated;
grant insert on public.account_requests to authenticated;
grant update (status, handler_note, handled_by, handled_at) on public.account_requests to authenticated;

-- RPCs
-- used inside RLS expressions, so anon needs EXECUTE too (they return false/null for anon)
grant execute on function public.has_permission(text)              to anon, authenticated;
grant execute on function public.is_team_member()                  to anon, authenticated;
grant execute on function public.my_membership_status()            to anon, authenticated;
grant execute on function public.complete_membership(text, public.member_category, text, text, text[], text) to authenticated;
grant execute on function public.register_for_event(uuid)          to authenticated;
grant execute on function public.cancel_event_registration(uuid)   to authenticated;
grant execute on function public.event_availability(uuid)          to anon, authenticated;
grant execute on function public.event_registrants(uuid)           to authenticated;
grant execute on function public.member_directory()                to authenticated;
grant execute on function public.team_directory()                  to authenticated;
grant execute on function public.find_user_by_email(text)          to authenticated;
grant execute on function public.public_team()                     to anon, authenticated;
grant execute on function public.admin_metrics()                   to authenticated;

-- ---------- profiles ----------
create policy profiles_select_own on public.profiles for select to authenticated
  using (id = auth.uid() or public.has_permission('members.manage'));

create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid() and public.my_membership_status() in ('incomplete', 'active'))
  with check (id = auth.uid());

-- ---------- memberships ----------
create policy memberships_select on public.memberships for select to authenticated
  using (user_id = auth.uid() or public.has_permission('members.manage'));

create policy memberships_update_mgr on public.memberships for update to authenticated
  using (public.has_permission('members.manage'))
  with check (public.has_permission('members.manage'));

-- ---------- roles & permissions ----------
create policy permissions_read on public.permissions for select to authenticated using (true);
create policy roles_read on public.roles for select to authenticated using (true);
create policy role_perms_read on public.role_permissions for select to authenticated using (true);

create policy roles_write on public.roles for all to authenticated
  using (public.has_permission('platform.admin') and not is_system)
  with check (public.has_permission('platform.admin') and not is_system);
create policy role_perms_write on public.role_permissions for all to authenticated
  using (public.has_permission('platform.admin')
         and not exists (select 1 from public.roles r where r.id = role_id and r.is_system))
  with check (public.has_permission('platform.admin')
         and not exists (select 1 from public.roles r where r.id = role_id and r.is_system));

create policy user_roles_read on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.has_permission('permissions.manage'));
create policy user_roles_insert on public.user_roles for insert to authenticated
  with check (public.has_permission('permissions.manage'));
create policy user_roles_delete on public.user_roles for delete to authenticated
  using (public.has_permission('permissions.manage'));

create policy team_titles_read on public.team_titles for select to authenticated
  using (user_id = auth.uid() or public.has_permission('permissions.manage'));
create policy team_titles_write on public.team_titles for all to authenticated
  using (public.has_permission('permissions.manage'))
  with check (public.has_permission('permissions.manage'));

-- ---------- events ----------
create policy events_public_read on public.events for select to anon, authenticated
  using (status in ('published', 'cancelled')
         or (status = 'completed' and show_when_past)
         or public.has_permission('events.manage'));
create policy events_manage_insert on public.events for insert to authenticated
  with check (public.has_permission('events.manage'));
create policy events_manage_update on public.events for update to authenticated
  using (public.has_permission('events.manage'))
  with check (public.has_permission('events.manage'));
create policy events_manage_delete on public.events for delete to authenticated
  using (public.has_permission('platform.admin') and status = 'draft');

create policy event_private_read on public.event_private for select to authenticated
  using (public.has_permission('events.manage')
         or exists (select 1 from public.event_registrations r
                    join public.memberships m on m.user_id = r.user_id
                    where r.event_id = event_private.event_id and r.user_id = auth.uid()
                      and r.status = 'registered' and m.status = 'active'));
create policy event_private_write on public.event_private for all to authenticated
  using (public.has_permission('events.manage'))
  with check (public.has_permission('events.manage'));

-- members never insert registrations directly: register_for_event() only
create policy registrations_read on public.event_registrations for select to authenticated
  using (user_id = auth.uid() or public.has_permission('events.manage'));
create policy registrations_mgr_update on public.event_registrations for update to authenticated
  using (public.has_permission('events.manage'))
  with check (public.has_permission('events.manage'));

create policy attendance_read on public.event_attendance for select to authenticated
  using (user_id = auth.uid() or public.has_permission('events.manage'));
create policy attendance_write on public.event_attendance for insert to authenticated
  with check (public.has_permission('events.manage'));
create policy attendance_update on public.event_attendance for update to authenticated
  using (public.has_permission('events.manage'))
  with check (public.has_permission('events.manage'));

-- ---------- resources ----------
create policy resources_public_read on public.resources for select to anon, authenticated
  using (status = 'published' or public.has_permission('content.manage'));
create policy resources_insert on public.resources for insert to authenticated
  with check (public.has_permission('content.manage'));
create policy resources_update on public.resources for update to authenticated
  using (public.has_permission('content.manage'))
  with check (public.has_permission('content.manage'));
-- permanent deletion is separate from archiving and restricted to platform admins
create policy resources_delete on public.resources for delete to authenticated
  using (public.has_permission('platform.admin') and status in ('draft', 'archived'));

-- ---------- policies ----------
create policy policies_read on public.policies for select to anon, authenticated using (true);
create policy policies_write on public.policies for insert to authenticated
  with check (public.has_permission('platform.admin'));
create policy policies_update on public.policies for update to authenticated
  using (public.has_permission('platform.admin'))
  with check (public.has_permission('platform.admin'));

create policy acceptances_read on public.policy_acceptances for select to authenticated
  using (user_id = auth.uid() or public.has_permission('members.manage'));

-- ---------- settings ----------
create policy settings_read on public.settings for select to anon, authenticated
  using (visibility = 'public'
         or (visibility = 'members' and (public.my_membership_status() = 'active' or public.is_team_member()))
         or public.has_permission('platform.admin'));
create policy settings_insert on public.settings for insert to authenticated
  with check (public.has_permission('platform.admin'));
create policy settings_update on public.settings for update to authenticated
  using (public.has_permission('platform.admin'))
  with check (public.has_permission('platform.admin'));

-- ---------- account requests ----------
create policy acct_req_read on public.account_requests for select to authenticated
  using (user_id = auth.uid() or public.has_permission('members.manage'));
create policy acct_req_insert on public.account_requests for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');
create policy acct_req_update on public.account_requests for update to authenticated
  using (public.has_permission('members.manage'))
  with check (public.has_permission('members.manage'));

-- ---------- audit ----------
create policy audit_read on public.audit_log for select to authenticated
  using (public.has_permission('platform.admin'));
-- no insert/update/delete policies: written only by SECURITY DEFINER triggers

grant execute on function public.my_context()                      to authenticated;
grant execute on function public.staff_names(uuid[])               to authenticated;
grant execute on function public.accept_current_policy()           to authenticated;
grant execute on function public.publish_policy(text, text, text)  to authenticated;
