-- =====================================================================
-- دار السلع — marketplace spec, phase 1 (TEST project).
-- Runs after 0001_mobile_features.sql. Additive only.
--
-- 1. Listing statuses: pending / rejected / paused
-- 2. Stores (storefront entity) + public directory view
-- 3. Messaging with any seller (not only subscribed stores), unread, images, blocking
-- 4. Report reasons + reporting users and conversations
-- 5. Notifications on moderation changes
-- 6. Admin audit log for every admin action
-- 7. Admin management of categories; platform settings
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) Listing statuses
-- ---------------------------------------------------------------------
alter table public.listings drop constraint listings_status_check;
alter table public.listings add constraint listings_status_check
  check (status in ('draft', 'pending', 'active', 'paused', 'rejected', 'sold', 'reserved', 'expired', 'archived'));

-- Owners may not self-approve: only an admin can move a listing out of pending/rejected
-- or into rejected. Admin rejection and suspension both use 'rejected'
-- (attributes.moderation_status tells them apart). 'archived' stays owner-controlled
-- so the existing web app keeps working.
create or replace function public.guard_listing_status()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user not in ('anon', 'authenticated') or public.is_admin() then
    return new;
  end if;
  if new.status is distinct from old.status then
    -- pending may only go back to draft (owner withdraws it); approval is admin-only.
    if old.status = 'rejected' or (old.status = 'pending' and new.status <> 'draft') then
      raise exception 'LISTING_STATUS_LOCKED';
    end if;
    if new.status = 'rejected' then
      raise exception 'LISTING_STATUS_ADMIN_ONLY';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists listings_guard_status on public.listings;
create trigger listings_guard_status
  before update on public.listings
  for each row execute function public.guard_listing_status();

-- ---------------------------------------------------------------------
-- 2) Stores
-- ---------------------------------------------------------------------
create table if not exists public.stores (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.profiles(id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 80),
  description text check (description is null or char_length(description) <= 1000),
  logo_url text,
  cover_url text,
  location_id bigint references public.locations(id) on delete set null,
  phone text check (phone is null or char_length(phone) <= 30),
  whatsapp text check (whatsapp is null or char_length(whatsapp) <= 30),
  store_type text not null default 'small_shop' check (store_type in ('small_shop', 'merchant', 'supplier', 'service_provider')),
  status text not null default 'pending' check (status in ('pending', 'active', 'suspended')),
  is_featured boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.stores enable row level security;

create policy stores_select_active on public.stores
  for select using (status = 'active' or owner_id = auth.uid() or public.is_admin());
create policy stores_insert_own on public.stores
  for insert with check (owner_id = auth.uid() and status = 'pending' and not is_featured);
create policy stores_update_own on public.stores
  for update using (owner_id = auth.uid() or public.is_admin()) with check (owner_id = auth.uid() or public.is_admin());
create policy stores_delete_admin on public.stores
  for delete using (public.is_admin());

create or replace function public.guard_store_admin_fields()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if current_user in ('anon', 'authenticated') and not public.is_admin()
     and (new.status is distinct from old.status or new.is_featured is distinct from old.is_featured or new.owner_id is distinct from old.owner_id) then
    raise exception 'STORE_FIELD_ADMIN_ONLY';
  end if;
  return new;
end;
$$;

create trigger stores_guard_admin_fields
  before update on public.stores
  for each row execute function public.guard_store_admin_fields();
create trigger stores_updated_at
  before update on public.stores
  for each row execute function public.set_updated_at();

-- Directory of active stores (replaces the subscription-only view from 0001).
create or replace view public.public_stores
with (security_invoker = true) as
select
  s.owner_id as merchant_id,
  s.name,
  coalesce(
    (select ms.max_products from public.merchant_subscriptions ms
      where ms.user_id = s.owner_id and ms.status = 'active' order by ms.created_at desc limit 1),
    50
  ) as max_products,
  s.id as store_id,
  s.description,
  s.logo_url,
  s.cover_url,
  s.location_id,
  s.phone,
  s.whatsapp,
  s.store_type,
  s.is_featured,
  s.created_at
from public.stores s
where s.status = 'active';

grant select on public.public_stores to anon, authenticated;

-- ---------------------------------------------------------------------
-- 3) Messaging: any buyer ↔ any seller of an active listing
-- ---------------------------------------------------------------------
create table if not exists public.user_blocks (
  blocker_user_id uuid not null references public.profiles(id) on delete cascade,
  blocked_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_user_id, blocked_user_id),
  check (blocker_user_id <> blocked_user_id)
);
alter table public.user_blocks enable row level security;
create policy user_blocks_own on public.user_blocks
  for all using (blocker_user_id = auth.uid()) with check (blocker_user_id = auth.uid());

