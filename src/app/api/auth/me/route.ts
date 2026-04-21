import { NextResponse } from "next/server";

import { getAuthSessionUser, hasBootstrapUser } from "@/lib/kingston/server";

export async function GET() {
  const [currentUser, bootstrapReady] = await Promise.all([getAuthSessionUser(), hasBootstrapUser()]);

  return NextResponse.json({
    authenticated: Boolean(currentUser),
    needsBootstrap: !bootstrapReady,
    user: currentUser
  });
}
