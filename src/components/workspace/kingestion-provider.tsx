"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import type { CaseAttachmentInput, CreateCaseInput, OwnerInput, WorkspaceSnapshot } from "@/lib/kingston/contracts";
import {
  canAccessModule,
  canManageModule,
  getArchivedCases,
  getClosedCases,
  getDashboardSnapshot,
  getOpenCases,
  getReportsSnapshot
} from "@/lib/kingston/helpers";
import type { ExternalStatus, KingstonCase, ModulePermissionKey, OwnerDirectoryEntry, UserInteractionLog } from "@/lib/kingston/types";

const THEME_STORAGE_KEY = "kingestion.theme.v1";

export type ThemeMode = "light" | "dark";

type KingestionContextValue = WorkspaceSnapshot & {
  activeOwner: OwnerDirectoryEntry;
  openCases: KingstonCase[];
  closedCases: KingstonCase[];
  archivedCases: KingstonCase[];
  activeOwners: OwnerDirectoryEntry[];
  themeMode: ThemeMode;
  isMutating: boolean;
  canManageReimbursements: boolean;
  canDeleteCases: boolean;
  canArchiveCases: boolean;
  dashboardSnapshot: ReturnType<typeof getDashboardSnapshot>;
  reportsSnapshot: ReturnType<typeof getReportsSnapshot>;
  findCaseById: (caseId: string) => KingstonCase | undefined;
  setThemeMode: (themeMode: ThemeMode) => void;
  createCase: (input: CreateCaseInput) => Promise<string>;
  addCaseAttachment: (caseId: string, input: CaseAttachmentInput) => Promise<boolean>;
  removeCaseAttachment: (caseId: string, attachmentId: string) => Promise<boolean>;
  updateReplacementSku: (caseId: string, replacementSku: string) => Promise<boolean>;
  completeReimbursement: (caseId: string) => Promise<boolean>;
  createOwner: (input: OwnerInput) => Promise<boolean>;
  updateOwner: (ownerId: string, input: OwnerInput) => Promise<boolean>;
  deleteOwner: (ownerId: string) => Promise<boolean>;
  assignCaseOwner: (caseId: string, ownerName: string) => Promise<boolean>;
  updateCaseStatus: (caseId: string, status: ExternalStatus) => Promise<boolean>;
  completeQueueStep: (caseId: string) => Promise<boolean>;
  archiveCase: (caseId: string) => Promise<boolean>;
  restoreCase: (caseId: string) => Promise<boolean>;
  deleteCase: (caseId: string) => Promise<boolean>;
  recordCaseView: (caseId: string) => Promise<void>;
  recordReportDownload: (reportName: string) => Promise<void>;
  canAccessModule: (moduleKey: ModulePermissionKey) => boolean;
  canManageModule: (moduleKey: ModulePermissionKey) => boolean;
  refreshWorkspace: () => Promise<void>;
};

const KingestionContext = createContext<KingestionContextValue | null>(null);

type MutationResponse = {
  snapshot: WorkspaceSnapshot;
  createdCaseId?: string;
};

async function parseErrorMessage(response: Response) {
  try {
    const payload = (await response.json()) as { message?: string };
    return payload.message ?? "No pude completar la accion.";
  } catch {
    return "No pude completar la accion.";
  }
}

