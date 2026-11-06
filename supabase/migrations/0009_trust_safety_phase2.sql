-- 0009: Trust & Safety, phase 2
-- (a) Appeals: an owner can appeal an admin's listing rejection/suspension, and a suspended
--     user can appeal the suspension. One open appeal per subject; a new one is allowed 7 days
--     after a rejected appeal. Admins decide with a written note; every decision is audited
--     and the user is notified.
-- (b) Seller-rating comments: optional comment with each rating. Clean comments show at once;
--     comments with prohibited/abusive words, links or phone numbers wait for an admin.
--     Negative opinions are allowed and are not hidden for being negative.

-- ---------------------------------------------------------------------------
-- (a) Appeals
-- ---------------------------------------------------------------------------

create table if not exists public.appeals (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('listing', 'account')),
  listing_id uuid references public.listings(id) on delete cascade,
  original_reason text,                      -- the decision being appealed, as the user saw it
  statement text not null check (char_length(statement) between 10 and 1000),
  status text not null default 'open' check (status in ('open', 'accepted', 'rejected')),
  decision_note text,
  decided_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  check ((kind = 'listing') = (listing_id is not null))
);
create unique index if not exists appeals_one_open on public.appeals (user_id, kind, coalesce(listing_id::text, '')) where status = 'open';
create index if not exists appeals_status_idx on public.appeals (status, created_at);

alter table public.appeals enable row level security;
drop policy if exists appeals_select on public.appeals;
create policy appeals_select on public.appeals for select to authenticated using (user_id = auth.uid() or public.is_admin());
grant select on public.appeals to authenticated;          -- writes only through the functions below

create or replace function public.file_appeal(p_kind text, p_listing uuid, p_statement text)
returns bigint
language plpgsql volatile security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  l record;
  reason text;
  new_id bigint;
begin
  if uid is null then raise exception 'LOGIN_REQUIRED'; end if;
  if char_length(coalesce(trim(p_statement), '')) < 10 then raise exception 'APPEAL_TOO_SHORT'; end if;
  if p_kind = 'listing' then
    select id, user_id, status, attributes into l from public.listings where id = p_listing;
    if l.id is null or l.user_id <> uid then raise exception 'LISTING_NOT_FOUND'; end if;
    if l.status <> 'rejected' or coalesce(l.attributes->>'moderation_status', '') = 'auto_rejected' then
      raise exception 'NOTHING_TO_APPEAL';
    end if;
    reason := l.attributes->>'moderation_reason';
  elsif p_kind = 'account' then
    p_listing := null;
    select r.reason into reason from public.account_restrictions r where r.user_id = uid and (r.until is null or r.until > now());
    if not found then raise exception 'NOTHING_TO_APPEAL'; end if;
  else
    raise exception 'NOTHING_TO_APPEAL';
  end if;
  if exists (select 1 from public.appeals a where a.user_id = uid and a.kind = p_kind and a.listing_id is not distinct from p_listing and a.status = 'open') then
    raise exception 'APPEAL_ALREADY_OPEN';
  end if;
  if exists (select 1 from public.appeals a where a.user_id = uid and a.kind = p_kind and a.listing_id is not distinct from p_listing
             and a.status = 'rejected' and a.decided_at > now() - interval '7 days') then
    raise exception 'APPEAL_TOO_SOON';
  end if;
  insert into public.appeals (user_id, kind, listing_id, original_reason, statement)
  values (uid, p_kind, p_listing, reason, trim(p_statement))
  returning id into new_id;
  return new_id;
end;
$$;

