import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

/**
 * Phase 2 exit tests (tenant isolation, roles, delegation, immutability).
 * Runs the real migrations against an in-process Postgres (PGlite) with a stub of the Supabase
 * roles/auth schema. These are SQL-level tests; a CI run against `supabase start` (real Supabase
 * stack) should be added as a second pass once Docker is available.
 */

const U = {
  root: "00000000-0000-0000-0000-0000000000a1", // super admin
  alice: "00000000-0000-0000-0000-0000000000b1", // owner of org A
  bob: "00000000-0000-0000-0000-0000000000b2", // owner of org B
  carol: "00000000-0000-0000-0000-0000000000c1", // org admin A (no default perms)
  dave: "00000000-0000-0000-0000-0000000000c2", // event manager A (event E1)
  erin: "00000000-0000-0000-0000-0000000000c3", // contestant manager A (entry X)
  mallory: "00000000-0000-0000-0000-0000000000d1", // no membership anywhere
};
const E1 = "11111111-1111-1111-1111-111111111111";
const E2 = "22222222-2222-2222-2222-222222222222";
const ENTRY_X = "33333333-3333-3333-3333-333333333333";
const ENTRY_Y = "44444444-4444-4444-4444-444444444444";

let db: PGlite;
let orgA: string;
let orgB: string;
const tpl: Record<string, string> = {};

async function run(role: "anon" | "authenticated" | "service_role", uid: string | null, sql: string, params: unknown[] = []) {
  await db.exec(`set role ${role}`);
  try {
    await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [uid ?? ""]);
    return (await db.query(sql, params)).rows as Record<string, any>[];
  } finally {
    await db.exec("reset role");
  }
}
const asUser = (uid: string, sql: string, p: unknown[] = []) => run("authenticated", uid, sql, p);
const asAnon = (sql: string, p: unknown[] = []) => run("anon", null, sql, p);
const svc = (sql: string, p: unknown[] = []) => run("service_role", null, sql, p);
const sup = async (sql: string, p: unknown[] = []) => (await db.query(sql, p)).rows as Record<string, any>[];

const hasPerm = async (user: string, perm: string, org: string, event: string | null = null, cat: string | null = null, entry: string | null = null) =>
  (await sup(`select private.user_has_perm($1,$2,$3,$4,$5,$6) as ok`, [user, perm, org, event, cat, entry]))[0].ok as boolean;

async function grant(actor: string, user: string, template: string, org: string, opts: { event?: string | null; entry?: string | null; grants?: string[]; denies?: string[] } = {}) {
  return (await svc(
    `select public.app_grant_role($1,$2,$3,$4,$5,null,$6,$7::text[],$8::text[]) as id`,
    [actor, user, tpl[template], org, opts.event ?? null, opts.entry ?? null, opts.grants ?? [], opts.denies ?? []],
  ))[0].id as string;
}

beforeAll(async () => {
  db = new PGlite({ extensions: { citext } });
  await db.exec(`
    create role anon nologin; create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}'::jsonb);
    create function auth.uid() returns uuid language sql stable
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema auth, public to anon, authenticated, service_role;
    grant execute on function auth.uid() to anon, authenticated, service_role;
  `);
  const dir = join(__dirname, "..", "migrations");
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(dir, f), "utf8"));
  }
  for (const [name, id] of Object.entries(U)) {
    await db.query(`insert into auth.users (id, email) values ($1, $2)`, [id, `${name}@example.com`]);
  }
  for (const t of await sup(`select id, key from public.role_templates where organization_id is null`)) tpl[t.key] = t.id;

  await svc(`select public.app_bootstrap_super_admin('root@example.com')`);

  // two applications, both approved by the super admin
  const apps: Record<string, string> = {};
  for (const [k, uid, name] of [["a", U.alice, "Org Alpha"], ["b", U.bob, "Org Beta"]] as const) {
    apps[k] = (await sup(
      `insert into public.organization_applications (applicant_user_id, applicant_name, applicant_email, org_name)
       values ($1, $2, $3, $4) returning id`,
      [uid, k, `${k}@example.com`, name],
    ))[0].id;
  }
  orgA = (await svc(`select public.app_approve_org_application($1,$2,'org-alpha') as id`, [apps.a, U.root]))[0].id;
  orgB = (await svc(`select public.app_approve_org_application($1,$2,'org-beta') as id`, [apps.b, U.root]))[0].id;
});

