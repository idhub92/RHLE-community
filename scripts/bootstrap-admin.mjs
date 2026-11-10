#!/usr/bin/env node
/**
 * One-time initial administrator setup (privileged, server-side).
 *
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
 *     node scripts/bootstrap-admin.mjs owner@example.org --confirm
 *
 * - The person must ALREADY have signed up and verified the e-mail address themselves.
 * - Run it from a trusted machine. The service-role key is read from the environment,
 *   never from the command line, and is never sent to the browser.
 * - It refuses to run if any platform administrator already exists; after that,
 *   administrators grant roles from «إدارة المنصة ← الفريق والصلاحيات».
 */
import { createClient } from '@supabase/supabase-js';

const [, , email, flag] = process.argv;
const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!email || flag !== '--confirm') {
  console.error('Usage: node scripts/bootstrap-admin.mjs <approved-email> --confirm');
  process.exit(1);
}
if (!url || !key) {
  console.error('Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in the environment.');
  process.exit(1);
}

const db = createClient(url, key, { auth: { persistSession: false } });

const { data: role } = await db.from('roles').select('id').eq('key', 'platform_admin').single();
const { data: existing } = await db.from('user_roles').select('user_id').eq('role_id', role.id).limit(1);
if (existing?.length) {
  console.error('A platform administrator already exists. Grant further roles from the admin UI.');
  process.exit(1);
}

// find the confirmed account by e-mail (paged admin API)
let user = null;
for (let page = 1; page < 50 && !user; page++) {
  const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
  if (error) throw error;
  user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (data.users.length < 200) break;
}
if (!user) {
  console.error('No account with that e-mail. Ask the person to sign up first.');
  process.exit(1);
}
if (!user.email_confirmed_at) {
  console.error('The account e-mail is not verified yet.');
  process.exit(1);
}

const { error } = await db.from('user_roles').insert({ user_id: user.id, role_id: role.id });
if (error) throw error;
console.log(`✓ ${email} is now the initial platform administrator.`);
