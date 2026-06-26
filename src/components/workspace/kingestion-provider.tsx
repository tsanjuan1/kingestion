"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

import type {
  AutomationTriggerResult,
  CaseAttachmentInput,
  CreateCaseInput,
  OwnerInput,
  RemoteControlResult,
  RemoteControlSource,
  WorkspaceSnapshot
} from "@/lib/kingston/contracts";
import {
  canAccessModule,
  canManageModule,
  getArchivedCases,
  getClosedCases,
  getDashboardSnapshot,
  getInitialSubstatus,
  getNextActionCopy,
  getOpenCases,
  getReportsSnapshot,
  hasReachedReimbursementTrigger,
  isReimbursementZone
} from "@/lib/kingston/helpers";
import type { ExternalStatus, KingstonCase, ModulePermissionKey, OwnerDirectoryEntry, UserInteractionLog } from "@/lib/kingston/types";

const THEME_STORAGE_KEY = "kingestion.theme.v1";
const AUTOMATION_HEARTBEAT_INTERVAL_MS = 15 * 60 * 1000;

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
  markReimbursementInProcess: (caseId: string) => Promise<boolean>;
  completeReimbursement: (caseId: string) => Promise<boolean>;
  requestReimbursementMissingData: (caseId: string) => Promise<boolean>;
  createOwner: (input: OwnerInput) => Promise<boolean>;
  updateOwner: (ownerId: string, input: OwnerInput) => Promise<boolean>;
  deleteOwner: (ownerId: string) => Promise<boolean>;
  assignCaseOwner: (caseId: string, ownerName: string) => Promise<boolean>;
  updateCaseStatus: (caseId: string, status: ExternalStatus) => Promise<boolean>;
  completeQueueStep: (
    caseId: string,
    options?: { nextStatus?: ExternalStatus; guideNumber?: string }
  ) => Promise<boolean>;
  archiveCase: (caseId: string) => Promise<boolean>;
  restoreCase: (caseId: string) => Promise<boolean>;
  deleteCase: (caseId: string) => Promise<boolean>;
  recordCaseView: (caseId: string) => Promise<void>;
  recordReportDownload: (reportName: string) => Promise<void>;
  runRemoteAction: (source?: RemoteControlSource) => Promise<RemoteControlResult>;
  canAccessModule: (moduleKey: ModulePermissionKey) => boolean;
  canManageModule: (moduleKey: ModulePermissionKey) => boolean;
  refreshWorkspace: () => Promise<void>;
};

const KingestionContext = createContext<KingestionContextValue | null>(null);

type MutationResponse = {
  snapshot: WorkspaceSnapshot;
  createdCaseId?: string;
};

type OptimisticMutationOptions = {
  optimisticUpdate?: (snapshot: WorkspaceSnapshot) => WorkspaceSnapshot;
};

async function parseErrorMessage(response: Response) {
  try {
    const payload = (await response.json()) as { message?: string };
    return payload.message ?? "No pude completar la accion.";
  } catch {
    return "No pude completar la accion.";
  }
}

function automationChangedWorkspace(result: Partial<AutomationTriggerResult> | null) {
  if (!result || result.paused) return false;

  return [
    result.processedMessages,
    result.createdCases,
    result.updatedCases,
    result.sentEmails,
    result.queuedEmails,
    result.reviewMessages
  ].some((value) => typeof value === "number" && value > 0);
}

function updateSnapshotCase(
  snapshot: WorkspaceSnapshot,
  caseId: string,
  updater: (entry: KingstonCase) => KingstonCase
): WorkspaceSnapshot {
  return {
    ...snapshot,
    cases: snapshot.cases.map((entry) => (entry.id === caseId ? updater(entry) : entry))
  };
}

