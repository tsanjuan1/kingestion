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
