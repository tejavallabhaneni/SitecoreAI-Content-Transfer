-- Run once in a dedicated Supabase PostgreSQL project using the SQL editor.
-- No credentials are stored in this table. Service role key remains server-only.
create extension if not exists pgcrypto;

create table if not exists public.transfer_jobs (
  id uuid primary key default gen_random_uuid(),
  owner_login text not null check (owner_login ~ '^[a-z0-9-]{1,39}$'),
  source_host text not null,
  destination_host text not null,
  item_path text not null,
  scope text not null check (scope in ('SingleItem','ItemAndDescendants')),
  merge_strategy text not null check (merge_strategy in ('KeepExistingItem','OverrideExistingItem')),
  status text not null default 'pending_preflight'
    check (status in ('pending_preflight','queued','running','succeeded','failed')),
  operation_id uuid,
  progress integer not null default 0 check (progress between 0 and 100),
  completed_chunks integer not null default 0,
  total_chunks integer not null default 0,
  transfer_files jsonb not null default '[]'::jsonb,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (source_host <> destination_host)
);

create index if not exists transfer_jobs_owner_created
  on public.transfer_jobs(owner_login, created_at desc);

create table if not exists public.transfer_events (
  id bigint generated always as identity primary key,
  transfer_id uuid not null references public.transfer_jobs(id) on delete cascade,
  occurred_at timestamptz not null default now(),
  event_type text not null,
  details jsonb not null default '{}'::jsonb
);

create index if not exists transfer_events_transfer_created
  on public.transfer_events(transfer_id, occurred_at desc);

alter table public.transfer_jobs enable row level security;
alter table public.transfer_events enable row level security;
revoke all on public.transfer_jobs from anon, authenticated;
revoke all on public.transfer_events from anon, authenticated;

-- Future execution requires a separate verified preflight and an atomic
-- lease/claim mechanism. Do not manually queue drafts in production.
