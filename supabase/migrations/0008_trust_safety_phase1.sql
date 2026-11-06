-- 0008: Trust & Safety, phase 1
-- (a) Server-side listing checks: prohibited terms, fraud phrases, external links, duplicates.
--     They run inside the database when a listing is published or its content changes, so the
--     app cannot be bypassed. Clean listings publish at once; a clear violation is rejected with
--     a reason; a doubtful one waits in the admin review queue. Admin edits are not re-checked.
-- (b) Account suspensions: temporary or permanent, enforced by RLS (no posting, messaging,
--     stores or ratings; listings hidden), set only by admins through audited functions.

-- ---------------------------------------------------------------------------
-- (a) Listing checks
-- ---------------------------------------------------------------------------

-- Arabic-aware normalisation: lower case, unify alef/ya/ta-marbuta, drop tatweel and harakat.
create or replace function public.ts_normalize(t text)
returns text language sql immutable set search_path = public
as $$ select regexp_replace(translate(lower(coalesce(t, '')), 'أإآٱىةـ', 'اااايه'), '[ًٌٍَُِّْ]', '', 'g') $$;

create table if not exists private.moderation_terms (
  term text primary key,                       -- stored normalised
  action text not null check (action in ('reject', 'review')),
  code text not null                           -- prohibited | fraud
);

insert into private.moderation_terms (term, action, code)
select public.ts_normalize(t), a, c from (values
  ('سلاح','reject','prohibited'), ('أسلحة','reject','prohibited'), ('ذخيرة','reject','prohibited'),
  ('مسدس','reject','prohibited'), ('بندقية','reject','prohibited'), ('مخدرات','reject','prohibited'),
  ('حشيش','reject','prohibited'), ('كوكايين','reject','prohibited'), ('هيروين','reject','prohibited'),
  ('حبوب مخدرة','reject','prohibited'), ('إباحي','reject','prohibited'), ('دعارة','reject','prohibited'),
  ('تزوير','reject','prohibited'), ('جواز سفر للبيع','reject','prohibited'), ('بطاقات ائتمان مسروقة','reject','prohibited'),
  ('weapon','reject','prohibited'), ('firearm','reject','prohibited'), ('ammo','reject','prohibited'),
  ('cocaine','reject','prohibited'), ('heroin','reject','prohibited'), ('porn','reject','prohibited'),
  ('ارسل المبلغ','review','fraud'), ('حول المبلغ','review','fraud'), ('دفع مقدم','review','fraud'),
  ('تحويل مقدم','review','fraud'), ('عربون قبل المعاينة','review','fraud'), ('ويسترن يونيون','review','fraud'),
  ('western union','review','fraud'), ('بتكوين','review','fraud'), ('bitcoin','review','fraud'),
  ('gift card','review','fraud'), ('بطاقة هدايا','review','fraud')
) v(t, a, c)
on conflict (term) do nothing;

-- Keys the system owns inside listings.attributes; users can never write them.
create or replace function public.ts_moderation_keys()
returns text[] language sql immutable
as $$ select array['moderation_status', 'moderation_reason', 'moderation_codes', 'moderated_at'] $$;

create or replace function public.moderate_listing()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  keys text[] := public.ts_moderation_keys();
  attrs jsonb;
  hay text;
  raw text;
  term record;
  reject_codes text[] := '{}';
  review_codes text[] := '{}';
  reason text;
  auto_publish boolean;
  previously_auto boolean;
  -- Whole words only, allowing common Arabic prefixes (و ف ب ل ك + ال) and plural/pronoun suffixes,
  -- so «بالسلاح» and «مسدسات» match but «سلاحف» (turtles) does not.
  sep constant text := '[[:space:]،,.!؟?:;()"/_-]';
