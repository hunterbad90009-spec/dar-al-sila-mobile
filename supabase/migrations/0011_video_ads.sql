-- 0011: Paid video ads in the home-page banner.
-- Flow: a company pays Dar Al Sila outside the app -> an admin confirms the payment,
-- uploads the video and sets the company, contact link and dates -> the video shows in
-- the home banner while it is active, paid and inside its dates.
-- Only admins can read the full rows (amount, payment note). Visitors get the live ads
-- through live_video_ads(), which returns just what the banner needs.

create table if not exists public.video_ads (
  id uuid primary key default gen_random_uuid(),
  company_name text not null check (char_length(btrim(company_name)) between 2 and 80),
  contact_url text check (contact_url is null or contact_url ~* '^(https://|tel:\+?[0-9]{6,15}$|mailto:)'),
  video_url text not null check (video_url ~* '^https://'),
  video_path text not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  is_active boolean not null default true,
  payment_confirmed boolean not null default false,
  amount_omr numeric(10, 3) check (amount_omr is null or amount_omr >= 0),
  payment_note text check (payment_note is null or char_length(payment_note) <= 500),
  created_by uuid default auth.uid() references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists video_ads_live_idx on public.video_ads (starts_at, ends_at) where is_active and payment_confirmed;

alter table public.video_ads enable row level security;
drop policy if exists video_ads_admin_all on public.video_ads;
create policy video_ads_admin_all on public.video_ads for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke all on public.video_ads from anon, authenticated;
grant select, insert, update, delete on public.video_ads to authenticated;

create or replace function public.touch_video_ad()
returns trigger language plpgsql set search_path = public
as $$ begin new.updated_at := now(); return new; end $$;
drop trigger if exists video_ads_touch on public.video_ads;
create trigger video_ads_touch before update on public.video_ads
  for each row execute function public.touch_video_ad();

drop trigger if exists video_ads_admin_audit on public.video_ads;
create trigger video_ads_admin_audit after insert or update or delete on public.video_ads
  for each row execute function public.log_admin_action();

-- Daily views / clicks per ad (kept apart so counting never touches the audit log).
create table if not exists public.video_ad_stats (
  ad_id uuid not null references public.video_ads(id) on delete cascade,
  day date not null default (now() at time zone 'Asia/Muscat')::date,
  views bigint not null default 0,
  clicks bigint not null default 0,
  primary key (ad_id, day)
);
alter table public.video_ad_stats enable row level security;
drop policy if exists video_ad_stats_admin_select on public.video_ad_stats;
create policy video_ad_stats_admin_select on public.video_ad_stats for select to authenticated using (public.is_admin());
revoke all on public.video_ad_stats from anon, authenticated;
grant select on public.video_ad_stats to authenticated;

-- What the home banner shows: live ads only, public columns only.
create or replace function public.live_video_ads()
returns table (id uuid, company_name text, contact_url text, video_url text)
language sql stable security definer set search_path = public
as $$
  select a.id, a.company_name, a.contact_url, a.video_url
  from public.video_ads a
  where a.is_active and a.payment_confirmed and now() >= a.starts_at and now() < a.ends_at
  order by a.starts_at, a.id
  limit 10
$$;

-- Count a view or a click. Only live ads are counted; the app counts each ad once per
-- visit, so the numbers are a fair guide (not an audited figure).
create or replace function public.record_video_ad_event(p_ad uuid, p_kind text)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  if p_kind not in ('view', 'click') then return; end if;
  if not exists (select 1 from public.video_ads a where a.id = p_ad and a.is_active and a.payment_confirmed
                 and now() >= a.starts_at and now() < a.ends_at) then return; end if;
  insert into public.video_ad_stats as s (ad_id, views, clicks)
  values (p_ad, case when p_kind = 'view' then 1 else 0 end, case when p_kind = 'click' then 1 else 0 end)
  on conflict (ad_id, day) do update
    set views = s.views + excluded.views, clicks = s.clicks + excluded.clicks;
end;
$$;

revoke all on function public.live_video_ads(), public.record_video_ad_event(uuid, text) from public;
grant execute on function public.live_video_ads(), public.record_video_ad_event(uuid, text) to anon, authenticated;

-- Storage: public bucket for the ad videos; only admins may add, replace or delete files.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('ad-videos', 'ad-videos', true, 52428800, array['video/mp4', 'video/quicktime', 'video/webm'])
on conflict (id) do update
  set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists ad_videos_admin_select on storage.objects;
create policy ad_videos_admin_select on storage.objects for select to authenticated
  using (bucket_id = 'ad-videos' and public.is_admin());
drop policy if exists ad_videos_admin_insert on storage.objects;
create policy ad_videos_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'ad-videos' and public.is_admin());
drop policy if exists ad_videos_admin_update on storage.objects;
create policy ad_videos_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'ad-videos' and public.is_admin()) with check (bucket_id = 'ad-videos' and public.is_admin());
drop policy if exists ad_videos_admin_delete on storage.objects;
create policy ad_videos_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'ad-videos' and public.is_admin());