describe("organization application workflow", () => {
  it("only a super admin can approve; others are refused", async () => {
    const app = (await sup(
      `insert into public.organization_applications (applicant_user_id, applicant_name, applicant_email, org_name)
       values ($1,'m','m@example.com','Mallory Org') returning id`, [U.mallory]))[0].id;
    await expect(svc(`select public.app_approve_org_application($1,$2,'mallory-org')`, [app, U.alice])).rejects.toThrow(/NOT_AUTHORISED/);
    await expect(svc(`select public.app_approve_org_application($1,$2,'mallory-org')`, [app, U.mallory])).rejects.toThrow(/NOT_AUTHORISED/);
  });

  it("rejection requires a reason and is audited", async () => {
    const app = (await sup(`select id from public.organization_applications where applicant_user_id=$1`, [U.mallory]))[0].id;
    await expect(svc(`select public.app_reject_org_application($1,$2,'  ')`, [app, U.root])).rejects.toThrow(/REASON_REQUIRED/);
    await svc(`select public.app_reject_org_application($1,$2,'Incomplete documents')`, [app, U.root]);
    const log = await sup(`select reason from public.audit_logs where action='organization.reject'`);
    expect(log[0].reason).toBe("Incomplete documents");
  });

  it("rejects reserved and malformed slugs", async () => {
    const u = "00000000-0000-0000-0000-0000000000e1";
    await db.query(`insert into auth.users (id,email) values ($1,'x@example.com')`, [u]);
    const app = (await sup(
      `insert into public.organization_applications (applicant_user_id, applicant_name, applicant_email, org_name)
       values ($1,'x','x@example.com','Xorg') returning id`, [u]))[0].id;
    await expect(svc(`select public.app_approve_org_application($1,$2,'admin')`, [app, U.root])).rejects.toThrow(/RESERVED_SLUG/);
    await expect(svc(`select public.app_approve_org_application($1,$2,'Bad Slug!')`, [app, U.root])).rejects.toThrow(/INVALID_SLUG/);
  });

  it("approval creates owner membership and owner role", async () => {
    const m = await sup(`select is_owner from public.organization_members where organization_id=$1 and user_id=$2`, [orgA, U.alice]);
    expect(m[0].is_owner).toBe(true);
    expect(await hasPerm(U.alice, "event.settings.manage", orgA)).toBe(true);
    expect(await hasPerm(U.alice, "event.settings.manage", orgB)).toBe(false);
  });
});

