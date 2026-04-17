import { KingestionProvider } from "@/components/workspace/kingestion-provider";
import { WorkspaceShell } from "@/components/workspace/workspace-shell";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <KingestionProvider>
      <WorkspaceShell>{children}</WorkspaceShell>
    </KingestionProvider>
  );
}
