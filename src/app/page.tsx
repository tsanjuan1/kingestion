import { redirect } from "next/navigation";

import { getAuthSessionUser } from "@/lib/kingston/server";

export default async function HomePage() {
  const user = await getAuthSessionUser();
  redirect(user ? "/dashboard" : "/login");
}