describe("tenant isolation (cross-org read attempts)", () => {
  it("an owner sees only their own organization's members, assignments and audit rows", async () => {
    expect((await asUser(U.alice, `select distinct organization_id from public.organization_members`)).map((r) => r.organization_id)).toEqual([orgA]);
    expect((await asUser(U.alice, `select distinct organization_id from public.role_assignments`)).map((r) => r.organization_id)).toEqual([orgA]);
    const audit = await asUser(U.alice, `select distinct organization_id from public.audit_logs`);
    expect(audit.every((r) => r.organization_id === orgA)).toBe(true);
  });

  it("an owner cannot read another organization's invitations or applications", async () => {
    expect(await asUser(U.alice, `select 1 from public.organization_applications where applicant_user_id=$1`, [U.bob])).toHaveLength(0);
  });

  it("a user with no membership sees nothing private", async () => {
    expect(await asUser(U.mallory, `select 1 from public.organization_members`)).toHaveLength(0);
    expect(await asUser(U.mallory, `select 1 from public.role_assignments`)).toHaveLength(0);
    expect(await asUser(U.mallory, `select 1 from public.audit_logs`)).toHaveLength(0);
    expect((await asUser(U.mallory, `select slug from public.organizations order by slug`)).map((r) => r.slug)).toEqual(["org-alpha", "org-beta"]);
  });

  it("anon sees approved organizations but only public columns, and no profiles", async () => {
    expect(await asAnon(`select slug from public.organizations`)).toHaveLength(2);
    await expect(asAnon(`select contact_email from public.organizations`)).rejects.toThrow(/permission denied/);
    await expect(asAnon(`select * from public.profiles`)).rejects.toThrow(/permission denied/);
    await expect(asAnon(`select * from public.audit_logs`)).rejects.toThrow(/permission denied/);
  });

  it("membership never implies platform privileges", async () => {
    expect((await asUser(U.alice, `select private.is_platform() as p`))[0].p).toBe(false);
    expect((await asUser(U.root, `select private.is_platform('super_admin') as p`))[0].p).toBe(true);
    expect((await asUser(U.alice, `select * from public.platform_staff`))).toHaveLength(0);
  });
});

describe("client roles cannot write", () => {
  it("authenticated cannot insert/update/delete core tables", async () => {
    await expect(asUser(U.alice, `insert into public.organizations (slug,name,owner_user_id) values ('x-org','x',$1)`, [U.alice])).rejects.toThrow(/permission denied/);
    await expect(asUser(U.alice, `update public.organizations set finance_access_enabled=true`)).rejects.toThrow(/permission denied/);
    await expect(asUser(U.alice, `delete from public.role_assignments`)).rejects.toThrow(/permission denied/);
    await expect(asUser(U.alice, `insert into public.platform_staff (user_id, platform_role) values ($1,'super_admin')`, [U.alice])).rejects.toThrow(/permission denied/);
  });

  it("authenticated cannot call server-only RPCs", async () => {
    await expect(asUser(U.alice, `select public.app_grant_role($1,$2,$3,$4)`, [U.alice, U.carol, tpl.org_admin, orgA])).rejects.toThrow(/permission denied/);
    await expect(asUser(U.mallory, `select public.app_bootstrap_super_admin('mallory@example.com')`)).rejects.toThrow(/permission denied/);
  });

  it("invitation token hashes are not readable by clients", async () => {
    await expect(asUser(U.alice, `select token_hash from public.organization_invitations`)).rejects.toThrow(/permission denied/);
  });
});

