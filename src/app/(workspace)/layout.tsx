import { KingestionProvider } from "@/components/workspace/kingestion-provider";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";
import { getWorkspaceSnapshot, requireSessionUser } from "@/lib/kingston/server";

export const dynamic = "force-dynamic";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const currentUser = await requireSessionUser();
  const initialSnapshot = await getWorkspaceSnapshot(currentUser.id);

  return (
    <KingestionProvider initialSnapshot={initialSnapshot}>
      <WorkspaceShell>{children}</WorkspaceShell>
    </KingestionProvider>
  );
}
