import type {
  KingstonCase,
  ModulePermissionKey,
  ModulePermissions,
  OwnerDirectoryEntry,
  TransitionRule,
  UserRole,
  WorkflowState
} from "@/lib/kingston/types";

export const referenceNow = "2026-04-21T10:00:00-03:00";

export const modulePermissionKeys: ModulePermissionKey[] = [
  "summary",
  "mail",
  "open-cases",
  "reimbursements",
  "pending-purchases",
  "pending-service",
  "closed-cases",
  "audit",
  "reports",
  "settings"
];

function createPermissionMap(view: ModulePermissionKey[], manage: ModulePermissionKey[] = []): ModulePermissions {
  return modulePermissionKeys.reduce<ModulePermissions>((accumulator, key) => {
    accumulator[key] = {
      view: view.includes(key),
      manage: manage.includes(key)
    };
    return accumulator;
  }, {} as ModulePermissions);
}

export function getDefaultPermissionsForRole(role: UserRole): ModulePermissions {
  switch (role) {
    case "ADMIN":
      return createPermissionMap(modulePermissionKeys, modulePermissionKeys);
    case "SALES":
      return createPermissionMap(["summary", "mail", "open-cases", "closed-cases", "reports"], ["mail", "open-cases"]);
    case "TECHNICAL_SERVICE":
      return createPermissionMap(
        ["summary", "open-cases", "pending-service", "closed-cases"],
        ["pending-service", "open-cases"]
      );
    case "PURCHASING":
      return createPermissionMap(
        ["summary", "open-cases", "reimbursements", "pending-purchases", "closed-cases", "reports"],
        ["reimbursements", "pending-purchases"]
      );
    case "PAYMENTS":
      return createPermissionMap(["summary", "reimbursements", "reports"], ["reimbursements"]);
    default:
      return createPermissionMap(["summary"]);
  }
}

export const ownerDirectory: OwnerDirectoryEntry[] = [];