export function KingestionProvider({
  children,
  initialSnapshot
}: {
  children: React.ReactNode;
  initialSnapshot: WorkspaceSnapshot;
}) {
  const [workspaceSnapshot, setWorkspaceSnapshot] = useState<WorkspaceSnapshot>(initialSnapshot);
  const [themeMode, setThemeModeState] = useState<ThemeMode>("light");
  const [isThemeHydrated, setIsThemeHydrated] = useState(false);
  const [isMutating, setIsMutating] = useState(false);

  useEffect(() => {
    try {
      const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
      setThemeModeState(savedTheme === "dark" ? "dark" : "light");
    } finally {
      setIsThemeHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isThemeHydrated) return;
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [isThemeHydrated, themeMode]);

  useEffect(() => {
    document.documentElement.dataset.theme = themeMode;
  }, [themeMode]);

  const refreshWorkspace = async () => {
    const response = await fetch("/api/workspace", {
      credentials: "include",
      cache: "no-store"
    });

    if (!response.ok) {
      const message = await parseErrorMessage(response);
      throw new Error(message);
    }

    const nextSnapshot = (await response.json()) as WorkspaceSnapshot;
    setWorkspaceSnapshot(nextSnapshot);
  };

  const runMutation = async (payload: object) => {
    setIsMutating(true);

    try {
      const response = await fetch("/api/workspace/mutate", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const message = await parseErrorMessage(response);
        throw new Error(message);
      }

      const result = (await response.json()) as MutationResponse;
      setWorkspaceSnapshot(result.snapshot);
      return result;
    } finally {
      setIsMutating(false);
    }
  };

  const openCases = useMemo(() => getOpenCases(workspaceSnapshot.cases), [workspaceSnapshot.cases]);
  const closedCases = useMemo(() => getClosedCases(workspaceSnapshot.cases), [workspaceSnapshot.cases]);
  const archivedCases = useMemo(() => getArchivedCases(workspaceSnapshot.cases), [workspaceSnapshot.cases]);
  const activeOwners = useMemo(
    () => workspaceSnapshot.owners.filter((owner) => owner.active),
    [workspaceSnapshot.owners]
  );
  const activeOwner = workspaceSnapshot.currentUser;
  const dashboardSnapshot = useMemo(
    () => getDashboardSnapshot(workspaceSnapshot.cases, workspaceSnapshot.owners),
    [workspaceSnapshot.cases, workspaceSnapshot.owners]
  );
  const reportsSnapshot = useMemo(
    () => getReportsSnapshot(workspaceSnapshot.cases, workspaceSnapshot.owners),
    [workspaceSnapshot.cases, workspaceSnapshot.owners]
  );
  const canManageReimbursements = useMemo(
    () =>
      activeOwner.team === "ADMIN" ||
      activeOwner.team === "PURCHASING" ||
      activeOwner.team === "PAYMENTS" ||
      canManageModule(activeOwner.permissions, "reimbursements"),
    [activeOwner]
  );
  const canDeleteCases = activeOwner.team === "ADMIN";
  const canArchiveCases = activeOwner.team === "ADMIN";

  const findCaseById = (caseId: string) => workspaceSnapshot.cases.find((entry) => entry.id === caseId);

  const setThemeMode = (nextThemeMode: ThemeMode) => {
    setThemeModeState(nextThemeMode);
  };

  const createCase = async (input: CreateCaseInput) => {
    const result = await runMutation({ type: "createCase", input });
    return result.createdCaseId ?? "";
  };

  const addCaseAttachment = async (caseId: string, input: CaseAttachmentInput) => {
    try {
      await runMutation({ type: "addCaseAttachment", caseId, input });
      return true;
    } catch {
      return false;
    }
  };

  const removeCaseAttachment = async (caseId: string, attachmentId: string) => {
    try {
      await runMutation({ type: "removeCaseAttachment", caseId, attachmentId });
      return true;
    } catch {
      return false;
    }
  };

  const updateReplacementSku = async (caseId: string, replacementSku: string) => {
    try {
      await runMutation({ type: "updateReplacementSku", caseId, replacementSku });
      return true;
    } catch {
      return false;
    }
  };

  const completeReimbursement = async (caseId: string) => {
    try {
      await runMutation({ type: "completeReimbursement", caseId });
      return true;
    } catch {
      return false;
    }
  };

  const createOwner = async (input: OwnerInput) => {
    try {
      await runMutation({ type: "createUser", input });
      return true;
    } catch {
      return false;
    }
  };

  const updateOwner = async (ownerId: string, input: OwnerInput) => {
    try {
      await runMutation({ type: "updateUser", userId: ownerId, input });
      return true;
    } catch {
      return false;
    }
  };

  const deleteOwner = async (ownerId: string) => {
    try {
      await runMutation({ type: "deleteUser", userId: ownerId });
      return true;
    } catch {
      return false;
    }
  };

  const assignCaseOwner = async (caseId: string, ownerName: string) => {
    try {
      await runMutation({ type: "assignCaseOwner", caseId, ownerName });
      return true;
    } catch {
      return false;
    }
  };

  const updateCaseStatus = async (caseId: string, status: ExternalStatus) => {
    try {
      await runMutation({ type: "updateCaseStatus", caseId, status });
      return true;
    } catch {
      return false;
    }
  };

  const completeQueueStep = async (caseId: string) => {
    try {
      await runMutation({ type: "completeQueueStep", caseId });
      return true;
    } catch {
      return false;
    }
  };

  const archiveCase = async (caseId: string) => {
    try {
      await runMutation({ type: "archiveCase", caseId });
      return true;
    } catch {
      return false;
    }
  };

  const restoreCase = async (caseId: string) => {
    try {
      await runMutation({ type: "restoreCase", caseId });
      return true;
    } catch {
      return false;
    }
  };

  const deleteCase = async (caseId: string) => {
    try {
      await runMutation({ type: "deleteCase", caseId });
      return true;
    } catch {
      return false;
    }
  };

  const recordCaseView = async (caseId: string) => {
    try {
      await runMutation({ type: "recordCaseView", caseId });
    } catch {
      // no-op
    }
  };

  const recordReportDownload = async (reportName: string) => {
    try {
      await runMutation({ type: "recordReportDownload", reportName });
    } catch {
      // no-op
    }
  };

  const value = useMemo<KingestionContextValue>(
    () => ({
      ...workspaceSnapshot,
      activeOwner,
      openCases,
      closedCases,
      archivedCases,
      activeOwners,
      themeMode,
      isMutating,
      canManageReimbursements,
      canDeleteCases,
      canArchiveCases,
      dashboardSnapshot,
      reportsSnapshot,
      findCaseById,
      setThemeMode,
      createCase,
      addCaseAttachment,
      removeCaseAttachment,
      updateReplacementSku,
      completeReimbursement,
      createOwner,
      updateOwner,
      deleteOwner,
      assignCaseOwner,
      updateCaseStatus,
      completeQueueStep,
      archiveCase,
      restoreCase,
      deleteCase,
      recordCaseView,
      recordReportDownload,
      canAccessModule: (moduleKey: ModulePermissionKey) =>
        activeOwner.team === "ADMIN" || canAccessModule(activeOwner.permissions, moduleKey),
      canManageModule: (moduleKey: ModulePermissionKey) =>
        activeOwner.team === "ADMIN" || canManageModule(activeOwner.permissions, moduleKey),
      refreshWorkspace
    }),
    [
      workspaceSnapshot,
      activeOwner,
      openCases,
      closedCases,
      archivedCases,
      activeOwners,
      themeMode,
      isMutating,
      canManageReimbursements,
      canDeleteCases,
      canArchiveCases,
      dashboardSnapshot,
      reportsSnapshot
    ]
  );

  return <KingestionContext.Provider value={value}>{children}</KingestionContext.Provider>;
}

export function useKingestion() {
  const context = useContext(KingestionContext);

  if (!context) {
    throw new Error("useKingestion debe usarse dentro de KingestionProvider.");
  }

  return context;
}
