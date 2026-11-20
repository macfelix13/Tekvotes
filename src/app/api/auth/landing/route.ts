import { NextResponse } from "next/server";
import { getCurrentUser, getUserAccess } from "@/lib/auth";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ redirectTo: "/auth/login" }, { status: 401 });
  }
  const access = await getUserAccess(user.id);
  return NextResponse.json({
    redirectTo: access.isSuperAdmin ? "/admin" : "/org",
    isSuperAdmin: access.isSuperAdmin,
    hasActiveOrg: access.organizations.some((o) => o.status === "approved"),
  });
}
