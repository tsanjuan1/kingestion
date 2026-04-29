# Kingestion

Plataforma interna de ANYX para gestionar casos de RMA Kingston, con operación multiusuario, trazabilidad, workflow por zona, reportes y automatización lista para integrarse con `n8n`.

## Stack

- Next.js 16 + React 19
- Tailwind CSS v4
- PostgreSQL vía `pg`
- Vercel para despliegue
- `n8n` para automatización externa y correo

## Que trae hoy

- login con usuarios, roles y permisos
- gestión de casos abiertos, cerrados y archivados
- colas de `Reintegros`, `Pendientes compras` y `Pendientes servicio tecnico`
- historial y auditoría de acciones
- adjuntos y detalle operativo por caso
- API interna para automatización con `n8n`
- pack de workflows listo para importar en [docs/n8n/README.md](./docs/n8n/README.md)

## Variables de entorno

Copiar `.env.example` a `.env.local` y completar:

```env
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
DATABASE_URL="postgres://user:password@host:5432/kingestion"
KINGESTION_AUTOMATION_API_KEY="replace-with-a-long-random-string"
KINGESTION_AUTOMATION_ACTOR_EMAIL="automation@kingestion.local"
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

## n8n

El pack de automatización vive en `docs/n8n` e incluye:

- ingesta de mails de Kingston con IA
- seguimiento automático por cambios de estado
- copiloto operativo con IA
- recordatorios diarios de SLA

Ver guía completa en [docs/n8n/README.md](./docs/n8n/README.md).
