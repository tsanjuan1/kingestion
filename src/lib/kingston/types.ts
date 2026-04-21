export type Zone = "Interior / Gran Buenos Aires" | "Capital / AMBA";

export type DeliveryMode = "Dispatch" | "Pickup";

export type CasePriority = "Low" | "Medium" | "High" | "Critical";

export type TaskState = "Pending" | "In progress" | "Completed" | "Blocked";

export type EventKind =
  | "status-change"
  | "task"
  | "logistics"
  | "procurement"
  | "comment"
  | "attachment";

export type ExternalStatus =
  | "Informado"
  | "Aviso de envio"
  | "Producto recepcionado y en preparacion"
  | "Pedido deposito y etiquetado"
  | "Pedido Kingston"
  | "Liberar mercaderia"
  | "OV creada"
  | "Pedido guia"
  | "Producto enviado"
  | "Producto listo para retiro"
  | "Realizado"
  | "Vencido"
  | "Cerrado";

export type WorkflowCategory = "service" | "purchasing" | "delivery" | "terminal";

export type WorkflowState = {
  status: ExternalStatus;
  category: WorkflowCategory;
  order: number;
  description: string;
  zones: Zone[];
  substatuses: string[];
};

export type TransitionRule = {
  from: ExternalStatus;
  to: ExternalStatus;
  zones: Zone[];
  requiredFields: string[];
  autoTasks: string[];
  note: string;
};

export type CaseTask = {
  id: string;
  title: string;
  description: string;
  type: "validation" | "stock" | "logistics" | "follow-up" | "communication";
  assignee: string;
  priority: CasePriority;
  dueAt: string;
  state: TaskState;
};

export type CaseComment = {
  id: string;
  author: string;
  body: string;
  internal: boolean;
  createdAt: string;
};

export type CaseAttachment = {
  id: string;
  name: string;
  kind: "mail" | "photo" | "proof" | "guide" | "form";
  sizeLabel: string;
  uploadedBy: string;
  createdAt: string;
  mimeType?: string;
  previewUrl?: string;
};

export type ClientBankingDetails = {
  bankName: string;
  accountHolder: string;
  cuit: string;
  cbu: string;
  alias: string;
  accountNumber: string;
};

export type CaseEvent = {
  id: string;
  kind: EventKind;
  title: string;
  detail: string;
  actor: string;
  createdAt: string;
};

export type ReimbursementState = "Pending" | "Not applicable" | "Requested" | "Completed";

export type CaseLogistics = {
  mode: DeliveryMode;
  address: string;
  transporter: string | null;
  guideNumber: string | null;
  trackingUrl: string | null;
  dispatchDate: string | null;
  deliveredDate: string | null;
  shippingCost: string | null;
  reimbursementState: ReimbursementState;
};

export type CaseProcurement = {
  localStock: "Available" | "Unavailable" | "Pending";
  wholesalerStock: "Available" | "Unavailable" | "Pending";
  wholesalerName: string | null;
  requiresKingstonOrder: boolean;
  kingstonRequestedAt: string | null;
  receivedFromUsaAt: string | null;
  releasedByPurchasing: boolean;
  releasedAt: string | null;
  movedToRmaWarehouse: boolean;
  movedToRmaWarehouseAt: string | null;
};

export type KingstonCase = {
  id: string;
  internalNumber: string;
  kingstonNumber: string;
  clientName: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  zone: Zone;
  deliveryMode: DeliveryMode;
  priority: CasePriority;
  owner: string;
  nextAction: string;
  externalStatus: ExternalStatus;
  internalSubstatus: string;
  openedAt: string;
  updatedAt: string;
  slaDueAt: string;
  address: string;
  province: string;
  city: string;
  sku: string;
  replacementSku?: string | null;
  productDescription: string;
  quantity: number;
  failureDescription: string;
  origin: "Kingston email" | "Operations load" | "Commercial handoff";
  observations: string;
  banking?: ClientBankingDetails;
  logistics: CaseLogistics;
  procurement: CaseProcurement;
  tasks: CaseTask[];
  comments: CaseComment[];
  attachments: CaseAttachment[];
  events: CaseEvent[];
};

export type UserRole = "ADMIN" | "SALES" | "TECHNICAL_SERVICE" | "PURCHASING" | "PAYMENTS";

export type ModulePermissionKey =
  | "summary"
  | "open-cases"
  | "reimbursements"
  | "pending-purchases"
  | "pending-service"
  | "closed-cases"
  | "reports"
  | "settings";

export type ModulePermission = {
  view: boolean;
  manage: boolean;
};

export type ModulePermissions = Record<ModulePermissionKey, ModulePermission>;

export type OwnerDirectoryEntry = {
  id: string;
  name: string;
  team: UserRole;
  initials: string;
  email: string;
  active: boolean;
  permissions: ModulePermissions;
};

export type InteractionEntityType = "case" | "owner" | "session" | "report" | "user";

export type UserInteractionLog = {
  id: string;
  actorId: string | null;
  actorName: string;
  entityType: InteractionEntityType;
  entityId: string;
  action: string;
  detail: string;
  createdAt: string;
};

export type WorkspaceDataState = {
  cases: KingstonCase[];
  auditLog: UserInteractionLog[];
};