begin
  -- Admins and server-side jobs are not re-checked. (auth.role() is the caller's API role;
  -- current_user would be the function owner here because the function is SECURITY DEFINER.)
  if coalesce(auth.role(), '') not in ('anon', 'authenticated') or public.is_admin() then
    return new;
  end if;

  -- Users cannot forge moderation fields.
  attrs := coalesce(new.attributes, '{}'::jsonb) - keys;
  if tg_op = 'UPDATE' then
    attrs := attrs || (select coalesce(jsonb_object_agg(k, v), '{}'::jsonb) from jsonb_each(coalesce(old.attributes, '{}'::jsonb)) as e(k, v) where k = any (keys));
  end if;
  new.attributes := attrs;

  if new.status not in ('active', 'pending') then
    return new;
  end if;

  -- On edits, only re-check when the content changed or the listing is (re)submitted.
  if tg_op = 'UPDATE' and old.status not in ('draft', 'rejected')
     and new.title is not distinct from old.title
     and new.description is not distinct from old.description
     and new.price is not distinct from old.price
     and new.category_id is not distinct from old.category_id
     and new.subcategory_id is not distinct from old.subcategory_id
     and (coalesce(new.attributes, '{}'::jsonb) - keys - 'version') is not distinct from (coalesce(old.attributes, '{}'::jsonb) - keys - 'version') then
    return new;
  end if;

  raw := coalesce(new.title, '') || ' ' || coalesce(new.description, '') || ' ' || (coalesce(new.attributes, '{}'::jsonb) - keys)::text;
  hay := ' ' || public.ts_normalize(raw) || ' ';

  for term in select t.term, t.action, t.code from private.moderation_terms t loop
    if hay ~ ('(^|' || sep || ')(و|ف|ب|ل|ك)?(ال)?' || term.term || '(ات|ين|ون|ه|ها|ي|s|es)?(' || sep || '|$)') then
      if term.action = 'reject' then reject_codes := array_append(reject_codes, term.code);
      else review_codes := array_append(review_codes, term.code); end if;
    end if;
  end loop;

  if lower(raw) ~ '(https?://|www\.|t\.me/|wa\.me/|bit\.ly|tinyurl|[a-z0-9-]+\.(com|net|org|info|xyz|ly|me|io|link|site|online|shop|store)([^a-z]|$))' then
    review_codes := array_append(review_codes, 'external_link');
  end if;

  if exists (
    select 1 from public.listings l
    where l.user_id = new.user_id and l.id <> new.id and l.status in ('active', 'pending')
      and public.ts_normalize(l.title) = public.ts_normalize(new.title)
      and public.ts_normalize(coalesce(l.description, '')) = public.ts_normalize(coalesce(new.description, ''))
  ) then
    review_codes := array_append(review_codes, 'duplicate');
  end if;

  previously_auto := coalesce(new.attributes->>'moderation_status', '') in ('auto_rejected', 'auto_review');

  if array_length(reject_codes, 1) > 0 then
    new.status := 'rejected';
    new.attributes := new.attributes || jsonb_build_object(
      'moderation_status', 'auto_rejected',
      'moderation_reason', 'يحتوي الإعلان على كلمات مرتبطة بمواد ممنوعة ولا يمكن نشره.',
      'moderation_codes', to_jsonb(reject_codes),
      'moderated_at', now());
  elsif array_length(review_codes, 1) > 0 then
    reason := case
      when 'fraud' = any (review_codes) then 'الإعلان يحتوي على عبارات تُستخدم في الاحتيال، وسيراجعه فريق دار السلع قبل نشره.'
      when 'external_link' = any (review_codes) then 'الإعلان يحتوي على رابط خارجي، وسيراجعه فريق دار السلع قبل نشره.'
      else 'يشبه الإعلان إعلانًا آخر لك منشورًا، وسيراجعه فريق دار السلع قبل نشره.' end;
    new.status := 'pending';
    new.attributes := new.attributes || jsonb_build_object(
      'moderation_status', 'auto_review',
      'moderation_reason', reason,
      'moderation_codes', to_jsonb(review_codes),
      'moderated_at', now());
  else
    if previously_auto then
      new.attributes := new.attributes - keys;
    end if;
    -- Pre-moderation mode: new or resubmitted listings wait for an admin.
    select coalesce((value)::text = 'true', true) into auto_publish from public.platform_settings where key = 'listing_auto_publish';
    if new.status = 'active' and not coalesce(auto_publish, true)
       and (tg_op = 'INSERT' or old.status in ('draft', 'rejected', 'pending')) then
      new.status := 'pending';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists listings_moderate on public.listings;
