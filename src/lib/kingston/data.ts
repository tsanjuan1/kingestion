import type { KingstonCase, OwnerDirectoryEntry, TransitionRule, WorkflowState } from "@/lib/kingston/types";

export const referenceNow = "2026-04-17T10:00:00-03:00";

export const ownerDirectory: OwnerDirectoryEntry[] = [
  { id: "owner-lucia-costa", name: "Lucia Costa", team: "Operations", initials: "LC", email: "lucia.costa@anyx.com.ar", active: true },
  { id: "owner-martin-ponce", name: "Martin Ponce", team: "Logistics", initials: "MP", email: "martin.ponce@anyx.com.ar", active: true },
  { id: "owner-camila-rios", name: "Camila Rios", team: "Purchasing", initials: "CR", email: "camila.rios@anyx.com.ar", active: true },
  { id: "owner-ivan-sosa", name: "Ivan Sosa", team: "Warehouse", initials: "IS", email: "ivan.sosa@anyx.com.ar", active: true },
  { id: "owner-sofia-mendez", name: "Sofia Mendez", team: "Management", initials: "SM", email: "sofia.mendez@anyx.com.ar", active: true }
];

export const workflowStates: WorkflowState[] = [
  {
    status: "Informado",
    category: "active",
    order: 1,
    description: "El caso ingreso desde Kingston y todavia esta en la etapa de validacion inicial.",
    substatuses: [
      "Caso recibido de Kingston",
      "Mail de confirmacion al remitente enviado",
      "Mail al end user enviado",
      "Caso creado en sistema",
      "Pendiente clasificacion de zona",
      "Pendiente validacion stock local"
    ]
  },
  {
    status: "Aviso de envio",
    category: "active",
    order: 2,
    description: "El cliente recibio instrucciones y el equipo espera la evidencia del envio o la recepcion fisica.",
    substatuses: [
      "Instrucciones enviadas al cliente",
      "Formulario web pendiente",
      "Comprobante de envio pendiente",
      "Producto en transito a ANYX",
      "Producto recibido pendiente de registrar"
    ]
  },
  {
    status: "Producto recepcionado y en preparacion",
    category: "active",
    order: 3,
    description: "ANYX ya recibio el producto fallado y esta definiendo disponibilidad y via de resolucion.",
    substatuses: [
      "Producto fallado recibido",
      "Pendiente chequeo stock local",
      "Stock local disponible",
      "Sin stock local",
      "Pendiente consulta a mayoristas",
      "Mayorista disponible",
      "Sin disponibilidad mayorista"
    ]
  },
  {
    status: "Pedido etiqueta",
    category: "delivery",
    order: 4,
    description: "El caso esta en preparacion interna para salida o retiro, con foco en catalogacion y etiquetado.",
    substatuses: [
      "Pendiente catalogacion RMA",
      "Catalogado por tecnico",
      "Pendiente disposicion logistica",
      "Pendiente definicion retiro o despacho"
    ]
  },
  {
    status: "Pedido deposito",
    category: "delivery",
    order: 5,
    description: "El reemplazo ya esta liberado o debe pasar por compras y deposito antes de entregarse.",
    substatuses: [
      "Pendiente liberacion por Compras",
      "Mercaderia liberada",
      "Pendiente pasaje a deposito RMA",
      "Producto en deposito RMA"
    ]
  },
  {
    status: "Pedido a Kingston",
    category: "active",
    order: 6,
    description: "No hubo disponibilidad local y el caso depende de reposicion o recepcion desde EEUU.",
    substatuses: [
      "Pedido interno armado",
      "Pendiente consolidacion",
      "Pedido enviado a Kingston",
      "Esperando arribo desde EEUU",
      "Parte recibida"
    ]
  },
  {
    status: "Producto enviado",
    category: "delivery",
    order: 7,
    description: "El reemplazo salio de ANYX y se controla despacho, tracking y entrega final.",
    substatuses: ["Guia solicitada", "Guia cargada", "Despachado", "Tracking informado", "Entregado"]
  },
  {
    status: "Producto listo para retiro",
    category: "delivery",
    order: 8,
    description: "El reemplazo ya esta disponible para mostrador y se sigue hasta la entrega efectiva.",
    substatuses: ["Aviso de retiro enviado", "Retiro pendiente", "Producto entregado en mostrador"]
  },
  {
    status: "Realizado",
    category: "terminal",
    order: 9,
    description: "El cambio fue completado y la entrega quedo confirmada.",
    substatuses: ["Cambio exitoso", "Caso finalizado"]
  },
  {
    status: "Cerrado",
    category: "terminal",
    order: 10,
    description: "El caso fue cancelado o cerrado administrativamente por decision interna o de Kingston.",
    substatuses: ["Caso cerrado por Kingston", "Caso cancelado administrativamente"]
  }
];

