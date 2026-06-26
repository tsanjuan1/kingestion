# Automatizacion n8n para Kingestion

Este directorio deja una base real para operar el proceso completo de RMA Kingston con `n8n`, correos automáticos e IA conectada a `Kingestion`.

## Que incluye

- `kingestion-01-ingesta-autorizaciones.json`
  - lee el correo de autorizacion de Kingston por IMAP
  - usa IA para interpretar el mail y estructurar el caso
  - crea o actualiza el caso en `Kingestion`
  - dispara los correos iniciales a Kingston y al cliente

- `kingestion-02-seguimiento-operativo.json`
  - consulta actividad reciente de `Kingestion`
  - detecta cambios de estado
  - usa IA para redactar comunicaciones operativas
  - manda correos al cliente o al sector interno correcto
  - registra un comentario automático dentro del caso

- `kingestion-03-copiloto-ia.json`
  - expone un webhook tipo copiloto
  - interpreta pedidos operativos con IA
  - busca casos, lee casos y, si `allowWrites=true`, puede:
    - cambiar estado
    - agregar comentario
    - completar reintegro
    - completar cola sectorial

- `kingestion-04-alertas-sla.json`
  - genera un digest diario
  - prioriza SLA comprometidos y casos críticos
  - redacta el resumen con IA
  - lo envía a supervisión

## API de Kingestion para n8n

El pack usa estos endpoints nuevos:

- `GET /api/integrations/n8n/reference`
- `GET /api/integrations/n8n/activity`
- `GET /api/integrations/n8n/control/kingston-rma`
- `GET /api/integrations/n8n/cases`
- `POST /api/integrations/n8n/cases`
- `GET /api/integrations/n8n/cases/:caseId`
- `PATCH /api/integrations/n8n/cases/:caseId`

Autenticación:

- header `x-kingestion-api-key: <KINGESTION_AUTOMATION_API_KEY>`
- o `Authorization: Bearer <KINGESTION_AUTOMATION_API_KEY>`

## Variables necesarias

En `Kingestion`:

```env
DATABASE_URL="postgres://..."
KINGESTION_AUTOMATION_API_KEY="..."
KINGESTION_AUTOMATION_ACTOR_EMAIL="automation@kingestion.local"
KINGESTION_AUTOMATION_PILOT_MODE="true"
KINGESTION_AUTOMATION_PROOF_AI="true"
KINGESTION_N8N_PILOT_TRIGGER_URL=""
KINGESTION_N8N_PILOT_TRIGGER_TOKEN=""
```

En `n8n`:

```env
KINGESTION_BASE_URL="https://kingestion.vercel.app"
KINGESTION_AUTOMATION_API_KEY="mismo-valor-que-en-kingestion"
KINGESTION_FROM_EMAIL="rma@anyx.com.ar"
KINGESTION_SUPERVISION_EMAIL="operaciones@anyx.com.ar"
KINGESTION_TECH_EMAIL="serviciotecnico@anyx.com.ar"
KINGESTION_PURCHASING_EMAIL="compras@anyx.com.ar"
KINGESTION_LOGISTICS_EMAIL="logistica@anyx.com.ar"
KINGESTION_KINGSTON_REQUEST_EMAIL="gdelcastillo@anyx.com.ar"
KINGESTION_CUSTOMER_FORM_URL="https://..."
KINGESTION_PICKUP_ADDRESS="Sucursal ANYX"
KINGSTON_RMA_TO="rma@kingston.com"
```

Credenciales a crear en `n8n`:

- `IMAP` para leer el buzón de Kingston o el buzón intermediario
- `SMTP` para enviar correos
- un proveedor compatible OpenAI para los nodos de interpretación y redacción, por ejemplo `Groq`

## Matriz de correos rescatada del SharePoint viejo

- Ingesta de autorización:
  - acuse automático al remitente de Kingston
  - confirmación inicial al end user avisando que el caso quedó recibido en `Kingestion`

- `Aviso de envio`:
  - correo al cliente con instrucciones de envío
  - pedido de comprobante oficial con costo de envío
  - link al formulario web para datos de entrega y bancarios

- `Producto recepcionado y en preparacion`:
  - correo al cliente confirmando recepción del producto fallado

- `OV creada`:
  - aviso a compras para que tome la OV y defina continuidad del circuito actual

- `Pedido Kingston`:
  - correo interno a `KINGESTION_KINGSTON_REQUEST_EMAIL` para consolidar pedido a Kingston EEUU
  - correo al cliente informando falta local y demora por reposición

- `Pedido deposito y etiquetado`:
  - aviso a servicio técnico para catalogar el reemplazo como RMA y disponerlo para envío o retiro según zona

- `Producto enviado`:
  - correo al cliente informando despacho
  - si todavía no existe guía, el texto aclara que se informará luego

- `Producto listo para retiro`:
  - correo al cliente con instrucciones para retirar el reemplazo en ANYX

- `Realizado`, `Vencido`, `Cerrado`:
  - correo final de cierre al cliente con el contexto correspondiente

## Matriz de respuesta cuando el cliente consulta por su caso

Esta tabla no reemplaza los avisos proactivos por cambio de estado.

Se usa cuando entra un correo de seguimiento sobre un caso ya existente y `n8n` tiene que responderle al end user segun el estado actual del caso dentro de `Kingestion`.