create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_blocks
    where (blocker_user_id = a and blocked_user_id = b) or (blocker_user_id = b and blocked_user_id = a)
  );
$$;

drop policy store_conversations_insert_buyer on public.store_conversations;
create policy store_conversations_insert_buyer on public.store_conversations
  for insert with check (
    buyer_user_id = auth.uid()
    and status = 'active'
    and not public.is_blocked_between(buyer_user_id, merchant_user_id)
    and exists (
      select 1 from public.listings l
      where l.id = store_conversations.listing_id
        and l.status = 'active'
        and l.user_id = store_conversations.merchant_user_id
    )
  );
create policy store_conversations_update_participants on public.store_conversations
  for update using (auth.uid() in (buyer_user_id, merchant_user_id))
  with check (auth.uid() in (buyer_user_id, merchant_user_id));

alter table public.store_messages add column if not exists image_url text;
alter table public.store_messages drop constraint if exists store_messages_body_check;
alter table public.store_messages add constraint store_messages_body_check
  check (char_length(btrim(body)) between 1 and 2000 or (image_url is not null and char_length(body) <= 2000));

drop policy store_messages_insert_participant on public.store_messages;
create policy store_messages_insert_participant on public.store_messages
  for insert with check (
    sender_user_id = auth.uid()
    and read_at is null
    and exists (
      select 1 from public.store_conversations c
      where c.id = store_messages.conversation_id
        and c.status = 'active'
        and auth.uid() in (c.buyer_user_id, c.merchant_user_id)
        and not public.is_blocked_between(c.buyer_user_id, c.merchant_user_id)
    )
  );
-- The recipient marks messages as read (only read_at may change; enforced by trigger).
create policy store_messages_mark_read on public.store_messages
  for update using (
    sender_user_id <> auth.uid()
    and exists (select 1 from public.store_conversations c where c.id = store_messages.conversation_id and auth.uid() in (c.buyer_user_id, c.merchant_user_id))
  ) with check (sender_user_id <> auth.uid());

create or replace function public.guard_message_update()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  if new.body is distinct from old.body or new.image_url is distinct from old.image_url
     or new.sender_user_id is distinct from old.sender_user_id or new.conversation_id is distinct from old.conversation_id then
    raise exception 'MESSAGE_IMMUTABLE';
  end if;
  return new;
end;
$$;
create trigger store_messages_guard_update
  before update on public.store_messages
  for each row execute function public.guard_message_update();

-- ---------------------------------------------------------------------
-- 4) Reports: reasons, users, conversations
-- ---------------------------------------------------------------------
alter table public.report_cases
  add column if not exists reason text not null default 'other'
    check (reason in ('fraud', 'misleading', 'inappropriate', 'suspicious_seller', 'prohibited', 'abuse', 'other')),
  add column if not exists reported_user_id uuid references public.profiles(id) on delete set null,
  add column if not exists conversation_id uuid references public.store_conversations(id) on delete set null;

-- ---------------------------------------------------------------------
-- 5) Notifications on moderation
-- ---------------------------------------------------------------------
create or replace function public.on_listing_moderated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status and auth.uid() is distinct from new.user_id then
    if new.status = 'active' and old.status in ('pending', 'rejected') then
      insert into public.notifications (user_id, type, title, body, listing_id)
      values (new.user_id, 'listing_approved', 'listing_approved', left(coalesce(new.title, ''), 140), new.id);
    elsif new.status = 'rejected' then
      insert into public.notifications (user_id, type, title, body, listing_id)
      values (new.user_id,
              case when new.attributes->>'moderation_status' = 'suspended' then 'listing_suspended' else 'listing_rejected' end,
              case when new.attributes->>'moderation_status' = 'suspended' then 'listing_suspended' else 'listing_rejected' end,
              left(coalesce(new.attributes->>'moderation_reason', new.title, ''), 300), new.id);
    end if;
  end if;
  return new;
