# Kingestion

Plataforma interna de ANYX para gestionar casos de RMA Kingston, con operación multiusuario, trazabilidad, workflow por zona, reportes y automatización nativa de correos desde Kingestion.

## Stack

- Next.js 16 + React 19
- Tailwind CSS v4
- PostgreSQL vía `pg`
- Vercel para despliegue
- Automatización nativa de correo con IMAP/SMTP desde Kingestion

## Que trae hoy

- login con usuarios, roles y permisos
- gestión de casos abiertos, cerrados y archivados
- colas de `Reintegros`, `Pendientes compras` y `Pendientes servicio tecnico`
- historial y auditoría de acciones
- adjuntos y detalle operativo por caso
- modulo `Correo` con lectura IMAP de la carpeta `Casos kingston` y respuesta por SMTP
- API interna para automatización nativa de correos y avisos por estado
- pack histórico de workflows en [docs/n8n/README.md](./docs/n8n/README.md), mantenido solo como referencia

## Variables de entorno

Copiar `.env.example` a `.env.local` y completar:

```env
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
DATABASE_URL="postgres://user:password@host:5432/kingestion"
KINGESTION_DB_POOL_MAX="1"
KINGESTION_DB_RUNTIME_ROLE="kingestion_app"
KINGESTION_AUTOMATION_API_KEY="replace-with-a-long-random-string"
KINGESTION_AUTOMATION_EXTRA_KEYS=""
KINGESTION_AUTOMATION_ACTOR_EMAIL="automation@kingestion.local"
KINGESTION_AUTOMATION_PILOT_MODE="true"
KINGESTION_AUTOMATION_PROOF_AI="true"
KINGESTION_AI_API_KEY=""
GROQ_API_KEY=""
KINGESTION_AI_MODEL="llama-3.3-70b-versatile"
CRON_SECRET="replace-with-a-long-random-string"
KINGESTION_PURCHASING_EMAIL="compras@anyx.com.ar"
KINGESTION_TECH_EMAIL="serviciotecnico@anyx.com.ar"
KINGESTION_KINGSTON_REQUEST_EMAIL="gdelcastillo@anyx.com.ar"
KINGESTION_REIMBURSEMENT_CC_EMAIL="debora@anyx.com.ar"
KINGESTION_CUSTOMER_FORM_URL=""
KINGESTION_PICKUP_ADDRESS="Sucursal ANYX"
KINGESTION_MAIL_PROVIDER="imap-smtp"
KINGESTION_MAIL_USER="tsanjuan@innovexa.com.ar"
KINGESTION_MAIL_PASSWORD="app-password"
KINGESTION_MAIL_FROM="tsanjuan@innovexa.com.ar"
KINGESTION_MAIL_KINGSTON_FOLDER="Casos kingston"
KINGESTION_MS_TENANT_ID=""
KINGESTION_MS_CLIENT_ID=""
KINGESTION_MS_CLIENT_SECRET=""
KINGESTION_MS_SHARED_MAILBOX=""
KINGESTION_MAIL_IMAP_HOST="imap.gmail.com"
KINGESTION_MAIL_IMAP_PORT="993"
KINGESTION_MAIL_IMAP_SECURE="true"
KINGESTION_MAIL_SMTP_HOST="smtp.gmail.com"
KINGESTION_MAIL_SMTP_PORT="465"
KINGESTION_MAIL_SMTP_SECURE="true"
KINGESTION_MAIL_AUTOMATION_LIMIT="40"
KINGESTION_EMAIL_OUTBOX_LIMIT="20"
KINGESTION_EMAIL_SENDING_STALE_SECONDS="1200"
KINGESTION_EMAIL_MAX_ATTEMPTS="5"
KINGESTION_TRUSTED_AUTHORIZATION_SENDERS="@anyx.com.ar,@innovexa.com.ar,@kingston.com"
KINGESTION_ATTACHMENT_MAX_BYTES="15728640"
KINGESTION_AUTOMATION_LOCK_SECONDS="600"
```

