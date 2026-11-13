-- Apply after db/schema.sql in the dedicated Supabase PostgreSQL project.
alter table public.transfer_jobs
  add column if not exists preflight_details jsonb,
  add column if not exists preflight_verified_at timestamptz,
  add column if not exists approved_at timestamptz,
  add column if not exists worker_id text,
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists attempts integer not null default 0;

-- Only a trusted server with the service role can reserve a queued job.
-- IMPORTANT: A crashed running job is NOT automatically reclaimed, because
-- blindly retrying an import risks duplicating or overwriting content.
create or replace function public.claim_next_transfer_job(worker_name text)
returns setof public.transfer_jobs
language plpgsql
security definer
set search_path = public
as $$
begin
  if worker_name is null or length(worker_name) < 1 or length(worker_name) > 128 then
    raise exception 'Invalid worker identity';
  end if;
  return query
  with selected as (
    select id from public.transfer_jobs
    where status = 'queued'
      and approved_at is not null
      and preflight_verified_at is not null
      and approved_at >= preflight_verified_at
      and approved_at <= preflight_verified_at + interval '10 minutes'
    order by created_at asc
    for update skip locked
    limit 1
  )
  update public.transfer_jobs j
  set status = 'running',
      worker_id = worker_name,
      started_at = now(),
      updated_at = now(),
      attempts = j.attempts + 1
  from selected s
  where j.id = s.id
  returning j.*;
end;
$$;

revoke all on function public.claim_next_transfer_job(text) from public, anon, authenticated;
grant execute on function public.claim_next_transfer_job(text) to service_role;