function buildOptimisticStatusUpdate(
  caseId: string,
  status: ExternalStatus,
  options: { guideNumber?: string } = {}
) {
  return (snapshot: WorkspaceSnapshot) =>
    updateSnapshotCase(snapshot, caseId, (entry) => {
      const now = new Date().toISOString();
      const nextLogistics = {
        ...entry.logistics,
        guideNumber:
          options.guideNumber !== undefined
            ? options.guideNumber.trim() || null
            : entry.logistics.guideNumber,
        dispatchDate:
          status === "Producto enviado" && !entry.logistics.dispatchDate ? now : entry.logistics.dispatchDate,
        deliveredDate: status === "Realizado" && !entry.logistics.deliveredDate ? now : entry.logistics.deliveredDate,
        reimbursementState:
          entry.logistics.reimbursementState === "Completed" || entry.logistics.reimbursementState === "In process"
            ? entry.logistics.reimbursementState
            : isReimbursementZone(entry.zone) && hasReachedReimbursementTrigger(status, entry.zone)
              ? entry.attachments.some((attachment) => attachment.kind === "proof" || attachment.kind === "photo")
                ? "Requested"
                : "Pending"
              : entry.logistics.reimbursementState
      };

      return {
        ...entry,
        externalStatus: status,
        internalSubstatus: getInitialSubstatus(status, entry.zone),
        nextAction: getNextActionCopy(status),
        updatedAt: now,
        logistics: nextLogistics
      };
    });
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

  useEffect(() => {
    let cancelled = false;

    const runHeartbeat = async () => {
      try {
        const response = await fetch("/api/automation/heartbeat/kingston-rma", {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({})
        });

        if (!response.ok) return;

        const result = (await response.json().catch(() => null)) as Partial<AutomationTriggerResult> | null;
        if (!automationChangedWorkspace(result)) return;

        const workspaceResponse = await fetch("/api/workspace", {
          credentials: "include",
          cache: "no-store"
        });

        if (!workspaceResponse.ok || cancelled) return;
        const nextSnapshot = (await workspaceResponse.json()) as WorkspaceSnapshot;
        if (!cancelled) {
          setWorkspaceSnapshot(nextSnapshot);
        }
      } catch {
        // El heartbeat no debe interrumpir el uso normal de la plataforma.
      }
    };

    void runHeartbeat();
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void runHeartbeat();
      }
    }, AUTOMATION_HEARTBEAT_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

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

  const runMutation = async (payload: object, options: OptimisticMutationOptions = {}) => {
    let previousSnapshot: WorkspaceSnapshot | null = null;

    if (options.optimisticUpdate) {
      setWorkspaceSnapshot((currentSnapshot) => {
        previousSnapshot = currentSnapshot;
        return options.optimisticUpdate ? options.optimisticUpdate(currentSnapshot) : currentSnapshot;
      });
    }

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
    } catch (error) {
      if (previousSnapshot) {
        setWorkspaceSnapshot(previousSnapshot);
      }
      throw error;
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
      await runMutation(
        { type: "completeReimbursement", caseId },
        {
          optimisticUpdate: (snapshot) =>
            updateSnapshotCase(snapshot, caseId, (entry) => ({
              ...entry,
              updatedAt: new Date().toISOString(),
              logistics: {
                ...entry.logistics,
                reimbursementState: "Completed"
              }
            }))
        }
      );
      return true;
    } catch {
      return false;
    }
  };

  const markReimbursementInProcess = async (caseId: string) => {
    try {
      await runMutation(
        { type: "markReimbursementInProcess", caseId },
        {
          optimisticUpdate: (snapshot) =>
            updateSnapshotCase(snapshot, caseId, (entry) => ({
              ...entry,
              updatedAt: new Date().toISOString(),
              logistics: {
                ...entry.logistics,
                reimbursementState: "In process"
              }
            }))
        }
      );
      return true;
    } catch {
      return false;
    }
  };

  const requestReimbursementMissingData = async (caseId: string) => {
    try {
      await runMutation({ type: "requestReimbursementMissingData", caseId });
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
      await runMutation(
        { type: "updateCaseStatus", caseId, status },
        {
          optimisticUpdate: buildOptimisticStatusUpdate(caseId, status)
        }
      );
      return true;
    } catch {
      return false;
    }
  };

  const completeQueueStep = async (
    caseId: string,
    options?: { nextStatus?: ExternalStatus; guideNumber?: string }
  ) => {
    try {
      await runMutation(
        { type: "completeQueueStep", caseId, ...options },
        options?.nextStatus
          ? {
              optimisticUpdate: buildOptimisticStatusUpdate(caseId, options.nextStatus, {
                guideNumber: options.guideNumber
              })
            }
          : {}
      );
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

  const runRemoteAction = async (source: RemoteControlSource = "web-button") => {
    const response = await fetch("/api/remote-control/run", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        action: "diagnostico",
        source
      })
    });

    if (!response.ok) {
      const message = await parseErrorMessage(response);
      throw new Error(message);
    }

    const result = (await response.json()) as RemoteControlResult;
    await refreshWorkspace();
    return result;
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
      markReimbursementInProcess,
      completeReimbursement,
      requestReimbursementMissingData,
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
      runRemoteAction,
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