## Instalacion local

```bash
npm install
npm run dev
```

## GitHub

Repositorio sugerido:

```bash
gh repo create tsanjuan1/kingestion --public --source=. --remote=origin --push
```

## Vercel

1. Crear o enlazar el proyecto `kingestion`.
2. Cargar las variables de entorno.
3. Desplegar.

Comandos utiles:

```bash
vercel project add
vercel --prod
```

## Automatizacion nativa

Kingestion procesa directamente la carpeta configurada en `KINGESTION_MAIL_KINGSTON_FOLDER`:

- lee correos de autorizacion y seguimiento desde IMAP
- crea casos nuevos sin duplicar tickets Kingston
- actualiza casos existentes y copia internamente los adjuntos detectados
- interpreta correos no estandar con IA si `KINGESTION_AI_API_KEY` o `GROQ_API_KEY` esta configurada
- encola los correos con clave idempotente antes de enviarlos, para evitar duplicados y permitir reintentos
- corta los reintentos despues de `KINGESTION_EMAIL_MAX_ATTEMPTS` y deja el fallo visible en auditoria
- solo envia el primer aviso automatico al cliente si el remitente de autorizacion esta dentro de `KINGESTION_TRUSTED_AUTHORIZATION_SENDERS`
- responde desde el SMTP configurado y marca el correo original como respondido cuando el envio fue exitoso
- envia avisos automaticos al cambiar estados, excepto estados configurados sin aviso al cliente
- registra en auditoria los casos que superan SLA para revision manual antes de marcarlos como vencidos
- respeta el boton de pausa/reanudacion del panel de automatizacion

En el plan gratuito de Vercel, Kingestion usa un heartbeat interno: cada vez que un usuario autenticado entra a la plataforma ejecuta una revision, y mientras la plataforma queda abierta vuelve a revisar cada 15 minutos si la pestaña esta visible. El endpoint `/api/automation/trigger/kingston-rma` queda disponible para cron externo o Vercel Pro, protegido por `CRON_SECRET`.

## n8n historico

El pack anterior vive en `docs/n8n` e incluye:

- ingesta de mails de Kingston con IA
- seguimiento automático por cambios de estado
- copiloto operativo con IA
- recordatorios diarios de SLA

Ver guía completa en [docs/n8n/README.md](./docs/n8n/README.md). Ya no es necesario para el flujo activo de Kingestion.

## Panel de automatizacion

La operación actual recomendada queda 100% en Kingestion:

- `Kingestion` mantiene casos, adjuntos, auditoría y permisos
- el motor nativo ejecuta la ingesta horaria de correos y los avisos por estado cuando lo dispara el heartbeat o el boton manual
- la vista `Configuracion > Automatizacion` permite:
  - pausar o reanudar manualmente el piloto
  - disparar una corrida manual del motor nativo
  - verificar si el piloto está en modo prueba y si la IA para comprobantes está habilitada

Variables nuevas útiles:

- `KINGESTION_AUTOMATION_PILOT_MODE`
- `KINGESTION_AUTOMATION_PROOF_AI`
- `CRON_SECRET`
- `KINGESTION_MAIL_AUTOMATION_LIMIT`
- `KINGESTION_EMAIL_OUTBOX_LIMIT`
- `KINGESTION_EMAIL_SENDING_STALE_SECONDS`
- `KINGESTION_EMAIL_MAX_ATTEMPTS`
- `KINGESTION_TRUSTED_AUTHORIZATION_SENDERS`
- `KINGESTION_AI_API_KEY` o `GROQ_API_KEY`
- `KINGESTION_AI_MODEL`
- `KINGESTION_ATTACHMENT_MAX_BYTES`
- `KINGESTION_DB_POOL_MAX`
- `KINGESTION_DB_RUNTIME_ROLE`
- `KINGESTION_AUTOMATION_LOCK_SECONDS`

No hay ejecución local dentro del flujo activo: la automatización corre desde Kingestion/Vercel.