create trigger listings_moderate before insert or update on public.listings
  for each row execute function public.moderate_listing();

-- Tell the owner when the automatic check rejected or held a listing.
create or replace function public.notify_listing_auto_moderation()
returns trigger
language plpgsql security definer set search_path = public
as $$
begin
  if new.attributes->>'moderation_status' in ('auto_rejected', 'auto_review')
     and (tg_op = 'INSERT' or (new.attributes->>'moderated_at') is distinct from (old.attributes->>'moderated_at')) then
    insert into public.notifications (user_id, type, title, body, listing_id)
    values (new.user_id,
            case when new.attributes->>'moderation_status' = 'auto_rejected' then 'listing_rejected' else 'listing_held' end,
            case when new.attributes->>'moderation_status' = 'auto_rejected' then 'listing_rejected' else 'listing_held' end,
            left(new.attributes->>'moderation_reason', 300), new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists listings_notify_auto_moderation on public.listings;
create trigger listings_notify_auto_moderation after insert or update on public.listings
  for each row execute function public.notify_listing_auto_moderation();

-- An automatically rejected listing can be fixed and resubmitted by its owner.
-- A rejection by an admin stays locked (the owner can appeal instead).
create or replace function public.guard_listing_status()
returns trigger
language plpgsql set search_path = public
as $$
begin
  if current_user not in ('anon', 'authenticated') or public.is_admin() then
    return new;
  end if;
  if new.status is distinct from old.status then
    if old.status = 'rejected' and coalesce(old.attributes->>'moderation_status', '') <> 'auto_rejected' then
      raise exception 'LISTING_STATUS_LOCKED';
    end if;
    if old.status = 'pending' and new.status <> 'draft' then
      raise exception 'LISTING_STATUS_LOCKED';
    end if;
    if new.status = 'rejected' then
      raise exception 'LISTING_STATUS_ADMIN_ONLY';
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- (b) Account suspensions
-- ---------------------------------------------------------------------------

create table if not exists public.account_restrictions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  until timestamptz,                -- null = permanent
  reason text not null check (char_length(reason) between 3 and 500),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.account_restrictions enable row level security;

drop policy if exists account_restrictions_select on public.account_restrictions;
create policy account_restrictions_select on public.account_restrictions
  for select to authenticated using (user_id = auth.uid() or public.is_admin());
grant select on public.account_restrictions to authenticated;

create or replace function public.is_suspended(uid uuid)
returns boolean
language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.account_restrictions r where r.user_id = uid and (r.until is null or r.until > now())) $$;
grant execute on function public.is_suspended(uuid) to anon, authenticated;

-- Enforce it where users create or change content.
alter policy listings_insert_own on public.listings
  with check (user_id = auth.uid() and not public.is_suspended(auth.uid()));
alter policy listings_update_own on public.listings
  using (user_id = auth.uid()) with check (user_id = auth.uid() and not public.is_suspended(auth.uid()));
alter policy listings_select_active on public.listings
  using ((status = 'active' and not public.is_suspended(user_id)) or user_id = auth.uid());

alter policy store_conversations_insert_buyer on public.store_conversations
  with check (buyer_user_id = auth.uid() and status = 'active' and not public.is_suspended(auth.uid())
    and not public.is_blocked_between(buyer_user_id, merchant_user_id)
    and exists (select 1 from public.listings l where l.id = store_conversations.listing_id and l.status = 'active' and l.user_id = store_conversations.merchant_user_id));