export const transitionRules: TransitionRule[] = [
  {
    from: "Informado",
    to: "Aviso de envio",
    requiredFields: ["zona", "responsable actual", "mail de instrucciones"],
    autoTasks: ["Crear seguimiento de envio", "Alertar a operaciones si no hay comprobante"],
    note: "No avanzar si la zona todavia no esta definida."
  },
  {
    from: "Aviso de envio",
    to: "Producto recepcionado y en preparacion",
    requiredFields: ["fecha de recepcion", "usuario que recibio", "adjunto de evidencia"],
    autoTasks: ["Validar stock local", "Crear evento de recepcion"],
    note: "La recepcion fisica es obligatoria antes de abrir la etapa de stock."
  },
  {
    from: "Producto recepcionado y en preparacion",
    to: "Pedido a Kingston",
    requiredFields: ["sin stock local", "sin stock mayorista", "pedido consolidado"],
    autoTasks: ["Notificar a compras", "Abrir seguimiento de arribo EEUU"],
    note: "Solo aplica cuando no existe disponibilidad local ni de mayoristas."
  },
  {
    from: "Pedido deposito",
    to: "Producto enviado",
    requiredFields: ["transportista", "numero de guia", "fecha de despacho"],
    autoTasks: ["Enviar tracking", "Cerrar tarea de preparacion"],
    note: "Despacho sin guia no es valido."
  },
  {
    from: "Pedido etiqueta",
    to: "Producto listo para retiro",
    requiredFields: ["confirmacion de disponibilidad", "aviso de retiro"],
    autoTasks: ["Crear tarea de mostrador", "Avisar al cliente"],
    note: "El retiro queda abierto hasta registrar entrega efectiva."
  },
  {
    from: "Producto enviado",
    to: "Realizado",
    requiredFields: ["confirmacion de entrega"],
    autoTasks: ["Cerrar caso", "Registrar resultado exitoso"],
    note: "El caso no se completa solo con despacho."
  }
];

