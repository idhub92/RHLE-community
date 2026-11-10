# مجتمعات تصميم — المجتمع المهني للمصممين التعليميين

The community platform: Next.js 15 + TypeScript + Supabase (Auth, Postgres with RLS, Storage).
The interface is in Arabic and right-to-left throughout.

- Architecture, screen map, schema and permission matrix: [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- Test results and feature status: [`docs/STATUS.md`](docs/STATUS.md)

---

## 1. Create the Supabase project (≈10 minutes)

1. Create a free project at <https://supabase.com> and pick the region closest to your members (e.g. Frankfurt or Mumbai).
2. **Run the migrations.** Open SQL Editor and run each file in `supabase/migrations/` **in order** (`…0100_schema` → `…0500_reference_data`).
   With the Supabase CLI, run `supabase link` and then `supabase db push` instead.
3. **Optional:** run `supabase/seed/optional_real_content.sql` to add the first council (7 Nov 2026) as a past event.
4. **Authentication → Providers → Email**: keep *Email* enabled and **Confirm email ON**.
5. **Authentication → URL Configuration**
   - Site URL: `https://YOUR-DOMAIN`
   - Redirect URLs: `https://YOUR-DOMAIN/auth/confirm` (and `http://localhost:3000/auth/confirm` for development)
6. **Authentication → Emails → SMTP**: the built-in sender is rate-limited and meant for testing only. Before launch, set up a real SMTP provider (Resend, Brevo, Amazon SES, etc.) so verification and recovery e-mails arrive reliably.
7. *(Recommended)* **Authentication → Emails → Templates**: translate the "Confirm signup" and "Reset password" templates into Arabic. Keep the `{{ .ConfirmationURL }}` placeholder.
8. *(Recommended)* **Authentication → Policies**: enable leaked-password protection, with a minimum password length of 8.

## 2. Configure environment variables

Copy `.env.example` to `.env.local` locally, or add the variables in your hosting dashboard:

| Variable | Where to find it | Exposed to the browser? |
|---|---|---|
| `NEXT_PUBLIC_SITE_URL` | your domain | yes (not secret) |
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API | yes (not secret) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API → anon/public | yes (not secret; RLS protects data) |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API → service_role | **NO, server only** |

Never commit `.env.local`, and never paste keys into chats or tickets.

## 3. Run locally

```bash
npm install
npm run dev            # http://localhost:3000
npm run test:db        # 22 database security/workflow tests (no Supabase needed)
npm run build && npm run check:bundle   # build + verify no secrets in the client bundle
```
If the variables are not set, the site runs in **preview mode**: pages render with empty states and a notice, and sign-in is disabled.

## 4. Deploy (Vercel recommended)

1. Push the project to a private GitHub repository.
2. Import it in Vercel, add the four environment variables (Production and Preview), and deploy.
3. Add your domain, then update **Site URL** and **Redirect URLs** in Supabase to match it.

Any Node 20+ host that runs `next start` will also work.

## 5. Create the first platform administrator (one time)

The first person to register does **not** become an administrator, and no account is promoted automatically.

1. The approved person (e.g. the project manager) signs up on the live site, verifies the e-mail address and completes membership.
2. On a trusted computer with the project checked out:
   ```bash
   SUPABASE_URL=https://xxxx.supabase.co \
   SUPABASE_SERVICE_ROLE_KEY=****** \
   node scripts/bootstrap-admin.mjs approved-person@example.org --confirm
   ```
   The script refuses to run if an administrator already exists, if the account doesn't exist, or if its e-mail address is unverified.
   *Alternative:* in Supabase SQL Editor (which runs with owner privileges):
   ```sql
   insert into public.user_roles (user_id, role_id)
   select u.id, r.id from auth.users u, public.roles r
   where u.email = 'approved-person@example.org' and u.email_confirmed_at is not null
     and r.key = 'platform_admin';
   ```
3. From then on, the administrator grants roles to other team members from **إدارة المنصة ← الفريق والصلاحيات**. Each team member uses their own account.

## 6. First-day checklist for the team

- **إعدادات المنصة**: add the WhatsApp invitation link and the contact e-mail, and review the pilot targets and dates.
- **إعدادات المنصة**: review the policy text, which is a starting draft. Publish version 1.1 if you change it.
- **الفريق والصلاحيات**: grant roles (content, events, membership, reports) and set the public titles shown on «عن المجتمع».
- **المراجع / الأدوات**: create the 3 references and 3 tools, then submit, approve and publish them. Upload a file only if distribution is permitted.
- **الفعاليات**: create the next council as a draft, preview it, publish it and open registration.

## Project layout
```
supabase/migrations/   schema, workflow triggers & RPCs, RLS + grants, storage, reference data
supabase/seed/         optional real content
src/app/               pages & server actions (public, auth, account, admin)
src/components/        design system (ActionForm, dialogs, cards, banner…)
src/lib/               supabase clients, session, data access, labels, errors
tests/db/              PGlite-based security tests running the real migrations
scripts/               bootstrap-admin, check-bundle-secrets
```
