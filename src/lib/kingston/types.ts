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
  | "Pedido etiqueta"
  | "Pedido deposito"
  | "Pedido a Kingston"
  | "Producto enviado"
  | "Producto listo para retiro"
  | "Realizado"
  | "Cerrado";

export type WorkflowCategory = "active" | "delivery" | "terminal";

export type WorkflowState = {
  status: ExternalStatus;
  category: WorkflowCategory;
  order: number;
  description: string;
  substatuses: string[];
};

export type TransitionRule = {
  from: ExternalStatus;
  to: ExternalStatus;
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

export type CaseLogistics = {
  mode: DeliveryMode;
  address: string;
  transporter: string | null;
  guideNumber: string | null;
  trackingUrl: string | null;
  dispatchDate: string | null;
  deliveredDate: string | null;
  shippingCost: string | null;
  reimbursementState: "Pending" | "Not applicable" | "Requested" | "Completed";
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

export type OwnerDirectoryEntry = {
  id: string;
  name: string;
  team: "Operations" | "Logistics" | "Purchasing" | "Warehouse" | "Management";
  initials: string;
  email: string;
  active: boolean;
};

export type InteractionEntityType = "case" | "owner" | "session" | "report";

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