end;
$$;

create trigger listings_notify_moderation
  after update on public.listings
  for each row execute function public.on_listing_moderated();

-- Chat notifications store a type key; the app shows the translated title.
create or replace function public.on_store_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  conv public.store_conversations%rowtype;
  recipient uuid;
begin
  select * into conv from public.store_conversations where id = new.conversation_id;
  update public.store_conversations set updated_at = now() where id = new.conversation_id;
  recipient := case when new.sender_user_id = conv.buyer_user_id then conv.merchant_user_id else conv.buyer_user_id end;
  insert into public.notifications (user_id, type, title, body, listing_id)
  values (recipient, 'chat_message', 'chat_message', left(coalesce(nullif(new.body, ''), '📷'), 140), conv.listing_id);
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- 6) Admin audit log
-- ---------------------------------------------------------------------
create table if not exists public.admin_audit_logs (
  id bigint generated by default as identity primary key,
  admin_user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_table text not null,
  target_id text,
  before_data jsonb,
  after_data jsonb,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_logs_created_idx on public.admin_audit_logs (created_at desc);
alter table public.admin_audit_logs enable row level security;
create policy admin_audit_logs_select_admin on public.admin_audit_logs
  for select using (public.is_admin());
-- No insert/update/delete policy: rows are written only by the trigger below.

create or replace function public.log_admin_action()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  row_owner uuid;
  target text;
begin
  if not public.is_admin() then
    return coalesce(new, old);
  end if;
  -- Skip an admin editing their own content as a normal user.
  -- jsonb access so one function works for tables with different columns.
  row_owner := nullif(case tg_table_name
    when 'listings' then coalesce(to_jsonb(new)->>'user_id', to_jsonb(old)->>'user_id')
    when 'stores' then coalesce(to_jsonb(new)->>'owner_id', to_jsonb(old)->>'owner_id')
    else null end, '')::uuid;
  if row_owner is not null and row_owner = auth.uid() then
    return coalesce(new, old);
  end if;
  target := coalesce(to_jsonb(new)->>'id', to_jsonb(old)->>'id');
  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, before_data, after_data)
  values (auth.uid(), lower(tg_op), tg_table_name, target,
          case when tg_op <> 'INSERT' then to_jsonb(old) end,
          case when tg_op <> 'DELETE' then to_jsonb(new) end);
  return coalesce(new, old);
end;
$$;

create trigger listings_admin_audit after update or delete on public.listings
  for each row execute function public.log_admin_action();
create trigger stores_admin_audit after update or delete on public.stores
  for each row execute function public.log_admin_action();
create trigger profiles_admin_audit after update on public.profiles
  for each row execute function public.log_admin_action();
create trigger report_cases_admin_audit after update on public.report_cases
  for each row execute function public.log_admin_action();
create trigger merchant_subscriptions_admin_audit after insert or update or delete on public.merchant_subscriptions
  for each row execute function public.log_admin_action();

-- ---------------------------------------------------------------------
-- 7) Categories management + platform settings
-- ---------------------------------------------------------------------
create policy categories_admin_select on public.categories
  for select using (public.is_admin());
create policy categories_admin_write on public.categories
  for all using (public.is_admin()) with check (public.is_admin());
create trigger categories_admin_audit after insert or update or delete on public.categories
  for each row execute function public.log_admin_action();

create table if not exists public.platform_settings (
  key text primary key check (key ~ '^[a-z0-9_]{2,60}$'),
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.platform_settings enable row level security;
create policy platform_settings_select_all on public.platform_settings
  for select using (true);
create policy platform_settings_admin_write on public.platform_settings
  for all using (public.is_admin()) with check (public.is_admin());
create trigger platform_settings_admin_audit after insert or update or delete on public.platform_settings
  for each row execute function public.log_admin_action();

insert into public.platform_settings (key, value) values
  ('announcement', '{"ar": "", "en": ""}'::jsonb),
  ('listing_auto_publish', 'true'::jsonb)
on conflict (key) do nothing;
