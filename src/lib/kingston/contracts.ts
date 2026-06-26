import type {
  CaseAttachment,
  CasePriority,
  ClientBankingDetails,
  DeliveryMode,
  ExternalStatus,
  KingstonCase,
  ModulePermissions,
  OwnerDirectoryEntry,
  UserInteractionLog,
  Zone
} from "@/lib/kingston/types";

export type CaseAttachmentInput = {
  name: string;
  kind?: CaseAttachment["kind"];
  sizeLabel: string;
  mimeType?: string;
  previewUrl?: string;
};

export type CreateCaseInput = {
  kingstonNumber: string;
  clientName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  owner: string;
  externalStatus: ExternalStatus;
  zone: Zone;
  deliveryMode: DeliveryMode;
  priority: CasePriority;
  address: string;
  province: string;
  city: string;
  sku: string;
  replacementSku?: string;
  quantity: number;
  productDescription: string;
  failureDescription: string;
  nextAction: string;
  observations: string;
  origin: KingstonCase["origin"];
  banking?: Partial<ClientBankingDetails>;
  attachments?: CaseAttachmentInput[];
};

export type OwnerInput = {
  name: string;
  email: string;
  team: OwnerDirectoryEntry["team"];
  active: boolean;
  permissions: ModulePermissions;
  password?: string;
};

export type WorkspaceSnapshot = {
  cases: KingstonCase[];
  auditLog: UserInteractionLog[];
  owners: OwnerDirectoryEntry[];
  currentUser: OwnerDirectoryEntry;
};

export type AutomationControlState = {
  paused: boolean;
  pausedAt: string | null;
  pausedByUserId: string | null;
  pausedByUserName: string | null;
};

export type AutomationCloudStatus = {
  control: AutomationControlState;
  cloudOnly: boolean;
  pilotMode: boolean;
  manualTriggerConfigured: boolean;
  proofAttachmentAiEnabled: boolean;
  statusNotificationsEnabled: boolean;
  ingestionCadence: "hourly";
  targetPlatform: "Kingestion";
  lastCaseActivityAt: string | null;
  lastAutomationAuditAt: string | null;
  lastRunAt?: string | null;
  processedMailCount?: number;
};

export type AutomationTriggerResult = {
  ok: boolean;
  queued: boolean;
  paused: boolean;
  triggeredAt: string;
  mode: "pilot" | "production";
  target: "Kingestion";
  message: string;
  upstreamStatus?: number;
  upstreamMessage?: string | null;
  processedMessages?: number;
  createdCases?: number;
  updatedCases?: number;
  sentEmails?: number;
  queuedEmails?: number;
  aiInterpretedMessages?: number;
  reviewMessages?: number;
  skippedMessages?: number;
  errors?: string[];
};

export type RemoteControlAction = "diagnostico";

export type RemoteControlSource = "web-button" | "api";

export type RemoteControlSummary = {
  openCases: number;
  closedCases: number;
  archivedCases: number;
  pendingReimbursements: number;
  pendingPurchases: number;
  pendingService: number;
  activeUsers: number;
  serverTime: string;
};

export type RemoteControlResult = {
  runId: string;
  action: RemoteControlAction;
  source: RemoteControlSource;
  actorName: string;
  executedAt: string;
  message: string;
  summary: RemoteControlSummary;
};