export const workflowStates: WorkflowState[] = [
  {
    status: "Informado",
    category: "service",
    order: 1,
    zones: ["Interior / Gran Buenos Aires", "Capital / AMBA"],
    description: "El caso entro al circuito y todavia esta pendiente de validacion tecnica inicial.",
    substatuses: [
      "Caso recibido",
      "Validacion inicial pendiente",
      "Ticket revisado por servicio tecnico"
    ]
  },
  {
    status: "Aviso de envio",
    category: "service",
    order: 2,
    zones: ["Interior / Gran Buenos Aires"],
    description: "Se enviaron instrucciones para que el cliente despache el producto a ANYX.",
    substatuses: ["Instrucciones enviadas", "Comprobante pendiente", "Producto en transito"]
  },
  {
    status: "Caso recibido",
    category: "service",
    order: 2,
    zones: ["Capital / AMBA"],
    description: "ANYX recibio el caso y avisara al cliente cuando pueda acercarse a realizar el cambio.",
    substatuses: ["Caso recibido por ANYX", "Cliente avisado", "Pendiente de disponibilidad para cambio"]
  },
  {
    status: "Producto recepcionado y en preparacion",
    category: "service",
    order: 3,
    zones: ["Interior / Gran Buenos Aires", "Capital / AMBA"],
    description: "ANYX ya recibio el producto fallado y valida stock, reintegro y proximo paso.",
    substatuses: [
      "Producto recibido",
      "Chequeo de stock local",
      "Chequeo de mayoristas",
      "Definicion de via de resolucion",
      "Reintegro en curso",
      "OV en preparacion"
    ]
  },
  {
    status: "OV creada",
    category: "purchasing",
    order: 4,
    zones: ["Interior / Gran Buenos Aires", "Capital / AMBA"],
    description: "Ventas deja creada la OV y el caso pasa a compras para definir abastecimiento o recepcion.",
    substatuses: ["OV pendiente de validacion", "OV creada", "Esperando decision de compras"]
  },
  {
    status: "Liberar mercaderia",
    category: "purchasing",
    order: 5,
    zones: ["Interior / Gran Buenos Aires", "Capital / AMBA"],
    description: "Estado legacy para compatibilidad con casos anteriores al flujo actual de compras.",
    substatuses: ["Pendiente aprobacion", "Liberacion en revision", "Listo para OV"]
  },
  {
    status: "Pedido Kingston",
    category: "purchasing",
    order: 6,
    zones: ["Interior / Gran Buenos Aires", "Capital / AMBA"],
    description: "Compras ya pidio reposicion a Kingston y el caso sigue pendiente dentro del sector.",
    substatuses: ["Solicitud interna armada", "Pedido enviado", "Esperando confirmacion de compras"]
  },
  {
    status: "En stock",
    category: "service",
    order: 7,
    zones: ["Interior / Gran Buenos Aires", "Capital / AMBA"],
    description: "Compras confirmo disponibilidad en stock y el caso vuelve al flujo operativo para avanzar a deposito y etiquetado.",
    substatuses: ["Stock confirmado", "Disponible para preparar", "Pendiente de paso a deposito"]
  },
  {
    status: "Pendiente de recibirlo",
    category: "service",
    order: 8,
    zones: ["Interior / Gran Buenos Aires", "Capital / AMBA"],
    description: "Ventas queda a la espera de la confirmacion de remitir o recepcion para volver a tomar el caso.",
    substatuses: ["Esperando remitir", "Recepcion pendiente", "Pendiente de reingreso operativo"]
  },
  {
    status: "Pedido deposito y etiquetado",
    category: "service",
    order: 9,
    zones: ["Interior / Gran Buenos Aires", "Capital / AMBA"],
    description: "Servicio tecnico y deposito dejan el reemplazo listo para la salida final del caso.",
    substatuses: ["Catalogacion pendiente", "Catalogado", "Etiquetado pendiente", "Listo para entrega"]
  },
  {
    status: "Pedido guia",
    category: "delivery",
    order: 10,
    zones: ["Interior / Gran Buenos Aires"],
    description: "Estado legacy para compatibilidad con casos anteriores donde la guia se trabajaba como etapa separada.",
    substatuses: ["Transportista definido", "Guia solicitada", "Guia confirmada"]
  },
  {
    status: "Producto enviado",
    category: "delivery",
    order: 11,
    zones: ["Interior / Gran Buenos Aires"],
    description: "El reemplazo ya fue despachado. La guia puede quedar pendiente de carga si aun no llego el numero final.",
    substatuses: ["Despachado", "Guia pendiente", "Esperando entrega"]
  },
  {
    status: "Producto listo para retiro",
    category: "delivery",
    order: 11,
    zones: ["Capital / AMBA"],
    description: "El reemplazo esta disponible en ANYX y se espera retiro del cliente.",
    substatuses: ["Aviso enviado", "Retiro pendiente", "Cliente confirmado"]
  },
  {
    status: "Realizado",
    category: "terminal",
    order: 12,
    zones: ["Interior / Gran Buenos Aires", "Capital / AMBA"],
    description: "El caso termino correctamente con entrega o retiro confirmado.",
    substatuses: ["Entrega confirmada", "Caso finalizado"]
  },
  {
    status: "Vencido",
    category: "terminal",
    order: 13,
    zones: ["Interior / Gran Buenos Aires", "Capital / AMBA"],
    description: "El caso quedo vencido por falta de respuesta o accion del cliente.",
    substatuses: ["Sin respuesta", "Vencimiento registrado"]
  },
  {
    status: "Cerrado",
    category: "terminal",
    order: 14,
    zones: ["Interior / Gran Buenos Aires", "Capital / AMBA"],
    description: "El caso se cerro administrativamente por decision interna o de Kingston.",
    substatuses: ["Cierre administrativo", "Cierre solicitado por Kingston"]
  }
];

