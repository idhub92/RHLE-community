// Database security & workflow tests (run: npm run test:db)
// These execute the real migrations and RLS policies as anon / member / team roles.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeDb, createUser, as, grantRole, activeMember, expectError } from './harness.mjs';

const db = await makeDb();

// ---------- accounts ----------
const alice = await activeMember(db, 'alice@example.test', 'أليس');
const bob = await activeMember(db, 'bob@example.test', 'بوب');
const admin = await activeMember(db, 'admin@example.test', 'مديرة المنصة');
await grantRole(db, admin, 'platform_admin'); // privileged setup path (no auth.uid())
const editor = await activeMember(db, 'editor@example.test', 'محررة');
await grantRole(db, editor, 'content_manager');
const evm = await activeMember(db, 'events@example.test', 'منسقة الفعاليات');
await grantRole(db, evm, 'event_manager');

test('1-2. sign-up creates incomplete membership; completion activates it', async () => {
  const u = await createUser(db, 'new@example.test');
  const before = await as(db, u, (tx) => tx.query(`select status from public.memberships where user_id = auth.uid()`));
  assert.equal(before.rows[0].status, 'incomplete');
  await as(db, u, (tx) =>
    tx.query(`select public.complete_membership('عضوة جديدة', 'student', 'جامعة', 'نبذة', array['تقييم'], '1.0')`)
  );
  const after = await as(db, u, (tx) =>
    tx.query(`select m.status, p.full_name, p.category from public.memberships m join public.profiles p on p.id = m.user_id where m.user_id = auth.uid()`)
  );
  assert.equal(after.rows[0].status, 'active');
  assert.equal(after.rows[0].full_name, 'عضوة جديدة');
  const acc = await as(db, u, (tx) => tx.query(`select count(*)::int c from public.policy_acceptances where user_id = auth.uid()`));
  assert.equal(acc.rows[0].c, 1);
});

test('1b. unverified e-mail cannot complete membership', async () => {
  const u = await createUser(db, 'unverified@example.test', { confirmed: false });
  await expectError(
    as(db, u, (tx) => tx.query(`select public.complete_membership('اسم', 'student', null, null, '{}', '1.0')`)),
    'email_unverified'
  );
});

test('1c. outdated policy version is rejected', async () => {
  const u = await createUser(db, 'policy@example.test');
  await expectError(
    as(db, u, (tx) => tx.query(`select public.complete_membership('اسم', 'student', null, null, '{}', '0.9')`)),
    'policy_outdated'
  );
});

test('4. the same profile is returned in a separate session', async () => {
  const r = await as(db, alice, (tx) => tx.query(`select full_name from public.profiles where id = auth.uid()`));
  assert.equal(r.rows[0].full_name, 'أليس');
});

test('5. member A cannot read or modify member B private records', async () => {
  const read = await as(db, alice, (tx) => tx.query(`select * from public.profiles where id = $1`, [bob]));
  assert.equal(read.rows.length, 0);
  const upd = await as(db, alice, (tx) =>
    tx.query(`update public.profiles set full_name = 'مخترق' where id = $1 returning id`, [bob])
  );
  assert.equal(upd.rows.length, 0);
  const regs = await as(db, alice, (tx) => tx.query(`select * from public.event_registrations where user_id = $1`, [bob]));
  assert.equal(regs.rows.length, 0);
  const mem = await as(db, alice, (tx) => tx.query(`select * from public.memberships where user_id = $1`, [bob]));
  assert.equal(mem.rows.length, 0);
});

test('6. a member cannot assign themselves an administrative role or change own status', async () => {
  await expectError(
    as(db, alice, (tx) =>
      tx.query(`insert into public.user_roles (user_id, role_id) select auth.uid(), id from public.roles where key = 'platform_admin'`)
    )
  );
  // column privilege: membership status is not writable by members
  const r = await as(db, alice, (tx) =>
    tx.query(`update public.memberships set status = 'active' where user_id = auth.uid() returning user_id`)
  );
  assert.equal(r.rows.length, 0);
  // profile has no role column; updating a non-granted column is refused
  await expectError(
    as(db, alice, (tx) => tx.query(`update public.profiles set created_at = now() where id = auth.uid()`)),
    'permission denied'
  );
});