create or replace function public.admin_decide_appeal(p_id bigint, p_accept boolean, p_note text)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare a public.appeals; before_row jsonb;
begin
  if not public.is_admin() then raise exception 'ADMIN_ONLY'; end if;
  if char_length(coalesce(trim(p_note), '')) < 3 then raise exception 'REASON_REQUIRED'; end if;
  select * into a from public.appeals where id = p_id for update;
  if a.id is null or a.status <> 'open' then raise exception 'APPEAL_NOT_OPEN'; end if;
  before_row := to_jsonb(a);

  if p_accept then
    if a.kind = 'listing' then
      update public.listings
      set status = 'active',
          attributes = (coalesce(attributes, '{}'::jsonb) - public.ts_moderation_keys())
                       || jsonb_build_object('moderation_status', 'appeal_approved', 'moderated_at', now())
      where id = a.listing_id and status = 'rejected';
    else
      delete from public.account_restrictions where user_id = a.user_id;
    end if;
  end if;

  update public.appeals
  set status = case when p_accept then 'accepted' else 'rejected' end,
      decision_note = trim(p_note), decided_by = auth.uid(), decided_at = now()
  where id = p_id;

  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, before_data, after_data)
  values (auth.uid(), case when p_accept then 'appeal_accept' else 'appeal_reject' end, 'appeals', p_id::text,
          before_row, (select to_jsonb(x) from public.appeals x where x.id = p_id));

  insert into public.notifications (user_id, type, title, body, listing_id)
  values (a.user_id, case when p_accept then 'appeal_accepted' else 'appeal_rejected' end,
          case when p_accept then 'appeal_accepted' else 'appeal_rejected' end, left(trim(p_note), 300), a.listing_id);
end;
$$;

revoke execute on function public.file_appeal(text, uuid, text), public.admin_decide_appeal(bigint, boolean, text) from public, anon;
grant execute on function public.file_appeal(text, uuid, text), public.admin_decide_appeal(bigint, boolean, text) to authenticated;

-- ---------------------------------------------------------------------------
-- (b) Rating comments
-- ---------------------------------------------------------------------------

alter table public.listing_ratings
  add column if not exists comment_status text not null default 'none' check (comment_status in ('none', 'visible', 'review', 'hidden')),
  add column if not exists pending_comment text;

-- Extra words that only send a comment to review (abuse/threats). Never hides by itself.
create table if not exists private.rating_terms (term text primary key, code text not null);
insert into private.rating_terms (term, code)
select public.ts_normalize(t), c from (values
  ('حرامي','abuse'), ('نصاب','abuse'), ('كذاب','abuse'), ('حقير','abuse'), ('وسخ','abuse'), ('كلب','abuse'),
  ('حيوان','abuse'), ('غبي','abuse'), ('اقتلك','threat'), ('سأقتلك','threat'), ('بفضحك','threat'),
  ('idiot','abuse'), ('scammer','abuse'), ('kill you','threat')
) v(t, c)
on conflict (term) do nothing;

create or replace function public.moderate_rating()
returns trigger
language plpgsql security definer set search_path = public
as $$
declare
  c text;
  hay text;
  flagged boolean := false;
  term record;
  sep constant text := '[[:space:]،,.!؟?:;()"/_-]';
begin
  if coalesce(auth.role(), '') not in ('anon', 'authenticated') or public.is_admin() then
    return new;
  end if;
  -- Users never set moderation fields directly.
  if tg_op = 'UPDATE' then
    new.comment_status := old.comment_status;
    new.pending_comment := old.pending_comment;
    if new.comment is not distinct from old.comment then return new; end if;
  end if;

  c := nullif(left(trim(coalesce(new.comment, '')), 500), '');
  if c is null then
    new.comment := null; new.pending_comment := null; new.comment_status := 'none';
    return new;
  end if;

  hay := ' ' || public.ts_normalize(c) || ' ';
  for term in select t.term from private.moderation_terms t union all select r.term from private.rating_terms r loop
    if hay ~ ('(^|' || sep || ')(و|ف|ب|ل|ك)?(ال)?' || term.term || '(ات|ين|ون|ه|ها|ي|s|es)?(' || sep || '|$)') then
      flagged := true; exit;
    end if;
  end loop;
  -- Links and phone numbers (privacy / off-platform contact).
  if not flagged and (lower(c) ~ '(https?://|www\.|t\.me/|wa\.me/|[a-z0-9-]+\.(com|net|org|me|io|ly)([^a-z]|$))'
                      or regexp_replace(c, '[^0-9٠-٩]', '', 'g') ~ '[0-9٠-٩]{8,}') then
    flagged := true;
  end if;

  if flagged then
    new.pending_comment := c; new.comment := null; new.comment_status := 'review';
  else
    new.comment := c; new.pending_comment := null; new.comment_status := 'visible';
  end if;
  return new;
