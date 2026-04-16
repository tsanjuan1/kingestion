create extension if not exists pgcrypto;

create table if not exists public.contact_requests (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  company text,
  phone text,
  team_size text,
  interest text not null check (interest in ('demo', 'diagnostico', 'implementacion')),
  challenge text not null,
  source text not null default 'website',
  status text not null default 'new',
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists contact_requests_created_at_idx
  on public.contact_requests (created_at desc);

alter table public.contact_requests enable row level security;
