import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export interface OrgMembership {
  id: string;
  slug: string;
  name: string;
  status: string;
  defaultCurrency: string;
  isOwner: boolean;
}

export interface UserAccess {
  isSuperAdmin: boolean;
  platformRoles: string[];
  organizations: OrgMembership[];
}

export async function getCurrentUser(): Promise<User | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ?? null;
}

export async function getUserAccess(userId: string): Promise<UserAccess> {
  const admin = createAdminClient();

  const [{ data: staffRows }, { data: memberRows }] = await Promise.all([
    admin
      .from("platform_staff")
      .select("platform_role")
      .eq("user_id", userId)
      .is("revoked_at", null),
    admin
      .from("organization_members")
      .select("is_owner, organizations(id, slug, name, status, default_currency)")
      .eq("user_id", userId)
      .eq("status", "active"),
  ]);

  const platformRoles = (staffRows ?? []).map((r) => String(r.platform_role));
  const isSuperAdmin = platformRoles.includes("super_admin");

  type OrgRow = {
    id: string;
    slug: string;
    name: string;
    status: string;
    default_currency: string;
  };

  const organizations: OrgMembership[] = [];
  for (const row of memberRows ?? []) {
    const raw = row.organizations as OrgRow | OrgRow[] | null;
    const org = Array.isArray(raw) ? raw[0] : raw;
    if (!org) continue;
    organizations.push({
      id: org.id,
      slug: org.slug,
      name: org.name,
      status: org.status,
      defaultCurrency: org.default_currency,
      isOwner: Boolean(row.is_owner),
    });
  }

  return { isSuperAdmin, platformRoles, organizations };
}

export async function requireSuperAdminPage(): Promise<{
  user: User;
  access: UserAccess;
  authorized: boolean;
}> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth/login?redirectTo=/admin");
  }
  const access = await getUserAccess(user.id);
  return { user, access, authorized: access.isSuperAdmin };
}

export async function requireOrgPage(requestedOrgId?: string): Promise<{
  user: User;
  access: UserAccess;
  activeOrg: OrgMembership | null;
  availableOrgs: OrgMembership[];
}> {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/auth/login?redirectTo=/org");
  }
  const access = await getUserAccess(user.id);
  let availableOrgs = access.organizations;

  if (access.isSuperAdmin) {
    const admin = createAdminClient();
    const { data: allApproved } = await admin
      .from("organizations")
      .select("id, slug, name, status, default_currency")
      .eq("status", "approved")
      .order("created_at", { ascending: true });

    if (allApproved && allApproved.length > 0) {
      availableOrgs = allApproved.map((o) => ({
        id: o.id as string,
        slug: o.slug as string,
        name: o.name as string,
        status: o.status as string,
        defaultCurrency: o.default_currency as string,
        isOwner: true,
      }));
    }
  }

  const activeOrg =
    (requestedOrgId ? availableOrgs.find((o) => o.id === requestedOrgId) : null) ??
    availableOrgs[0] ??
    null;

  return { user, access, activeOrg, availableOrgs };
}

export async function requireApiSuperAdmin(): Promise<
  | { ok: true; user: User; access: UserAccess }
  | { ok: false; response: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "UNAUTHENTICATED", message: "Sign in required." }, { status: 401 }),
    };
  }
  const access = await getUserAccess(user.id);
  if (!access.isSuperAdmin) {
    return {
      ok: false,
      response: NextResponse.json({ error: "FORBIDDEN", message: "Super Admin permission required." }, { status: 403 }),
    };
  }
  return { ok: true, user, access };
}

export async function requireApiOrgMember(organizationId: string): Promise<
  | { ok: true; user: User; access: UserAccess }
  | { ok: false; response: NextResponse }
> {
  const user = await getCurrentUser();
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "UNAUTHENTICATED", message: "Sign in required." }, { status: 401 }),
    };
  }
  const access = await getUserAccess(user.id);
  const isMember = access.organizations.some((o) => o.id === organizationId && o.status === "approved");
  if (!access.isSuperAdmin && !isMember) {
    return {
      ok: false,
      response: NextResponse.json({ error: "FORBIDDEN", message: "Organization access required." }, { status: 403 }),
    };
  }
  return { ok: true, user, access };
}
