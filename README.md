# Kingestion

Landing inicial para `Kingestion`, pensada para desplegarse en Vercel y guardar leads comerciales en Supabase.

## Stack

- Next.js 16 + React 19
- Tailwind CSS v4
- Supabase para persistencia de contactos
- Vercel para despliegue

## Que trae esta primera version

- hero full-bleed con identidad visual propia
- secciones de propuesta, flujo y alcance
- formulario de contacto con validacion y API route
- migracion SQL para crear la tabla `contact_requests`
- estructura lista para iterar y seguir publicando

## Variables de entorno

Copiar `.env.example` a `.env.local` y completar:

```env
NEXT_PUBLIC_SITE_URL="http://localhost:3000"
NEXT_PUBLIC_SUPABASE_URL="https://your-project.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="your-anon-key"
SUPABASE_SERVICE_ROLE_KEY="your-service-role-key"
```

## Instalacion local

```bash
npm install
npm run dev
```

## Supabase

1. Crear un proyecto nuevo en Supabase para `kingestion`.
2. Copiar `Project URL`, `anon key` y `service_role key`.
3. Completar `.env.local`.
4. Aplicar la migracion SQL ubicada en `supabase/migrations/20260416173000_init.sql`.

Si se usa CLI:

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase db push
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
