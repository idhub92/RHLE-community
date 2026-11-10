# مجتمعات تصميم — Architecture (Phase 1)

## Stack
- **Next.js 15 (App Router) + TypeScript**. Server Components for reads; Server Actions for every mutation (Next.js checks the request Origin on Server Actions, which covers CSRF).
- **Supabase Auth** for e-mail and password. Passwords never touch our code or database tables.
- **PostgreSQL (Supabase)** with RLS on every table, plus `SECURITY DEFINER` functions for atomic operations.
- **Supabase Storage**: one private bucket. Downloads go through 60-second signed URLs, and only after an RLS-checked read.
- No browser Supabase client. Only the public anon URL and key exist on the client side, and the service-role key stays on the server.

## Screen inventory & navigation map
```
Header: [الفعاليات][عيادة المصمم][مكتبة المصمم][أدوات المصمم][مدونة المجتمع][فرص المصممين][انضم إلينا*]
        guest  → تسجيل الدخول | انضم إلى المجتمع
        member → حسابي (+ إدارة المنصة for team accounts)      (*hidden for existing members)

/                      Home: banner, intro, CTA, 7 spaces, next event, latest refs/tools, purpose
/about                 About + public team titles + contact
/policy                Current privacy & community policy
/join                  Membership (active) · volunteering (later) · operating team (later)
/events                Upcoming | past           → /events/[id]  details + registration panel
/library               Search + type/category/language filters → /library/[id]
/tools                 Search + type/category → /tools/[id]  (purpose, instructions, version, file)
/clinic /blog /opportunities   Introductory pages, no submission controls (deferred)
/auth/sign-up → /auth/verify → (email link) /auth/confirm → /onboarding → /welcome → /account
/auth/sign-in · /auth/forgot → (email) /auth/confirm → /auth/reset · /auth/error
/account               Status, my events (cancel), WhatsApp, profile edit, policy re-accept,
                       password change, closure/deletion request, sign-out
/download/[id]         Approved file → signed URL (published + distribution allowed only)
/admin                 Dashboard (actual vs target, review queue, events, audit)
/admin/resources?kind= List → /new → /[id] (editor + workflow) → /[id]/preview
/admin/events          List → /new → /[id] (editor, workflow, registrants, attendance, notice) → /preview
/admin/members         Directory, status changes, closure/deletion requests
/admin/team            Grant/revoke roles by e-mail, public titles, role matrix, custom roles
/admin/reports         Targets vs actual, permission-scoped CSV exports
/admin/archive         Search/filter archived records, preview, restore
/admin/settings        WhatsApp URL, contact e-mail, pilot targets/period, policy versions
```
Dialogs: policy reader, registration cancellation, unsaved edits, archive, restore, permanent delete, role grant/revoke, member suspension, expired session, restricted-access page.

## Membership states
| State | Sign in | View account | Edit profile | Register for events | WhatsApp link | Admin permissions |
|---|---|---|---|---|---|---|
| incomplete | ✓ | redirected to onboarding | via onboarding | ✗ | ✗ | kept (team can complete later) |
| active | ✓ | ✓ | ✓ | ✓ | ✓ | as granted |
| suspended | ✓ | read-only | ✗ | ✗ | ✗ | **suspended** (`has_permission` returns false) |
| closed | ✓ | read-only | ✗ | ✗ | ✗ | **suspended** |

All of these are enforced in SQL (`register_for_event`, the `profiles_update_own` policy, `has_permission`), so a direct API call cannot get around them.

## Permission matrix (system roles)
| Capability | platform_admin | content_manager | event_manager | membership_manager | report_viewer | permission_manager |
|---|---|---|---|---|---|---|
| Create/edit/review/publish/archive/restore resources | ✓ | ✓ | | | | |
| Permanently delete draft/archived resources | ✓ | | | | | |
| Manage events, registrations, attendance, meeting links | ✓ | | ✓ | | | |
| Member directory (incl. e-mail), status changes, closure requests | ✓ | | | ✓ | | |
| Execute account deletion | ✓ | | | | | |
| Aggregated metrics + summary CSV | ✓ | | | | ✓ | |
| Members CSV / registrations CSV | ✓ | | | ✓ / – | | |
| Grant/revoke non-sensitive roles, public titles | ✓ | | | | | ✓ |
| Grant `platform.admin` / `permissions.manage` roles | ✓ | | | | | |
| Settings, policy versions, custom roles, audit log | ✓ | | | | | |

One person can hold several roles. Category (student, practitioner or interested) and public title never grant permissions.

## Schema (summary)
`auth.users` (provider) → `profiles` (1:1), `memberships` (1:1, created by trigger)
`permissions`, `roles`, `role_permissions`, `user_roles(granted_by, granted_at)`, `team_titles`
`events` → `event_private(meeting_url)`, `event_registrations` (partial unique index: one *active* registration per member/event), `event_attendance` (separate from registration)
`resources` (references + tools; lifecycle stamps, file metadata, archive info)
`policies` (versioned, one current) → `policy_acceptances(user, policy, accepted_at)`
`settings(key, value, visibility)`, `account_requests`, `audit_log`
All relations use `auth.users.id`. Foreign keys use `ON DELETE RESTRICT` where history matters (events → registrations/attendance).

## Content lifecycle
`draft → in_review → published → archived`, plus *reject* (in_review → draft, with a reason), *withdraw*, *unpublish* (published → draft), *restore* (archived → draft, or → published if it was published before). A database trigger enforces these transitions and stamps who did what and when. Archived rows are read-only. Permanent deletion is a separate action for platform admins only.

**Archived content:** hidden by RLS (it never appears in lists or search, and old URLs return 404). Its file has no public URL. Managers can still see it with its full history in the audit log.
**Archived events:** hidden publicly. Registrations and attendance are kept (FK `RESTRICT`), and restoring returns the event to its previous state. **Completed** events are not archived records: they appear under «السابقة» when `show_when_past` is set.

## Concurrency
`register_for_event` locks the event row (`SELECT … FOR UPDATE`) before it counts seats. Concurrent requests therefore queue up, so the event cannot be overbooked. The partial unique index is a second guard against duplicate registrations.