test('6b. permission manager cannot grant the platform-admin role', async () => {
  const pm = await activeMember(db, 'pm@example.test', 'مديرة صلاحيات');
  await grantRole(db, pm, 'permission_manager');
  await expectError(
    as(db, pm, (tx) =>
      tx.query(`insert into public.user_roles (user_id, role_id) select $1, id from public.roles where key = 'platform_admin'`, [alice])
    ),
    'requires_platform_admin'
  );
  // but may grant a non-sensitive role
  await as(db, pm, (tx) =>
    tx.query(`insert into public.user_roles (user_id, role_id) select $1, id from public.roles where key = 'report_viewer'`, [bob])
  );
  const ok = await as(db, bob, (tx) => tx.query(`select public.has_permission('reports.view') v`));
  assert.equal(ok.rows[0].v, true);
});

test('7. unauthorised calls to admin functions are rejected', async () => {
  await expectError(as(db, alice, (tx) => tx.query(`select * from public.member_directory()`)), 'forbidden');
  await expectError(as(db, alice, (tx) => tx.query(`select public.admin_metrics()`)), 'forbidden');
  await expectError(as(db, null, (tx) => tx.query(`select public.admin_metrics()`)), 'permission denied');
  const audit = await as(db, alice, (tx) => tx.query(`select * from public.audit_log`));
  assert.equal(audit.rows.length, 0);
  const ins = await expectError(
    as(db, alice, (tx) => tx.query(`insert into public.resources (kind, resource_type, title) values ('reference','book','محاولة')`))
  );
  assert.ok(ins);
});

let refId;
test('8. publish a reference and verify public visibility', async () => {
  const r = await as(db, editor, (tx) =>
    tx.query(`insert into public.resources (kind, resource_type, title, source_url) values ('reference','guide','دليل تجريبي','https://example.org') returning id`)
  );
  refId = r.rows[0].id;
  let pub = await as(db, null, (tx) => tx.query(`select id from public.resources where id = $1`, [refId]));
  assert.equal(pub.rows.length, 0, 'draft hidden from public');
  await as(db, editor, (tx) => tx.query(`update public.resources set status = 'in_review' where id = $1`, [refId]));
  await expectError(
    as(db, editor, (tx) => tx.query(`update public.resources set status = 'archived' where id = $1`, [refId])),
    'archive_reason_required'
  );
  await as(db, editor, (tx) => tx.query(`update public.resources set status = 'published' where id = $1`, [refId]));
  pub = await as(db, null, (tx) => tx.query(`select id, published_at from public.resources where id = $1`, [refId]));
  assert.equal(pub.rows.length, 1);
  assert.ok(pub.rows[0].published_at);
});

test('9. archive removes it from public list and direct access', async () => {
  await as(db, editor, (tx) =>
    tx.query(`update public.resources set status = 'archived', archive_reason = 'انتهت صلاحيته' where id = $1`, [refId])
  );
  const list = await as(db, null, (tx) => tx.query(`select id from public.resources where status = 'published'`));
  assert.ok(!list.rows.some((x) => x.id === refId));
  const direct = await as(db, alice, (tx) => tx.query(`select id from public.resources where id = $1`, [refId]));
  assert.equal(direct.rows.length, 0);
  const mgr = await as(db, editor, (tx) =>
    tx.query(`select status, archived_by, archive_reason, status_before_archive from public.resources where id = $1`, [refId])
  );
  assert.equal(mgr.rows[0].status, 'archived');
  assert.equal(mgr.rows[0].archived_by, editor);
  assert.equal(mgr.rows[0].status_before_archive, 'published');
  await expectError(
    as(db, editor, (tx) => tx.query(`update public.resources set title = 'تعديل' where id = $1`, [refId])),
    'archived_readonly'
  );
});

test('10. restore returns it to the intended publication state', async () => {
  await as(db, editor, (tx) => tx.query(`update public.resources set status = 'published' where id = $1`, [refId]));
  const pub = await as(db, null, (tx) => tx.query(`select status from public.resources where id = $1`, [refId]));
  assert.equal(pub.rows[0].status, 'published');
  const log = await as(db, admin, (tx) =>
    tx.query(`select action, details from public.audit_log where entity_id = $1 order by id`, [refId])
  );
  assert.ok(log.rows.length >= 4, 'lifecycle is audited');
});

