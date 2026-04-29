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
KINGSTON_RMA_TO="rma@kingston.com"
```

Credenciales a crear en `n8n`:

- `IMAP` para leer el buzón de Kingston o el buzón intermediario
- `SMTP` para enviar correos
- `OpenAI` para los nodos de interpretación y redacción

## Mapeo del proceso al diagrama

Estado inicial:

- llega mail de Kingston
- `n8n` interpreta contenido con IA
- crea o actualiza caso
- responde a Kingston
- responde al end user según zona

Interior / Gran Buenos Aires:

- `Informado`
- `Aviso de envio`
- `Producto recepcionado y en preparacion`
- `Pedido Kingston` si no hay stock local ni mayorista
- `Pedido deposito y etiquetado`
- `Liberar mercaderia`
- `OV creada`
- `Pedido guia`
- `Producto enviado`
- `Realizado` o `Vencido` o `Cerrado`

Capital / AMBA:

- `Informado`
- `Producto recepcionado y en preparacion`
- `Pedido Kingston` si no hay stock local ni mayorista
- `Pedido deposito y etiquetado`
- `Liberar mercaderia`
- `OV creada`
- `Producto listo para retiro`
- `Realizado` o `Vencido` o `Cerrado`

Colas automáticas cubiertas:

- `Pendientes servicio tecnico`: `Informado`, `Pedido deposito y etiquetado`
- `Pendientes compras`: `Liberar mercaderia`, `OV creada`
- `Reintegros`: Interior / Gran Buenos Aires con reintegro pendiente

## Criterio de IA

La IA en este pack se usa para 4 cosas:

1. interpretar mails de Kingston y estructurarlos como datos
2. inferir faltantes razonables y dejarlos explicitados
3. redactar correos operativos claros en español
4. resolver pedidos del copiloto operativo contra la API de `Kingestion`

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
- un webhook saliente desde `Kingestion` hacia `n8n` para no depender de polling
- integración con ERP o SharePoint si querés cerrar completamente el circuito manual
