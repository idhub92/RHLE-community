# Test results & feature status

_Run in the build environment on 10 Nov 2026._

## Automated checks that passed
| Check | Result |
|---|---|
| `tsc --noEmit` (strict TypeScript) | ✅ no errors |
| `next build` (production build, 41 routes) | ✅ |
| `check:bundle`: no service-role key name, value or JWT in `.next/static` | ✅ (requirement 17) |
| `npm run test:db`: **22/22 passing** against the real migrations on PGlite (Postgres 17 WASM), run as `anon` / `authenticated` with JWT claims | ✅ |
| RTL layout screenshots, desktop 1280px and mobile 390px (home, events, library, tools, join, sign-up, clinic, policy, restricted admin) | ✅ reviewed visually |

### Mapping to the required verification list
| # | Requirement | How it was verified |
|---|---|---|
| 1 | Register & verify a member | DB: a new identity becomes `incomplete`. An unverified e-mail is rejected by `complete_membership`. **Real e-mail delivery needs a live Supabase project (manual).** |
| 2 | Complete membership | DB test ✅ (status → active, policy acceptance recorded, outdated policy version rejected) |
| 3 | Sign out / sign in again | Uses the Supabase Auth flows in code. **Manual on a live project.** |
| 4 | Same profile from another session | DB test ✅ (separate transaction/session reads the same row) |
| 5 | Member A can't read/modify B | DB test ✅ (profiles, memberships, registrations) |
| 6 | Member can't assign admin role | DB test ✅ (RLS denies the insert; status/role columns are not writable; a permission manager can't grant platform admin) |
| 7 | Unauthorised admin request rejected | DB test ✅ (`member_directory`, `admin_metrics`, audit log, resource insert) |
| 8 | Publish reference → visible | DB test ✅ |
| 9 | Archive → removed from list **and** direct access | DB test ✅ (anon and member reads return nothing; the `/library/[id]` page 404s; `/download/[id]` refuses) |
| 10 | Restore → intended state | DB test ✅ (restore-to-published allowed only if it was published before archiving; lifecycle audited) |
| 11 | Register without duplicates | DB test ✅ |
| 12 | Cancel → capacity updated | DB test ✅ (seats_left 0 → 1, re-registration allowed) |
| 13 | Capacity under competing requests | DB test ✅ for capacity enforcement. The concurrency guarantee comes from `SELECT … FOR UPDATE` on the event row. **A true parallel load test needs a live Postgres (manual: fire ~20 simultaneous requests).** |
| 14 | Deadline & suspended member | DB test ✅ (deadline_passed, membership_inactive, suspended member can't edit profile) |
| 15 | Password recovery | Generic response, `/auth/confirm` → `/auth/reset` implemented. **Manual on a live project with SMTP.** |
| 16 | RTL on mobile & desktop | Screenshots ✅ (preview mode; logged-in and admin screens need live data) |
| 17 | No secrets in client bundle | ✅ |

Also tested: role revocation applies immediately to an open session; the last platform admin can't be removed; the WhatsApp link is visible only to active members; event cancellation requires a reason, closes registration and keeps registrations; the meeting link is visible only to registrants and event managers.

## Feature status
**Implemented**
- All 7 sections plus home, about, policy, join, auth (sign-up, verify, sign-in, forgot, reset, sign-out), onboarding, welcome and account.
- Membership states and their enforcement. Policy versioning with re-acceptance. Closure and deletion requests.
- Admin: dashboard (actual vs target), resources CRUD with review workflow, archive and restore, permanent delete, validated private uploads, events workflow (draft → publish → open/close registration → complete/cancel → archive), registrants, attendance, copyable notice text, members, team roles and titles, custom roles, reports and scoped CSV exports, settings, audit log.
- Design system: buttons, cards, forms, badges, tables, dialogs, empty, loading, success and error states. Logical CSS properties; keyboard focus styles.

**Partially implemented**
- *Notifications for cancelled or rescheduled events*: the app prepares the message and counts recipients, but it **does not send e-mail**. Sending is manual (WhatsApp or e-mail), as the brief allows.
- *Content managers manage assigned content*: content managers can currently manage **all** content. Per-item assignment can be added later if the team needs it.
- *Deferred sections* (clinic, blog, opportunities): introduction pages only, by design. No submission tables yet.

**Needs external configuration / manual verification**
- A Supabase project, the 4 environment variables, Auth redirect URLs and production SMTP (see README §1–2).
- The initial administrator (README §5).
- End-to-end checks 1, 3, 13 (true parallel load) and 15 on the live project.
- A legal review of the starter privacy policy text.