describe("delegation and scoped permissions", () => {
  let adminAssignment: string;

  it("an org admin has no permissions until explicitly granted", async () => {
    adminAssignment = await grant(U.alice, U.carol, "org_admin", orgA);
    expect(await hasPerm(U.carol, "event.settings.manage", orgA)).toBe(false);
    expect(await hasPerm(U.carol, "organization.finance.view", orgA)).toBe(false);
  });

  it("cannot escalate: actor may not grant a permission they lack", async () => {
    await expect(grant(U.carol, U.dave, "event_manager", orgA, { event: E1 })).rejects.toThrow(/NOT_AUTHORISED_TO_DELEGATE/);
    // give carol delegation + one event permission only
    await svc(`insert into public.role_assignment_overrides values ($1,'organization.roles.delegate','grant'),($1,'event.settings.manage','grant')`, [adminAssignment]);
    await expect(grant(U.carol, U.dave, "event_manager", orgA, { event: E1 })).rejects.toThrow(/PRIVILEGE_ESCALATION/);
  });

  it("financial permissions can only be delegated by the owner", async () => {
    await svc(`insert into public.role_assignment_overrides values ($1,'organization.finance.view','grant') on conflict do nothing`, [adminAssignment]);
    await expect(grant(U.carol, U.dave, "org_admin", orgA, { grants: ["organization.finance.view"] })).rejects.toThrow(/FINANCIAL_PERMISSION_REQUIRES_OWNER|PRIVILEGE_ESCALATION/);
    await grant(U.alice, U.dave, "org_admin", orgA, { grants: ["organization.finance.view"] }); // owner may
  });

  it("the owner role cannot be granted or revoked through delegation", async () => {
    await expect(grant(U.alice, U.carol, "org_owner", orgA)).rejects.toThrow(/OWNER_ROLE_NOT_GRANTABLE/);
    const own = (await sup(`select ra.id from public.role_assignments ra join public.role_templates t on t.id=ra.role_template_id where t.key='org_owner' and ra.organization_id=$1`, [orgA]))[0].id;
    await expect(svc(`select public.app_revoke_role($1,$2,'x')`, [own, U.root])).rejects.toThrow(/OWNER_ROLE_NOT_REVOCABLE/);
  });

  it("event manager scope is limited to the assigned event", async () => {
    await grant(U.alice, U.dave, "event_manager", orgA, { event: E1 });
    expect(await hasPerm(U.dave, "event.contestants.manage", orgA, E1)).toBe(true);
    expect(await hasPerm(U.dave, "event.contestants.manage", orgA, E2)).toBe(false);
    expect(await hasPerm(U.dave, "event.contestants.manage", orgA, null)).toBe(false);
    expect(await hasPerm(U.dave, "event.contestants.manage", orgB, E1)).toBe(false);
    // financial / voting-control perms are not default for event managers
    expect(await hasPerm(U.dave, "event.voting.close", orgA, E1)).toBe(false);
  });

  it("contestant manager sees only the assigned entry", async () => {
    await grant(U.alice, U.erin, "contestant_manager", orgA, { event: E1, entry: ENTRY_X });
    expect(await hasPerm(U.erin, "entry.profile.edit", orgA, E1, null, ENTRY_X)).toBe(true);
    expect(await hasPerm(U.erin, "entry.profile.edit", orgA, E1, null, ENTRY_Y)).toBe(false);
    expect(await hasPerm(U.erin, "entry.profile.edit", orgA, E1, null, null)).toBe(false);
    expect(await hasPerm(U.erin, "event.contestants.manage", orgA, E1)).toBe(false);
  });

  it("deny overrides beat grants and template defaults", async () => {
    await svc(`insert into public.role_assignment_overrides
      select ra.id, 'event.contestants.manage', 'deny' from public.role_assignments ra
      join public.role_templates t on t.id=ra.role_template_id
      where ra.user_id=$1 and t.key='event_manager'`, [U.dave]);
    expect(await hasPerm(U.dave, "event.contestants.manage", orgA, E1)).toBe(false);
    expect(await hasPerm(U.dave, "event.settings.manage", orgA, E1)).toBe(true);
  });

  it("revoked and expired assignments grant nothing; revoke needs a reason and is audited", async () => {
    const id = (await sup(`select ra.id from public.role_assignments ra join public.role_templates t on t.id=ra.role_template_id where ra.user_id=$1 and t.key='contestant_manager'`, [U.erin]))[0].id;
    await expect(svc(`select public.app_revoke_role($1,$2,'')`, [id, U.alice])).rejects.toThrow(/REASON_REQUIRED/);
    await expect(svc(`select public.app_revoke_role($1,$2,'x')`, [id, U.mallory])).rejects.toThrow(/NOT_AUTHORISED/);
    await expect(svc(`select public.app_revoke_role($1,$2,'x')`, [id, U.bob])).rejects.toThrow(/NOT_AUTHORISED/); // other org's owner
    await svc(`select public.app_revoke_role($1,$2,'Left the team')`, [id, U.alice]);
    expect(await hasPerm(U.erin, "entry.profile.edit", orgA, E1, null, ENTRY_X)).toBe(false);
    expect((await sup(`select reason from public.audit_logs where action='role.revoke'`))[0].reason).toBe("Left the team");

    const j = "00000000-0000-0000-0000-0000000000f1";
    await db.query(`insert into auth.users (id,email) values ($1,'j@example.com')`, [j]);
    const jid = await grant(U.alice, j, "judge", orgA, { event: E1 });
    expect(await hasPerm(j, "judging.score.submit", orgA, E1)).toBe(true);
    await sup(`update public.role_assignments set expires_at = now() - interval '1 minute' where id=$1`, [jid]);
    expect(await hasPerm(j, "judging.score.submit", orgA, E1)).toBe(false);
  });

  it("a suspended organization loses all tenant permissions", async () => {
    await sup(`update public.organizations set status='suspended' where id=$1`, [orgB]);
    expect(await hasPerm(U.bob, "event.settings.manage", orgB)).toBe(false);
    await sup(`update public.organizations set status='approved' where id=$1`, [orgB]);
    expect(await hasPerm(U.bob, "event.settings.manage", orgB)).toBe(true);
  });
});