end;
$$;

drop trigger if exists listing_ratings_moderate on public.listing_ratings;
create trigger listing_ratings_moderate before insert or update on public.listing_ratings
  for each row execute function public.moderate_rating();

-- Comments waiting for review are not readable by the public.
revoke select on public.listing_ratings from anon, authenticated;
grant select (listing_id, reviewer_user_id, seller_id, rating, comment, comment_status, created_at, updated_at)
  on public.listing_ratings to anon, authenticated;

-- Public reviews of a seller, with reviewer names (only visible comments are ever returned).
create or replace function public.seller_reviews(p_seller uuid, p_limit int default 30)
returns table (rating smallint, comment text, created_at timestamptz, reviewer_name text, listing_title text)
language sql stable security definer set search_path = public
as $$
  select r.rating, case when r.comment_status = 'visible' then r.comment end, r.created_at,
         coalesce(nullif(p.full_name, ''), p.username), l.title
  from public.listing_ratings r
  left join public.profiles p on p.id = r.reviewer_user_id
  left join public.listings l on l.id = r.listing_id
  where r.seller_id = p_seller
  order by r.created_at desc
  limit least(greatest(p_limit, 1), 100)
$$;
grant execute on function public.seller_reviews(uuid, int) to anon, authenticated;

-- Admin queue: comments waiting for review, plus the latest visible ones (to hide on report).
create or replace function public.admin_list_rating_comments(p_status text default 'review')
returns table (listing_id uuid, reviewer_user_id uuid, seller_id uuid, rating smallint, text text, comment_status text,
               created_at timestamptz, reviewer_name text, seller_name text, listing_title text)
language sql stable security definer set search_path = public
as $$
  select r.listing_id, r.reviewer_user_id, r.seller_id, r.rating, coalesce(r.pending_comment, r.comment), r.comment_status, r.created_at,
         coalesce(nullif(pr.full_name, ''), pr.username), coalesce(nullif(ps.full_name, ''), ps.username), l.title
  from public.listing_ratings r
  left join public.profiles pr on pr.id = r.reviewer_user_id
  left join public.profiles ps on ps.id = r.seller_id
  left join public.listings l on l.id = r.listing_id
  where public.is_admin() and r.comment_status = p_status
  order by r.created_at desc
  limit 200
$$;

create or replace function public.admin_moderate_rating(p_listing uuid, p_reviewer uuid, p_action text)
returns void
language plpgsql volatile security definer set search_path = public
as $$
declare before_row jsonb;
begin
  if not public.is_admin() then raise exception 'ADMIN_ONLY'; end if;
  select to_jsonb(r) into before_row from public.listing_ratings r where r.listing_id = p_listing and r.reviewer_user_id = p_reviewer;
  if before_row is null then raise exception 'RATING_NOT_FOUND'; end if;
  if p_action = 'approve' then
    update public.listing_ratings set comment = coalesce(pending_comment, comment), pending_comment = null, comment_status = 'visible'
    where listing_id = p_listing and reviewer_user_id = p_reviewer;
  elsif p_action = 'hide' then
    update public.listing_ratings set pending_comment = coalesce(pending_comment, comment), comment = null, comment_status = 'hidden'
    where listing_id = p_listing and reviewer_user_id = p_reviewer;
  else
    raise exception 'BAD_ACTION';
  end if;
  insert into public.admin_audit_logs (admin_user_id, action, target_table, target_id, before_data, after_data)
  values (auth.uid(), 'rating_' || p_action, 'listing_ratings', p_listing::text || ':' || p_reviewer::text, before_row,
          (select to_jsonb(r) from public.listing_ratings r where r.listing_id = p_listing and r.reviewer_user_id = p_reviewer));
end;
$$;

revoke execute on function public.admin_list_rating_comments(text), public.admin_moderate_rating(uuid, uuid, text) from public, anon;
grant execute on function public.admin_list_rating_comments(text), public.admin_moderate_rating(uuid, uuid, text) to authenticated;
revoke execute on function public.moderate_rating() from public, anon, authenticated;