alter policy store_messages_insert_participant on public.store_messages
  with check (sender_user_id = auth.uid() and read_at is null and not public.is_suspended(auth.uid())
    and exists (select 1 from public.store_conversations c where c.id = store_messages.conversation_id and c.status = 'active'
      and (auth.uid() = c.buyer_user_id or auth.uid() = c.merchant_user_id)
      and not public.is_blocked_between(c.buyer_user_id, c.merchant_user_id)));
alter policy stores_insert_own on public.stores
  with check (owner_id = auth.uid() and status = 'pending' and not is_featured and not public.is_suspended(auth.uid()));
alter policy stores_update_own on public.stores
  using ((owner_id = auth.uid()) or public.is_admin())
  with check ((owner_id = auth.uid() and not public.is_suspended(auth.uid())) or public.is_admin());
alter policy stores_select_active on public.stores
  using ((status = 'active' and not public.is_suspended(owner_id)) or owner_id = auth.uid() or public.is_admin());
alter policy listing_ratings_insert_visited on public.listing_ratings
  with check (reviewer_user_id = auth.uid() and not public.is_suspended(auth.uid())
    and exists (select 1 from public.listing_views v where v.listing_id = listing_ratings.listing_id and v.viewer_user_id = auth.uid())
    and exists (select 1 from public.listings l where l.id = listing_ratings.listing_id and l.user_id = listing_ratings.seller_id and l.user_id <> auth.uid()));

-- The signed-in user's own active restriction (null when none).
create or replace function public.my_restriction()
returns table (until timestamptz, reason text)
language sql stable security definer set search_path = public
as $$ select r.until, r.reason from public.account_restrictions r where r.user_id = auth.uid() and (r.until is null or r.until > now()) $$;

-- Admin: suspend for p_days (null = permanent) with a reason shown to the user.
create or replace function public.admin_suspend_user(p_user uuid, p_days int, p_reason text)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare before_row jsonb; after_row jsonb;
begin
  if not public.is_admin() then raise exception 'ADMIN_ONLY'; end if;
  if p_user = auth.uid() then raise exception 'CANNOT_SUSPEND_SELF'; end if;
  if char_length(coalesce(trim(p_reason), '')) < 3 then raise exception 'REASON_REQUIRED'; end if;
  if p_days is not null and (p_days < 1 or p_days > 3650) then raise exception 'BAD_DURATION'; end if;
  select to_jsonb(r) into before_row from public.account_restrictions r where r.user_id = p_user;
  insert into public.account_restrictions (user_id, until, reason, created_by)
  values (p_user, case when p_days is null then null else now() + make_interval(days => p_days) end, trim(p_reason), auth.uid())
  on conflict (user_id) do update set until = excluded.until, reason = excluded.reason, created_by = excluded.created_by, created_at = now();
  select to_jsonb(r) into after_row from public.account_restrictions r where r.user_id = p_user;
  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, before_data, after_data)
  values (auth.uid(), 'suspend', 'account_restrictions', p_user::text, before_row, after_row);
  insert into public.notifications (user_id, type, title, body)
  values (p_user, 'account_suspended', 'account_suspended', left(trim(p_reason), 300));
end;
$$;

create or replace function public.admin_lift_suspension(p_user uuid)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare before_row jsonb;
begin
  if not public.is_admin() then raise exception 'ADMIN_ONLY'; end if;
  select to_jsonb(r) into before_row from public.account_restrictions r where r.user_id = p_user;
  if before_row is null then return; end if;
  delete from public.account_restrictions where user_id = p_user;
  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, before_data, after_data)
  values (auth.uid(), 'lift_suspension', 'account_restrictions', p_user::text, before_row, null);
  insert into public.notifications (user_id, type, title, body)
  values (p_user, 'account_restored', 'account_restored', '');
end;
$$;

revoke execute on function public.my_restriction(), public.admin_suspend_user(uuid, int, text), public.admin_lift_suspension(uuid) from public, anon;
grant execute on function public.my_restriction(), public.admin_suspend_user(uuid, int, text), public.admin_lift_suspension(uuid) to authenticated;
revoke execute on function public.moderate_listing(), public.notify_listing_auto_moderation() from public, anon, authenticated;
