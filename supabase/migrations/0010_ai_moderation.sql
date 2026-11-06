-- 0010: Trust & Safety, phase 3 — AI review of listings (text + up to 4 photos).
-- Modes (platform_settings.ai_moderation): "off" | "shadow" | "enforce".
--   shadow : the AI verdict is only recorded for admins.
--   enforce: a published listing the AI flags is moved to the review queue (pending).
--            The AI never rejects on its own; an admin always makes the final decision.
-- Flow: listing published / content edited -> job row (with a random per-job token)
--   -> pg_net calls the `ai-moderate` Edge Function -> the function checks the token,
--   calls the model, stores the result, applies it only if the listing is unchanged.
-- A cron job re-sends stuck jobs (max 3 attempts). Failures never publish or hide anything.

create extension if not exists pg_net;
create extension if not exists pg_cron;

insert into public.platform_settings (key, value) values ('ai_moderation', '"off"'::jsonb)
on conflict (key) do nothing;

create table if not exists private.ai_config (key text primary key, value text not null);
insert into private.ai_config (key, value)
values ('function_url', 'https://bscxvbvrepmkqbhayxsi.supabase.co/functions/v1/ai-moderate')
on conflict (key) do nothing;

-- Jobs: readable/writable only by the service role (the Edge Function); RLS on, no grants.
create table if not exists public.ai_moderation_jobs (
  id bigint generated always as identity primary key,
  listing_id uuid not null references public.listings(id) on delete cascade,
  listing_updated_at timestamptz not null,
  token text not null default encode(extensions.gen_random_bytes(24), 'hex'),
  status text not null default 'queued' check (status in ('queued', 'sent', 'done', 'failed', 'stale', 'skipped')),
  attempts int not null default 0,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (listing_id, listing_updated_at)
);
alter table public.ai_moderation_jobs enable row level security;
revoke all on public.ai_moderation_jobs from anon, authenticated;

-- Results: admins can read; written only by the service role.
create table if not exists public.ai_moderation_results (
  id bigint generated always as identity primary key,
  listing_id uuid not null references public.listings(id) on delete cascade,
  job_id bigint references public.ai_moderation_jobs(id) on delete set null,
  listing_updated_at timestamptz,
  mode text not null,
  model text,
  verdict text not null check (verdict in ('ok', 'review', 'reject', 'error')),
  confidence numeric,
  categories text[] not null default '{}',
  reason text,
  applied boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists ai_results_listing_idx on public.ai_moderation_results (listing_id, created_at desc);
alter table public.ai_moderation_results enable row level security;
drop policy if exists ai_results_admin_select on public.ai_moderation_results;
create policy ai_results_admin_select on public.ai_moderation_results for select to authenticated using (public.is_admin());
revoke all on public.ai_moderation_results from anon, authenticated;
grant select on public.ai_moderation_results to authenticated;

create or replace function private.ai_mode()
returns text language sql stable security definer set search_path = public
as $$ select coalesce((select value #>> '{}' from public.platform_settings where key = 'ai_moderation'), 'off') $$;

-- Send one job to the Edge Function (async; pg_net runs after commit).
create or replace function private.ai_dispatch(p_job bigint)
returns void
language plpgsql security definer set search_path = public
as $$
declare j public.ai_moderation_jobs; url text;
begin
  select * into j from public.ai_moderation_jobs where id = p_job;
  select value into url from private.ai_config where key = 'function_url';
  if j.id is null or url is null then return; end if;
  update public.ai_moderation_jobs set status = 'sent', attempts = attempts + 1, updated_at = now() where id = p_job;
  perform net.http_post(
    url := url,
    body := jsonb_build_object('job_id', j.id, 'token', j.token),
    headers := jsonb_build_object('Content-Type', 'application/json'),
    timeout_milliseconds := 30000);
end;
$$;

-- Queue a check when a listing is published or its content changes.
create or replace function private.ai_enqueue_listing()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  keys text[] := public.ts_moderation_keys();
  job_id bigint;
begin
  if private.ai_mode() = 'off' or new.status not in ('active', 'pending') then return new; end if;
  if tg_op = 'UPDATE' and old.status not in ('draft', 'rejected')
     and new.title is not distinct from old.title
     and new.description is not distinct from old.description
     and new.price is not distinct from old.price
     and new.category_id is not distinct from old.category_id
     and (coalesce(new.attributes, '{}'::jsonb) - keys - 'version') is not distinct from (coalesce(old.attributes, '{}'::jsonb) - keys - 'version') then
    return new;
  end if;
  insert into public.ai_moderation_jobs (listing_id, listing_updated_at)
  values (new.id, new.updated_at)
  on conflict (listing_id, listing_updated_at) do nothing
  returning id into job_id;
  if job_id is not null then perform private.ai_dispatch(job_id); end if;
  return new;
end;
$$;

drop trigger if exists listings_ai_enqueue on public.listings;
create trigger listings_ai_enqueue after insert or update on public.listings
  for each row execute function private.ai_enqueue_listing();

-- Re-send jobs that did not finish (Edge Function down, timeout...). Max 3 attempts.
create or replace function private.ai_retry_stuck()
returns void
language plpgsql security definer set search_path = public
as $$
declare j record;
begin
  update public.ai_moderation_jobs set status = 'failed', last_error = coalesce(last_error, 'max attempts'), updated_at = now()
  where status in ('queued', 'sent') and attempts >= 3 and updated_at < now() - interval '3 minutes';
  for j in select id from public.ai_moderation_jobs
           where status in ('queued', 'sent') and attempts < 3 and updated_at < now() - interval '3 minutes'
           order by id limit 20 loop
    perform private.ai_dispatch(j.id);
  end loop;
end;
$$;

select cron.unschedule(jobid) from cron.job where jobname = 'ai-moderation-retry';
select cron.schedule('ai-moderation-retry', '*/5 * * * *', $$select private.ai_retry_stuck()$$);

revoke all on function private.ai_mode(), private.ai_dispatch(bigint), private.ai_enqueue_listing(), private.ai_retry_stuck() from public, anon, authenticated;

-- The server role (used only by the Edge Function) gets just what the check needs.
grant usage on schema public to service_role;
grant select on public.listings, public.listing_media, public.categories, public.platform_settings to service_role;
grant update (status, attributes) on public.listings to service_role;
grant insert on public.notifications to service_role;
grant select, update on public.ai_moderation_jobs to service_role;
grant insert on public.ai_moderation_results to service_role;
grant usage on all sequences in schema public to service_role;