export const transitionRules: TransitionRule[] = [
  {
    from: "Informado",
    to: "Aviso de envio",
    zones: ["Interior / Gran Buenos Aires"],
    requiredFields: ["zona definida", "contacto validado"],
    autoTasks: ["Enviar instructivo de envio"],
    note: "Solo aplica cuando el producto debe viajar desde el interior hacia ANYX."
  },
  {
    from: "Informado",
    to: "Caso recibido",
    zones: ["Capital / AMBA"],
    requiredFields: ["contacto validado", "zona capital/amba confirmada"],
    autoTasks: ["Avisar recepcion del caso al cliente"],
    note: "Para Capital / AMBA se informa al cliente que ANYX recibio el caso y avisara cuando pueda acercarse."
  },
  {
    from: "Caso recibido",
    to: "Producto recepcionado y en preparacion",
    zones: ["Capital / AMBA"],
    requiredFields: ["recepcion o disponibilidad confirmada"],
    autoTasks: ["Validar stock local"],
    note: "Luego del aviso de recepcion, el caso continua con preparacion operativa."
  },
  {
    from: "Informado",
    to: "Producto recepcionado y en preparacion",
    zones: ["Capital / AMBA"],
    requiredFields: ["recepcion confirmada"],
    autoTasks: ["Validar stock local"],
    note: "Para Capital / AMBA el caso puede pasar directo a recepcion y preparacion."
  },
  {
    from: "Aviso de envio",
    to: "Producto recepcionado y en preparacion",
    zones: ["Interior / Gran Buenos Aires"],
    requiredFields: ["recepcion confirmada"],
    autoTasks: ["Validar stock local"],
    note: "Interior / GBA necesita recepcion efectiva del producto antes de crear la OV."
  },
  {
    from: "Producto recepcionado y en preparacion",
    to: "OV creada",
    zones: ["Interior / Gran Buenos Aires", "Capital / AMBA"],
    requiredFields: ["reintegro revisado", "OV registrada"],
    autoTasks: ["Enviar el caso a compras"],
    note: "Luego del paso de reintegros, ventas mantiene el mismo estado y crea la OV antes de pasarlo a compras."
  },
  {
    from: "Liberar mercaderia",
    to: "OV creada",
    zones: ["Interior / Gran Buenos Aires", "Capital / AMBA"],
    requiredFields: ["mercaderia liberada"],
    autoTasks: ["Registrar OV creada"],
    note: "Se mantiene como compatibilidad para casos viejos que todavia usan este hito."
  },
  {
    from: "OV creada",
    to: "Pedido Kingston",
    zones: ["Interior / Gran Buenos Aires", "Capital / AMBA"],
    requiredFields: ["decision de compras registrada"],
    autoTasks: ["Continuar seguimiento en compras"],
    note: "Compras mantiene el caso cuando necesita pedir mercaderia a Kingston."
  },
  {
    from: "OV creada",
    to: "Pendiente de recibirlo",
    zones: ["Interior / Gran Buenos Aires", "Capital / AMBA"],
    requiredFields: ["compra o remitir confirmados"],
    autoTasks: ["Devolver el caso a ventas"],
    note: "Cuando compras ya resolvio la reposicion, el caso deja la bandeja de compras y vuelve a abiertos."
  },
  {
    from: "OV creada",
    to: "En stock",
    zones: ["Interior / Gran Buenos Aires", "Capital / AMBA"],
    requiredFields: ["stock confirmado"],
    autoTasks: ["Devolver el caso a ventas"],
    note: "Cuando compras confirma stock disponible, el caso sale de compras y sigue el mismo circuito que Pendiente de recibirlo."
  },
  {
    from: "En stock",
    to: "Pedido deposito y etiquetado",
    zones: ["Interior / Gran Buenos Aires", "Capital / AMBA"],
    requiredFields: ["stock reservado"],
    autoTasks: ["Enviar el caso a servicio tecnico"],
    note: "En stock funciona como alternativa a Pendiente de recibirlo y avanza a deposito y etiquetado."
  },
  {
    from: "Pedido Kingston",
    to: "Pendiente de recibirlo",
    zones: ["Interior / Gran Buenos Aires", "Capital / AMBA"],
    requiredFields: ["pedido enviado a Kingston"],
    autoTasks: ["Esperar confirmacion de remitir"],
    note: "El caso sigue en compras hasta que queda pendiente de recibir el reemplazo."
  },
  {
    from: "Pendiente de recibirlo",
    to: "Pedido deposito y etiquetado",
    zones: ["Interior / Gran Buenos Aires", "Capital / AMBA"],
    requiredFields: ["confirmacion de remitir"],
    autoTasks: ["Enviar el caso a servicio tecnico"],
    note: "Con la confirmacion de recepcion o remitir, servicio tecnico vuelve a tomar el caso."
  },
  {
    from: "Pedido deposito y etiquetado",
    to: "Producto enviado",
    zones: ["Interior / Gran Buenos Aires"],
    requiredFields: ["producto etiquetado"],
    autoTasks: ["Despachar y cargar guia cuando este disponible"],
    note: "Interior / GBA puede marcarse como enviado aunque la guia se cargue despues."
  },
  {
    from: "Pedido deposito y etiquetado",
    to: "Producto listo para retiro",
    zones: ["Capital / AMBA"],
    requiredFields: ["producto etiquetado"],
    autoTasks: ["Avisar disponibilidad"],
    note: "Capital / AMBA cierra por retiro, sin pasar por despacho."
  },
  {
    from: "Producto enviado",
    to: "Realizado",
    zones: ["Interior / Gran Buenos Aires"],
    requiredFields: ["confirmacion de entrega o cierre"],
    autoTasks: ["Confirmar cierre comercial"],
    note: "Ventas valida el cierre final del caso de despacho."
  },
  {
    from: "Producto listo para retiro",
    to: "Realizado",
    zones: ["Capital / AMBA"],
    requiredFields: ["retiro confirmado"],
    autoTasks: ["Confirmar cierre comercial"],
    note: "Ventas confirma el cierre del circuito de retiro."
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
    owner: "Sin asignar",
    nextAction: "Consolidar pedido a Kingston y confirmar forecast de arribo.",
    externalStatus: "Pedido Kingston",
    internalSubstatus: "Esperando arribo",
    openedAt: "2026-04-03T09:20:00-03:00",
    updatedAt: "2026-04-20T12:45:00-03:00",
    slaDueAt: "2026-04-23T18:00:00-03:00",
    address: "Av. Colon 4132",
    province: "Cordoba",
    city: "Cordoba",
    sku: "KF432C16BB/16",
    productDescription: "Memoria DDR4 16GB Fury Beast",
    quantity: 12,
    failureDescription: "Falla intermitente reportada por lote en entorno de servidor liviano.",
    origin: "Kingston email",
    observations: "Caso critico por reposicion para una cuenta bancaria.",
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
      kingstonRequestedAt: "2026-04-20T11:30:00-03:00",
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
        assignee: "Sin asignar",
        priority: "Critical",
        dueAt: "2026-04-22T17:30:00-03:00",
        state: "In progress"
      }
    ],
    comments: [],
    attachments: [],
    events: [
      {
        id: "event-24018-1",
        kind: "status-change",
        title: "Caso creado",
        detail: "Ingreso inicial desde autorizacion Kingston.",
        actor: "Sistema",
        createdAt: "2026-04-03T09:20:00-03:00"
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
    owner: "Sin asignar",
    nextAction: "Confirmar retiro del cliente y cerrar entrega en mostrador.",
    externalStatus: "Producto listo para retiro",
    internalSubstatus: "Retiro pendiente",
    openedAt: "2026-04-08T10:05:00-03:00",
    updatedAt: "2026-04-20T09:35:00-03:00",
    slaDueAt: "2026-04-22T13:00:00-03:00",
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
      releasedAt: "2026-04-18T12:00:00-03:00",
      movedToRmaWarehouse: true,
      movedToRmaWarehouseAt: "2026-04-18T15:20:00-03:00"
    },
    tasks: [
      {
        id: "task-24022-1",
        title: "Confirmar retiro por mostrador",
        description: "Llamar al cliente y validar persona autorizada.",
        type: "follow-up",
        assignee: "Sin asignar",
        priority: "High",
        dueAt: "2026-04-21T14:00:00-03:00",
        state: "Pending"
      }
    ],
    comments: [],
    attachments: [],
    events: []
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
    owner: "Sin asignar",
    nextAction: "Solicitar guia y compartir tracking al cliente.",
    externalStatus: "Pedido guia",
    internalSubstatus: "Guia solicitada",
    openedAt: "2026-04-05T08:45:00-03:00",
    updatedAt: "2026-04-20T14:10:00-03:00",
    slaDueAt: "2026-04-22T18:00:00-03:00",
    address: "Ruta 197 Km 2.8",
    province: "Buenos Aires",
    city: "San Miguel",
    sku: "SNVS/1000G",
    productDescription: "SSD NV2 1TB PCIe 4.0",
    quantity: 3,
    failureDescription: "Unidades con degradacion de performance y alerta SMART.",
    origin: "Kingston email",
    observations: "Cliente espera despacho con prioridad alta.",
    logistics: {
      mode: "Dispatch",
      address: "Ruta 197 Km 2.8, San Miguel",
      transporter: "OCA",
      guideNumber: null,
      trackingUrl: null,
      dispatchDate: null,
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
      releasedAt: "2026-04-19T11:10:00-03:00",
      movedToRmaWarehouse: true,
      movedToRmaWarehouseAt: "2026-04-19T15:00:00-03:00"
    },
    tasks: [
      {
        id: "task-24025-1",
        title: "Cargar numero de guia",
        description: "Completar el despacho y enviar tracking.",
        type: "logistics",
        assignee: "Sin asignar",
        priority: "High",
        dueAt: "2026-04-21T16:00:00-03:00",
        state: "In progress"
      }
    ],
    comments: [],
    attachments: [],
    events: []
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
    owner: "Sin asignar",
    nextAction: "Escalar falta de comprobante al cliente y definir vencimiento.",
    externalStatus: "Aviso de envio",
    internalSubstatus: "Comprobante pendiente",
    openedAt: "2026-04-07T15:00:00-03:00",
    updatedAt: "2026-04-19T18:20:00-03:00",
    slaDueAt: "2026-04-21T12:00:00-03:00",
    address: "San Martin 1462",
    province: "Mendoza",
    city: "Godoy Cruz",
    sku: "KF556C40BBAK2-32",
    productDescription: "Kit DDR5 32GB Fury Beast",
    quantity: 2,
    failureDescription: "Modulo no reconocido despues de update de BIOS.",
    origin: "Commercial handoff",
    observations: "Cliente recibio instructivo pero no envio evidencia.",
    logistics: {
      mode: "Dispatch",
      address: "San Martin 1462, Godoy Cruz",
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
        id: "task-24030-1",
        title: "Ultimo seguimiento al cliente",
        description: "Escalar por mail y telefono.",
        type: "follow-up",
        assignee: "Sin asignar",
        priority: "Critical",
        dueAt: "2026-04-21T16:30:00-03:00",
        state: "Pending"
      }
    ],
    comments: [],
    attachments: [],
    events: []
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
    owner: "Sin asignar",
    nextAction: "Servicio tecnico debe terminar catalogacion y etiquetado.",
    externalStatus: "Pedido deposito y etiquetado",
    internalSubstatus: "Catalogado",
    openedAt: "2026-04-10T11:00:00-03:00",
    updatedAt: "2026-04-20T10:05:00-03:00",
    slaDueAt: "2026-04-23T17:00:00-03:00",
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
      releasedAt: "2026-04-19T10:20:00-03:00",
      movedToRmaWarehouse: true,
      movedToRmaWarehouseAt: "2026-04-19T12:10:00-03:00"
    },
    tasks: [
      {
        id: "task-24031-1",
        title: "Finalizar etiquetado",
        description: "Cerrar validacion tecnica y pasar a compras.",
        type: "validation",
        assignee: "Sin asignar",
        priority: "Medium",
        dueAt: "2026-04-22T15:00:00-03:00",
        state: "Pending"
      }
    ],
    comments: [],
    attachments: [],
    events: []
  },
  {
    id: "rma-24035",
    internalNumber: "RMA-24035",
    kingstonNumber: "KS-985510",
    clientName: "Orbit Solutions",
    contactName: "Pablo Zubia",
    contactEmail: "pz@orbitsolutions.com",
    contactPhone: "+54 11 4813 8854",
    zone: "Capital / AMBA",
    deliveryMode: "Pickup",
    priority: "Medium",
    owner: "Sin asignar",
    nextAction: "Compras debe validar la OV y liberar la continuidad del caso.",
    externalStatus: "OV creada",
    internalSubstatus: "OV creada",
    openedAt: "2026-04-11T09:15:00-03:00",
    updatedAt: "2026-04-20T16:25:00-03:00",
    slaDueAt: "2026-04-22T18:00:00-03:00",
    address: "Vuelta de Obligado 1823",
    province: "CABA",
    city: "Buenos Aires",
    sku: "SDCS2/256GB",
    productDescription: "MicroSD Canvas Select Plus 256GB",
    quantity: 7,
    failureDescription: "Lote con corrupcion de datos reportada por comercio.",
    origin: "Operations load",
    observations: "El caso debe ser tomado por compras para validar la OV.",
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
      releasedAt: "2026-04-20T11:00:00-03:00",
      movedToRmaWarehouse: true,
      movedToRmaWarehouseAt: "2026-04-20T12:30:00-03:00"
    },
    tasks: [
      {
        id: "task-24035-1",
        title: "Validar OV",
        description: "Compras debe revisar la OV creada y definir continuidad.",
        type: "stock",
        assignee: "Sin asignar",
        priority: "Medium",
        dueAt: "2026-04-22T10:00:00-03:00",
        state: "Pending"
      }
    ],
    comments: [],
    attachments: [],
    events: []
  }
];