- `Informado`:
  - "Su caso está recibido y en proceso de solución. Tiempo aproximado entre 5 y 45 días hábiles desde que recibió el primer mail informándole sobre el comienzo del trámite."

- `Aviso de envio`:
  - "A la espera de recepción del producto fallado enviado por Ud. Si aún no lo ha enviado por favor seguir las instrucciones enviadas en mail anterior. Muchas gracias."

- `Producto recepcionado y en preparacion`:
  - "Hemos recibido su producto fallado y estamos en proceso de enviarle el cambio correspondiente en caso de contar con disponibilidad local. Tendrá una actualización sobre su caso durante el transcurso de los próximos 10 días hábiles."

- `Pedido deposito y etiquetado`:
  - se adapta con el texto operativo heredado de `Pedido etiqueta / Pedido depósito`
  - "Producto en Anyx, en preparación. En los próximos 5 días hábiles tendrá novedades sobre el estado de su caso."

- `Pedido Kingston`:
  - "El producto nuevo necesario para cumplir con el cambio en gtia. NO se encuentra disponible en Argentina, por lo que ha sido solicitado a KINGSTON en EEUU. Le avisaremos por este medio cuando arribe a la Argentina en un plazo aproximado de 10 días hábiles."

- `Producto enviado`:
  - "Su reemplazo ha sido enviado. Corrobore con el Expreso el estado de su envío, los datos de su envío han sido enviados por e-mail."

- `Producto listo para retiro`:
  - "El producto/s esta/n listo/s para su retiro. Podrá pasar a realizar el cambio los días Lunes, Miércoles o Viernes (EXCEPTO FERIADOS) de 9 a 17 hs por Avenida San Isidro Labrador 4471 (C.A.B.A.). Por favor recuerde traer el/los producto/s fallado/s."

- `Realizado`:
  - "Producto cambiado con exito. RMA finalizado. Gracias por confiar en KINGSTON."

- `Vencido`:
  - "Caso VENCIDO ya que ha pasado el tiempo estipulado para obtener una respuesta de su parte. Si aún desea tramitar el cambio deberá volver a generar una nueva solicitud de RMA ante KINGSTON."

- `Cerrado`:
  - "Caso CERRADO por parte de KINGSTON. Cualquier consulta comunicarse nuevamente con KINGSTON."

- `OV creada`:
  - no se le envía correo al cliente
  - queda como estado interno de compras

## Adaptación al flujo actual de Kingestion

No se modifican estados ni transiciones de `Kingestion`.

La adaptación consiste en mapear los avisos del circuito viejo a los estados actuales:

- el antiguo aviso inicial al cliente ahora sale al crear un caso nuevo en `Kingestion`
- el antiguo `Aviso envio` sigue existiendo para `Interior / Gran Buenos Aires` y mantiene su correo con instrucciones + formulario
- el antiguo circuito de `Pedido a Kingston` se divide en un aviso interno de consolidación y un aviso externo de demora
- el antiguo `Pedido etiqueta` se adapta al estado actual `Pedido deposito y etiquetado`
- el antiguo `Pedido guia` no cambia el workflow actual: el aviso de despacho sale desde `Producto enviado` y contempla que la guía pueda cargarse después
- el antiguo `Producto listo para retiro` conserva su aviso al cliente dentro del estado actual homónimo
- la matriz heredada de consultas por estado se aplica solo a correos de seguimiento sobre casos existentes
- `OV creada` se mantiene como estado interno: no responde al cliente cuando consulta por mail

Colas automáticas cubiertas:

- `Pendientes servicio tecnico`: `Informado`, `Pedido deposito y etiquetado`
- `Pendientes compras`: `OV creada`, `Pedido Kingston`
- `Reintegros`: Interior / Gran Buenos Aires con reintegro pendiente

## Criterio de IA

La IA en este pack se usa para 4 cosas:

1. interpretar mails de Kingston y estructurarlos como datos
2. inferir faltantes razonables y dejarlos explicitados
3. redactar correos operativos claros en español usando la matriz heredada del SharePoint anterior
4. resolver pedidos del copiloto operativo contra la API de `Kingestion`
5. detectar si un adjunto recibido funciona como comprobante de pago o reintegro y adjuntarlo al caso correcto

No debería tomar decisiones irreversibles sola.

Recomendación operativa:

- mantener `allowWrites=false` en el copiloto mientras se valida
- pasar a `allowWrites=true` solo para usuarios o canales controlados
- usar aprobación humana si después querés que la IA archive o cierre casos

## Orden sugerido de implementación

1. importar `kingestion-01-ingesta-autorizaciones.json`
2. configurar `IMAP`, `SMTP` y `OpenAI`
3. probar con el `Manual Trigger`
4. activar `kingestion-02-seguimiento-operativo.json`
5. activar `kingestion-04-alertas-sla.json`
6. dejar `kingestion-03-copiloto-ia.json` primero en modo lectura

## Limitaciones actuales del pack

- la detección de stock y mayoristas todavía depende de datos cargados por operación o futuras integraciones
- el copiloto IA no gestiona usuarios ni permisos
- el pack no reemplaza aprobaciones humanas de compras, pagos o cierres terminales

## Siguiente etapa recomendada

Después de validar este pack, el paso natural es sumar:

- integración con un mailbox real de Kingston
- plantillas HTML de correo por estado
- webhook saliente desde `Kingestion` hacia `n8n` si más adelante querés dejar de depender del polling del piloto
- integración con ERP si querés cerrar completamente el circuito manual restante
