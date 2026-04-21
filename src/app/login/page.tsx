import { redirect } from "next/navigation";

import { LoginPanel } from "@/components/workspace/login-panel";
import { getAuthSessionUser, hasBootstrapUser } from "@/lib/kingston/server";

export default async function LoginPage({
  searchParams
}: {
  searchParams?: Promise<{ blocked?: string }>;
}) {
  const currentUser = await getAuthSessionUser();

  if (currentUser) {
    redirect("/dashboard");
  }

  const bootstrapReady = await hasBootstrapUser();
  const params = searchParams ? await searchParams : undefined;

  return <LoginPanel needsBootstrap={!bootstrapReady} blocked={params?.blocked === "1"} />;
}