export const archivedCasesSeed: KingstonCase[] = [
  {
    id: "rma-23984",
    internalNumber: "RMA-23984",
    kingstonNumber: "KS-982771",
    clientName: "Data Vision Patagonia",
    contactName: "Mauro Ilardo",
    contactEmail: "m.ilardo@datavision.com.ar",
    contactPhone: "+54 299 481 9033",
    zone: "Interior / Gran Buenos Aires",
    deliveryMode: "Dispatch",
    priority: "Medium",
    owner: "Sin asignar",
    nextAction: "Caso fuera de la bandeja operativa.",
    externalStatus: "Realizado",
    internalSubstatus: "Entrega confirmada",
    openedAt: "2026-03-26T10:40:00-03:00",
    updatedAt: "2026-04-09T17:10:00-03:00",
    slaDueAt: "2026-04-10T18:00:00-03:00",
    address: "Belgrano 455",
    province: "Neuquen",
    city: "Neuquen Capital",
    sku: "KC3000/2048G",
    productDescription: "SSD KC3000 2TB NVMe",
    quantity: 2,
    failureDescription: "Lote con perdida total de deteccion luego de reinicios en caliente.",
    origin: "Kingston email",
    observations: "Reemplazo entregado y recepcion confirmado por el cliente.",
    logistics: {
      mode: "Dispatch",
      address: "Belgrano 455, Neuquen Capital, Neuquen, Argentina",
      transporter: "Andreani",
      guideNumber: "A99823145",
      trackingUrl: "https://tracking.andreani.example/A99823145",
      dispatchDate: "2026-04-08T14:15:00-03:00",
      deliveredDate: "2026-04-09T11:20:00-03:00",
      shippingCost: "ARS 24.900",
      reimbursementState: "Completed"
    },
    procurement: {
      localStock: "Available",
      wholesalerStock: "Pending",
      wholesalerName: null,
      requiresKingstonOrder: false,
      kingstonRequestedAt: null,
      receivedFromUsaAt: null,
      releasedByPurchasing: true,
      releasedAt: "2026-04-07T09:00:00-03:00",
      movedToRmaWarehouse: true,
      movedToRmaWarehouseAt: "2026-04-07T12:30:00-03:00"
    },
    tasks: [],
    comments: [],
    attachments: [],
    events: []
  },
  {
    id: "rma-23980",
    internalNumber: "RMA-23980",
    kingstonNumber: "KS-982401",
    clientName: "Zeta Servicios Informaticos",
    contactName: "Carla Biondi",
    contactEmail: "cbiondi@zetasi.com.ar",
    contactPhone: "+54 11 4331 8820",
    zone: "Capital / AMBA",
    deliveryMode: "Pickup",
    priority: "Low",
    owner: "Sin asignar",
    nextAction: "Caso fuera de la bandeja operativa.",
    externalStatus: "Cerrado",
    internalSubstatus: "Cierre administrativo",
    openedAt: "2026-03-21T13:15:00-03:00",
    updatedAt: "2026-03-25T16:40:00-03:00",
    slaDueAt: "2026-03-29T18:00:00-03:00",
    address: "Av. Santa Fe 3250",
    province: "Buenos Aires",
    city: "CABA",
    sku: "DTMAXA/256GB",
    productDescription: "Pendrive DataTraveler Max 256GB",
    quantity: 4,
    failureDescription: "El cliente informo fallas, pero luego solicito cerrar el proceso por reposicion propia.",
    origin: "Operations load",
    observations: "Kingston y ANYX acordaron cierre administrativo sin reemplazo.",
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
    tasks: [],
    comments: [],
    attachments: [],
    events: []
  }
];