test('10b. rejected review returns to editing with a reason', async () => {
  const r = await as(db, editor, (tx) =>
    tx.query(`insert into public.resources (kind, resource_type, title) values ('tool','template','قالب') returning id`)
  );
  const id = r.rows[0].id;
  await as(db, editor, (tx) => tx.query(`update public.resources set status = 'in_review' where id = $1`, [id]));
  await as(db, editor, (tx) =>
    tx.query(`update public.resources set status = 'draft', review_note = 'أضيفي التعليمات' where id = $1`, [id])
  );
  const s = await as(db, editor, (tx) => tx.query(`select status, review_note from public.resources where id = $1`, [id]));
  assert.deepEqual(s.rows[0], { status: 'draft', review_note: 'أضيفي التعليمات' });
});

let evId;
test('11. register for an event without duplicates', async () => {
  const r = await as(db, evm, (tx) =>
    tx.query(`insert into public.events (title, starts_at, capacity, registration_deadline)
              values ('مجلس تجريبي', now() + interval '10 days', 2, now() + interval '9 days') returning id`)
  );
  evId = r.rows[0].id;
  await expectError(as(db, alice, (tx) => tx.query(`select public.register_for_event($1)`, [evId])), 'event_unavailable');
  await as(db, evm, (tx) => tx.query(`update public.events set status = 'published', registration_open = true where id = $1`, [evId]));
  await as(db, alice, (tx) => tx.query(`select public.register_for_event($1)`, [evId]));
  await expectError(as(db, alice, (tx) => tx.query(`select public.register_for_event($1)`, [evId])), 'already_registered');
  const c = await as(db, alice, (tx) => tx.query(`select count(*)::int c from public.event_registrations where event_id = $1`, [evId]));
  assert.equal(c.rows[0].c, 1);
});

test('12. cancel and verify updated capacity', async () => {
  await as(db, bob, (tx) => tx.query(`select public.register_for_event($1)`, [evId]));
  let a = await as(db, null, (tx) => tx.query(`select * from public.event_availability($1)`, [evId]));
  assert.equal(a.rows[0].seats_left, 0);
  await as(db, bob, (tx) => tx.query(`select public.cancel_event_registration($1)`, [evId]));
  a = await as(db, null, (tx) => tx.query(`select * from public.event_availability($1)`, [evId]));
  assert.equal(a.rows[0].seats_left, 1);
  // re-registration after cancellation is allowed (new active row)
  await as(db, bob, (tx) => tx.query(`select public.register_for_event($1)`, [evId]));
});

test('13. capacity is enforced (row lock serialises competing requests)', async () => {
  const carol = await activeMember(db, 'carol@example.test', 'كارول');
  await expectError(as(db, carol, (tx) => tx.query(`select public.register_for_event($1)`, [evId])), 'capacity_full');
  const c = await as(db, evm, (tx) =>
    tx.query(`select count(*)::int c from public.event_registrations where event_id = $1 and status = 'registered'`, [evId])
  );
  assert.equal(c.rows[0].c, 2);
});

test('14. deadlines and suspended members are enforced server-side', async () => {
  const r = await as(db, evm, (tx) =>
    tx.query(`insert into public.events (title, starts_at, registration_deadline)
              values ('ورشة', now() + interval '5 days', now() - interval '1 hour') returning id`)
  );
  const id = r.rows[0].id;
  await as(db, evm, (tx) => tx.query(`update public.events set status = 'published', registration_open = true where id = $1`, [id]));
  const dave = await activeMember(db, 'dave@example.test', 'داود');
  await expectError(as(db, dave, (tx) => tx.query(`select public.register_for_event($1)`, [id])), 'deadline_passed');

  // suspend dave via a membership manager
  const mm = await activeMember(db, 'mm@example.test', 'مديرة عضويات');
  await grantRole(db, mm, 'membership_manager');
  await as(db, mm, (tx) => tx.query(`update public.memberships set status = 'suspended', status_reason = 'مخالفة' where user_id = $1`, [dave]));
  const ev2 = await as(db, evm, (tx) =>
    tx.query(`insert into public.events (title, starts_at) values ('لقاء', now() + interval '3 days') returning id`)
  );
  await as(db, evm, (tx) => tx.query(`update public.events set status = 'published', registration_open = true where id = $1`, [ev2.rows[0].id]));
  await expectError(as(db, dave, (tx) => tx.query(`select public.register_for_event($1)`, [ev2.rows[0].id])), 'membership_inactive');
  const upd = await as(db, dave, (tx) => tx.query(`update public.profiles set bio = 'x' where id = auth.uid() returning id`));
  assert.equal(upd.rows.length, 0, 'suspended member cannot edit profile');
});

