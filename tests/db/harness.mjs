// Test harness: runs the real migrations on PGlite (Postgres compiled to WASM)
// with a minimal stand-in for Supabase's auth + storage schemas.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

const SUPABASE_STUB = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  email_confirmed_at timestamptz
);
create function auth.uid() returns uuid language sql stable as $$
  select nullif(nullif(current_setting('request.jwt.claims', true), '')::json ->> 'sub', '')::uuid
$$;
grant usage on schema auth to anon, authenticated;
grant execute on function auth.uid() to anon, authenticated;
grant usage on schema public to anon, authenticated;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean,
  file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects (id uuid primary key default gen_random_uuid(),
  bucket_id text, name text);
alter table storage.objects enable row level security;
`;

export async function makeDb() {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  const dir = join(root, 'supabase', 'migrations');
  for (const f of readdirSync(dir).sort()) {
    try {
      await db.exec(readFileSync(join(dir, f), 'utf8'));
    } catch (e) {
      throw new Error(`migration ${f} failed: ${e.message}`);
    }
  }
  return db;
}

/** create a confirmed (or unconfirmed) auth user; returns id */
export async function createUser(db, email, { confirmed = true } = {}) {
  const r = await db.query(
    `insert into auth.users (email, email_confirmed_at) values ($1, $2) returning id`,
    [email, confirmed ? new Date().toISOString() : null]
  );
  return r.rows[0].id;
}

/** run fn as a given user (or anon when uid is null) inside a transaction */
export async function as(db, uid, fn) {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${uid ? 'authenticated' : 'anon'}`);
    await tx.query(`select set_config('request.jwt.claims', $1, true)`, [
      JSON.stringify(uid ? { sub: uid, role: 'authenticated' } : { role: 'anon' }),
    ]);
    return fn(tx);
  });
}

/** privileged server-side setup (like the SQL editor / service role) */
export async function asAdminSql(db, sql, params = []) {
  return db.query(sql, params);
}

export async function grantRole(db, uid, roleKey) {
  await db.query(
    `insert into public.user_roles (user_id, role_id) select $1, id from public.roles where key = $2`,
    [uid, roleKey]
  );
}

export async function activeMember(db, email, name = 'عضو تجريبي') {
  const id = await createUser(db, email);
  await as(db, id, (tx) =>
    tx.query(`select public.complete_membership($1, 'practitioner', null, null, '{}', '1.0')`, [name])
  );
  return id;
}

export async function expectError(promise, key) {
  try {
    await promise;
  } catch (e) {
    if (key && !String(e.message).includes(key)) {
      throw new Error(`expected error "${key}" but got "${e.message}"`);
    }
    return e.message;
  }
  throw new Error(`expected error "${key ?? 'any'}" but call succeeded`);
}