describe("invitations", () => {
  it("accept works for matching email, once, and checks the inviter's authority", async () => {
    const invitee = "00000000-0000-0000-0000-0000000000f2";
    await db.query(`insert into auth.users (id,email) values ($1,'Invitee@Example.com')`, [invitee]);
    await svc(`select public.app_create_invitation($1,$2,'invitee@example.com',$3,'hash-1')`, [U.alice, orgA, tpl.org_admin]);
    await expect(svc(`select public.app_accept_invitation('hash-1',$1)`, [U.mallory])).rejects.toThrow(/INVITATION_EMAIL_MISMATCH/);
    await svc(`select public.app_accept_invitation('hash-1',$1)`, [invitee]);
    await expect(svc(`select public.app_accept_invitation('hash-1',$1)`, [invitee])).rejects.toThrow(/INVITATION_NOT_USABLE/);
  });

  it("expired invitations cannot be accepted", async () => {
    const u = "00000000-0000-0000-0000-0000000000f3";
    await db.query(`insert into auth.users (id,email) values ($1,'late@example.com')`, [u]);
    await svc(`select public.app_create_invitation($1,$2,'late@example.com',$3,'hash-2',null,null,null,'{}','{}',false,interval '-1 minute')`, [U.alice, orgA, tpl.org_admin]);
    await expect(svc(`select public.app_accept_invitation('hash-2',$1)`, [u])).rejects.toThrow(/INVITATION_NOT_USABLE/);
  });

  it("a non-delegating user cannot create invitations", async () => {
    await expect(svc(`select public.app_create_invitation($1,$2,'z@example.com',$3,'hash-3')`, [U.mallory, orgA, tpl.org_admin])).rejects.toThrow(/NOT_AUTHORISED_TO_DELEGATE/);
  });
});

describe("audit log immutability", () => {
  it("cannot be updated, deleted or truncated, even by the service role or superuser", async () => {
    await expect(svc(`update public.audit_logs set action='x'`)).rejects.toThrow(/IMMUTABLE_TABLE|permission denied/);
    await expect(sup(`update public.audit_logs set action='x'`)).rejects.toThrow(/IMMUTABLE_TABLE/);
    await expect(sup(`delete from public.audit_logs`)).rejects.toThrow(/IMMUTABLE_TABLE/);
    await expect(sup(`truncate public.audit_logs`)).rejects.toThrow(/IMMUTABLE_TABLE/);
  });

  it("grants, approvals and revocations all produced audit rows", async () => {
    const actions = (await sup(`select distinct action from public.audit_logs`)).map((r) => r.action);
    for (const a of ["organization.approve", "organization.reject", "role.grant", "role.revoke", "platform.bootstrap_super_admin"]) {
      expect(actions).toContain(a);
    }
  });
});