test('14b. incomplete members cannot register', async () => {
  const u = await createUser(db, 'incomplete@example.test');
  await expectError(as(db, u, (tx) => tx.query(`select public.register_for_event($1)`, [evId])), 'membership_incomplete');
});

test('meeting link is visible only to registered members and event managers', async () => {
  await as(db, evm, (tx) => tx.query(`insert into public.event_private (event_id, meeting_url) values ($1, 'https://teams.example/x')`, [evId]));
  const a = await as(db, alice, (tx) => tx.query(`select meeting_url from public.event_private where event_id = $1`, [evId]));
  assert.equal(a.rows.length, 1);
  const outsider = await activeMember(db, 'eve@example.test', 'إيف');
  const e = await as(db, outsider, (tx) => tx.query(`select meeting_url from public.event_private where event_id = $1`, [evId]));
  assert.equal(e.rows.length, 0);
  const anon = await expectError(as(db, null, (tx) => tx.query(`select * from public.event_private`)), 'permission denied');
  assert.ok(anon);
});

test('revoking a role takes effect immediately for the same session', async () => {
  const tmp = await activeMember(db, 'tmp@example.test', 'مؤقت');
  await grantRole(db, tmp, 'content_manager');
  let ok = await as(db, tmp, (tx) => tx.query(`select public.has_permission('content.manage') v`));
  assert.equal(ok.rows[0].v, true);
  await as(db, admin, (tx) =>
    tx.query(`delete from public.user_roles where user_id = $1`, [tmp])
  );
  ok = await as(db, tmp, (tx) => tx.query(`select public.has_permission('content.manage') v`));
  assert.equal(ok.rows[0].v, false);
});

test('the last platform admin cannot be removed', async () => {
  await expectError(
    as(db, admin, (tx) => tx.query(`delete from public.user_roles where user_id = $1`, [admin])),
    'last_platform_admin'
  );
});

test('WhatsApp link is readable by active members only', async () => {
  await as(db, admin, (tx) => tx.query(`update public.settings set value = '"https://chat.whatsapp.com/abc"' where key = 'whatsapp_invite_url'`));
  const m = await as(db, alice, (tx) => tx.query(`select value from public.settings where key = 'whatsapp_invite_url'`));
  assert.equal(m.rows.length, 1);
  const anon = await as(db, null, (tx) => tx.query(`select value from public.settings where key = 'whatsapp_invite_url'`));
  assert.equal(anon.rows.length, 0);
  const t = await as(db, alice, (tx) => tx.query(`select value from public.settings where key = 'pilot_targets'`));
  assert.equal(t.rows.length, 0);
});

test('event cancellation requires a reason and closes registration', async () => {
  await expectError(as(db, evm, (tx) => tx.query(`update public.events set status = 'cancelled' where id = $1`, [evId])), 'cancel_reason_required');
  await as(db, evm, (tx) => tx.query(`update public.events set status = 'cancelled', status_note = 'اعتذار المتحدث' where id = $1`, [evId]));
  const e = await as(db, null, (tx) => tx.query(`select status, registration_open from public.events where id = $1`, [evId]));
  assert.deepEqual(e.rows[0], { status: 'cancelled', registration_open: false });
  // registrations are retained, not erased
  const c = await as(db, evm, (tx) => tx.query(`select count(*)::int c from public.event_registrations where event_id = $1`, [evId]));
  assert.ok(c.rows[0].c >= 2);
});