export const kingstonCases: KingstonCase[] = [
  {
    id: "rma-24018",
    internalNumber: "RMA-24018",
    kingstonNumber: "KS-984311",
    clientName: "Micro Delta SA",
    contactName: "Nadia Ferreyra",
    contactEmail: "nadia.ferreyra@microdelta.com.ar",
    contactPhone: "+54 11 4968 2240",
    zone: "Interior / Gran Buenos Aires",
    deliveryMode: "Dispatch",
    priority: "Critical",
    owner: "Lucia Costa",
    nextAction: "Consolidar pedido a Kingston y confirmar forecast de arribo",
    externalStatus: "Pedido a Kingston",
    internalSubstatus: "Pendiente consolidacion",
    openedAt: "2026-04-03T09:20:00-03:00",
    updatedAt: "2026-04-16T12:45:00-03:00",
    slaDueAt: "2026-04-18T18:00:00-03:00",
    address: "Av. Colon 4132",
    province: "Cordoba",
    city: "Cordoba",
    sku: "KF432C16BB/16",
    productDescription: "Memoria DDR4 16GB Fury Beast",
    quantity: 12,
    failureDescription: "Falla intermitente reportada por lote en entorno de servidor liviano.",
    origin: "Kingston email",
    observations:
      "Cliente con reposicion critica porque el lote impacta una instalacion bancaria. Kingston aprobo sin disponibilidad local.",
    logistics: {
      mode: "Dispatch",
      address: "Av. Colon 4132, Cordoba",
      transporter: null,
      guideNumber: null,
      trackingUrl: null,
      dispatchDate: null,
      deliveredDate: null,
      shippingCost: null,
      reimbursementState: "Pending"
    },
    procurement: {
      localStock: "Unavailable",
      wholesalerStock: "Unavailable",
      wholesalerName: null,
      requiresKingstonOrder: true,
      kingstonRequestedAt: "2026-04-15T17:30:00-03:00",
      receivedFromUsaAt: null,
      releasedByPurchasing: false,
      releasedAt: null,
      movedToRmaWarehouse: false,
      movedToRmaWarehouseAt: null
    },
    tasks: [
      {
        id: "task-24018-1",
        title: "Consolidar pedido EEUU",
        description: "Validar cantidades finales con compras antes del corte diario.",
        type: "stock",
        assignee: "Camila Rios",
        priority: "Critical",
        dueAt: "2026-04-16T17:30:00-03:00",
        state: "In progress"
      },
      {
        id: "task-24018-2",
        title: "Avisar a cliente sobre falta local",
        description: "Enviar update preventivo con ETA estimada y responsable.",
        type: "communication",
        assignee: "Lucia Costa",
        priority: "High",
        dueAt: "2026-04-16T18:00:00-03:00",
        state: "Pending"
      }
    ],
    comments: [
      {
        id: "comment-24018-1",
        author: "Sofia Mendez",
        body: "Mantener visibilidad diaria. Es una cuenta con alta sensibilidad operativa.",
        internal: true,
        createdAt: "2026-04-16T11:10:00-03:00"
      }
    ],
    attachments: [
      {
        id: "attachment-24018-1",
        name: "kingston-approval-thread.eml",
        kind: "mail",
        sizeLabel: "148 KB",
        uploadedBy: "Lucia Costa",
        createdAt: "2026-04-03T09:23:00-03:00"
      }
    ],
    events: [
      {
        id: "event-24018-1",
        kind: "status-change",
        title: "Caso creado",
        detail: "Ingreso inicial desde autorizacion Kingston y clasificacion de zona.",
        actor: "Lucia Costa",
        createdAt: "2026-04-03T09:20:00-03:00"
      },
      {
        id: "event-24018-2",
        kind: "procurement",
        title: "Sin stock local ni mayorista",
        detail: "Compras confirmo ausencia en plaza y habilito pedido a Kingston.",
        actor: "Camila Rios",
        createdAt: "2026-04-15T17:28:00-03:00"
      }
    ]
  },
  {
    id: "rma-24022",
    internalNumber: "RMA-24022",
    kingstonNumber: "KS-984615",
    clientName: "Compu Norte SRL",
    contactName: "Guillermo Farias",
    contactEmail: "gfarias@compunorte.com",
    contactPhone: "+54 11 5321 0028",
    zone: "Capital / AMBA",
    deliveryMode: "Pickup",
    priority: "Medium",
    owner: "Martin Ponce",
    nextAction: "Confirmar retiro del cliente y cerrar entrega en mostrador",
    externalStatus: "Producto listo para retiro",
    internalSubstatus: "Retiro pendiente",
    openedAt: "2026-04-08T10:05:00-03:00",
    updatedAt: "2026-04-16T09:35:00-03:00",
    slaDueAt: "2026-04-17T13:00:00-03:00",
    address: "Parana 758",
    province: "CABA",
    city: "Buenos Aires",
    sku: "DTSE9G3/128GB",
    productDescription: "Pendrive DataTraveler Exodia 128GB",
    quantity: 5,
    failureDescription: "Unidades intermitentes con perdida de escritura.",
    origin: "Operations load",
    observations: "Reemplazo preparado desde deposito RMA. Cliente coordina retiro por mostrador.",
    logistics: {
      mode: "Pickup",
      address: "Mostrador central ANYX",
      transporter: null,
      guideNumber: null,
      trackingUrl: null,
      dispatchDate: null,
      deliveredDate: null,
      shippingCost: null,
      reimbursementState: "Not applicable"
    },
    procurement: {
      localStock: "Available",
      wholesalerStock: "Pending",
      wholesalerName: null,
      requiresKingstonOrder: false,
      kingstonRequestedAt: null,
      receivedFromUsaAt: null,
      releasedByPurchasing: true,
      releasedAt: "2026-04-14T12:00:00-03:00",
      movedToRmaWarehouse: true,
      movedToRmaWarehouseAt: "2026-04-14T15:20:00-03:00"
    },
    tasks: [
      {
        id: "task-24022-1",
        title: "Confirmar retiro por mostrador",
        description: "Llamar al cliente antes de las 12 y validar persona autorizada.",
        type: "follow-up",
        assignee: "Martin Ponce",
        priority: "High",
        dueAt: "2026-04-17T11:00:00-03:00",
        state: "Pending"
      }
    ],
    comments: [],
    attachments: [],
    events: [
      {
        id: "event-24022-1",
        kind: "status-change",
        title: "Listo para retiro",
        detail: "Se envio aviso de retiro y se asigno tarea de mostrador.",
        actor: "Martin Ponce",
        createdAt: "2026-04-16T09:35:00-03:00"
      }
    ]
  },
  {
    id: "rma-24025",
    internalNumber: "RMA-24025",
    kingstonNumber: "KS-984902",
    clientName: "Nexo Digital",
    contactName: "Micaela Acosta",
    contactEmail: "micaela@nexodigital.com",
    contactPhone: "+54 11 5882 4100",
    zone: "Interior / Gran Buenos Aires",
    deliveryMode: "Dispatch",
    priority: "High",
    owner: "Martin Ponce",
    nextAction: "Monitorear entrega final y enviar cierre si llega hoy",
    externalStatus: "Producto enviado",
    internalSubstatus: "Tracking informado",
    openedAt: "2026-04-05T08:45:00-03:00",
    updatedAt: "2026-04-16T14:10:00-03:00",
    slaDueAt: "2026-04-17T18:00:00-03:00",
    address: "Ruta 197 Km 2.8",
    province: "Buenos Aires",
    city: "San Miguel",
    sku: "SNVS/1000G",
    productDescription: "SSD NV2 1TB PCIe 4.0",
    quantity: 3,
    failureDescription: "Unidades con degradacion de performance y alerta SMART.",
    origin: "Kingston email",
    observations: "Tracking activo por OCA. Cliente ya fue notificado con numero de guia.",
    logistics: {
      mode: "Dispatch",
      address: "Ruta 197 Km 2.8, San Miguel",
      transporter: "OCA",
      guideNumber: "00781249831",
      trackingUrl: "https://tracking.oca.example/00781249831",
      dispatchDate: "2026-04-16T13:40:00-03:00",
      deliveredDate: null,
      shippingCost: "ARS 18.400",
      reimbursementState: "Requested"
    },
    procurement: {
      localStock: "Available",
      wholesalerStock: "Pending",
      wholesalerName: null,
      requiresKingstonOrder: false,
      kingstonRequestedAt: null,
      receivedFromUsaAt: null,
      releasedByPurchasing: true,
      releasedAt: "2026-04-15T11:10:00-03:00",
      movedToRmaWarehouse: true,
      movedToRmaWarehouseAt: "2026-04-15T15:00:00-03:00"
    },
    tasks: [
      {
        id: "task-24025-1",
        title: "Validar entrega con tracking",
        description: "Revisar tracking y cerrar si se confirma recepcion.",
        type: "logistics",
        assignee: "Martin Ponce",
        priority: "High",
        dueAt: "2026-04-17T16:00:00-03:00",
        state: "In progress"
      }
    ],
    comments: [],
    attachments: [],
    events: [
      {
        id: "event-24025-1",
        kind: "logistics",
        title: "Despacho confirmado",
        detail: "Se cargo guia OCA y se envio tracking al cliente.",
        actor: "Martin Ponce",
        createdAt: "2026-04-16T14:10:00-03:00"
      }
    ]
  },
  {
    id: "rma-24030",
    internalNumber: "RMA-24030",
    kingstonNumber: "KS-985120",
    clientName: "Grupo Atlas IT",
    contactName: "Leonel Palma",
    contactEmail: "lpalma@atlasit.com",
    contactPhone: "+54 261 488 7104",
    zone: "Interior / Gran Buenos Aires",
    deliveryMode: "Dispatch",
    priority: "High",
    owner: "Lucia Costa",
    nextAction: "Escalar falta de comprobante al cliente y definir vencimiento",
    externalStatus: "Aviso de envio",
    internalSubstatus: "Comprobante de envio pendiente",
    openedAt: "2026-04-07T15:00:00-03:00",
    updatedAt: "2026-04-15T18:20:00-03:00",
    slaDueAt: "2026-04-16T12:00:00-03:00",
    address: "San Martin 1462",
    province: "Mendoza",
    city: "Godoy Cruz",
    sku: "KF556C40BBAK2-32",
    productDescription: "Kit DDR5 32GB Fury Beast",
    quantity: 2,
    failureDescription: "Modulo no reconocido despues de update de BIOS.",
    origin: "Commercial handoff",
    observations:
      "Cliente recibio instructivo pero no envio evidencia. Si no responde hoy debe evaluarse un cierre administrativo.",
    logistics: {
      mode: "Dispatch",
      address: "San Martin 1462, Godoy Cruz",
      transporter: null,
      guideNumber: null,
      trackingUrl: null,
      dispatchDate: null,
      deliveredDate: null,
      shippingCost: null,
      reimbursementState: "Pending"
    },
    procurement: {
      localStock: "Pending",
      wholesalerStock: "Pending",
      wholesalerName: null,
      requiresKingstonOrder: false,
      kingstonRequestedAt: null,
      receivedFromUsaAt: null,
      releasedByPurchasing: false,
      releasedAt: null,
      movedToRmaWarehouse: false,
      movedToRmaWarehouseAt: null
    },
    tasks: [
      {
        id: "task-24030-1",
        title: "Ultimo seguimiento al cliente",
        description: "Escalar por mail y telefono. Si no responde, marcar para vencimiento.",
        type: "follow-up",
        assignee: "Lucia Costa",
        priority: "Critical",
        dueAt: "2026-04-16T16:30:00-03:00",
        state: "Pending"
      }
    ],
    comments: [
      {
        id: "comment-24030-1",
        author: "Lucia Costa",
        body: "Se reenvio instructivo a las 17:55. Sin acuse todavia.",
        internal: true,
        createdAt: "2026-04-15T18:20:00-03:00"
      }
    ],
    attachments: [],
    events: [
      {
        id: "event-24030-1",
        kind: "comment",
        title: "Instructivo reenviado",
        detail: "Segundo aviso al cliente por falta de comprobante.",
        actor: "Lucia Costa",
        createdAt: "2026-04-15T18:20:00-03:00"
      }
    ]
  },
  {
    id: "rma-24031",
    internalNumber: "RMA-24031",
    kingstonNumber: "KS-985228",
    clientName: "Hyperlink SA",
    contactName: "Julieta Sabsay",
    contactEmail: "julieta.sabsay@hyperlink.com",
    contactPhone: "+54 11 4320 1820",
    zone: "Capital / AMBA",
    deliveryMode: "Pickup",
    priority: "Medium",
    owner: "Ivan Sosa",
    nextAction: "Catalogar por tecnico y definir si sale por retiro o despacho",
    externalStatus: "Pedido etiqueta",
    internalSubstatus: "Catalogado por tecnico",
    openedAt: "2026-04-10T11:00:00-03:00",
    updatedAt: "2026-04-16T10:05:00-03:00",
    slaDueAt: "2026-04-19T17:00:00-03:00",
    address: "Sarmiento 920",
    province: "CABA",
    city: "Buenos Aires",
    sku: "SKC3000S/1024G",
    productDescription: "SSD KC3000 1TB NVMe",
    quantity: 1,
    failureDescription: "Unidad no inicializa sistema operativo.",
    origin: "Kingston email",
    observations: "El reemplazo esta reservado, falta definicion final de modalidad.",
    logistics: {
      mode: "Pickup",
      address: "Mostrador central ANYX",
      transporter: null,
      guideNumber: null,
      trackingUrl: null,
      dispatchDate: null,
      deliveredDate: null,
      shippingCost: null,
      reimbursementState: "Not applicable"
    },
    procurement: {
      localStock: "Available",
      wholesalerStock: "Pending",
      wholesalerName: null,
      requiresKingstonOrder: false,
      kingstonRequestedAt: null,
      receivedFromUsaAt: null,
      releasedByPurchasing: true,
      releasedAt: "2026-04-15T10:20:00-03:00",
      movedToRmaWarehouse: true,
      movedToRmaWarehouseAt: "2026-04-15T12:10:00-03:00"
    },
    tasks: [
      {
        id: "task-24031-1",
        title: "Definir modalidad final",
        description: "Esperar confirmacion del cliente para retiro o despacho.",
        type: "validation",
        assignee: "Ivan Sosa",
        priority: "Medium",
        dueAt: "2026-04-17T15:00:00-03:00",
        state: "Pending"
      }
    ],
    comments: [],
    attachments: [
      {
        id: "attachment-24031-1",
        name: "diagnostic-serial-photo.jpg",
        kind: "photo",
        sizeLabel: "1.4 MB",
        uploadedBy: "Ivan Sosa",
        createdAt: "2026-04-16T09:58:00-03:00"
      }
    ],
    events: [
      {
        id: "event-24031-1",
        kind: "attachment",
        title: "Catalogacion tecnica",
        detail: "Se adjunto evidencia de serial y se marco catalogado.",
        actor: "Ivan Sosa",
        createdAt: "2026-04-16T10:05:00-03:00"
      }
    ]
  },
  {
    id: "rma-24034",
    internalNumber: "RMA-24034",
    kingstonNumber: "KS-985402",
    clientName: "Orbit Solutions",
    contactName: "Pablo Zubia",
    contactEmail: "pz@orbitsolutions.com",
    contactPhone: "+54 11 4813 8854",
    zone: "Capital / AMBA",
    deliveryMode: "Pickup",
    priority: "Low",
    owner: "Sofia Mendez",
    nextAction: "Revisar si corresponde reapertura o archivo definitivo",
    externalStatus: "Cerrado",
    internalSubstatus: "Caso cancelado administrativamente",
    openedAt: "2026-03-28T14:30:00-03:00",
    updatedAt: "2026-04-14T16:00:00-03:00",
    slaDueAt: "2026-04-10T18:00:00-03:00",
    address: "Vuelta de Obligado 1823",
    province: "CABA",
    city: "Buenos Aires",
    sku: "SDCS2/256GB",
    productDescription: "MicroSD Canvas Select Plus 256GB",
    quantity: 7,
    failureDescription: "Lote con corrupcion de datos reportada por comercio.",
    origin: "Operations load",
    observations: "Cliente no respondio a tres seguimientos. Caso cerrado administrativamente por falta de respuesta.",
    logistics: {
      mode: "Pickup",
      address: "Mostrador central ANYX",
      transporter: null,
      guideNumber: null,
      trackingUrl: null,
      dispatchDate: null,
      deliveredDate: null,
      shippingCost: null,
      reimbursementState: "Not applicable"
    },
    procurement: {
      localStock: "Pending",
      wholesalerStock: "Pending",
      wholesalerName: null,
      requiresKingstonOrder: false,
      kingstonRequestedAt: null,
      receivedFromUsaAt: null,
      releasedByPurchasing: false,
      releasedAt: null,
      movedToRmaWarehouse: false,
      movedToRmaWarehouseAt: null
    },
    tasks: [
      {
        id: "task-24034-1",
        title: "Validar reapertura",
        description: "Si el cliente responde, reactivar workflow desde Informado.",
        type: "validation",
        assignee: "Sofia Mendez",
        priority: "Low",
        dueAt: "2026-04-18T12:00:00-03:00",
        state: "Blocked"
      }
    ],
    comments: [
      {
        id: "comment-24034-1",
        author: "Sofia Mendez",
        body: "Caso cerrado por falta de respuesta a los tres contactos registrados.",
        internal: true,
        createdAt: "2026-04-14T16:00:00-03:00"
      }
    ],
    attachments: [],
    events: [
      {
        id: "event-24034-1",
        kind: "status-change",
        title: "Caso cerrado por falta de respuesta",
        detail: "Se cerro administrativamente luego de agotar los seguimientos al cliente.",
        actor: "Sofia Mendez",
        createdAt: "2026-04-14T16:00:00-03:00"
      }
    ]
  }
];
