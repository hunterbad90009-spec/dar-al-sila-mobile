-- 0007: second lock on the admin panel.
-- Admin rights now need BOTH role = 'admin' AND a password unlock in the last 30 minutes.
-- The password is stored only as a bcrypt hash; it is set from the SQL editor, never in code:
--   insert into private.admin_lock_settings (id, pin_hash) values (1, extensions.crypt('<password>', extensions.gen_salt('bf')))
--   on conflict (id) do update set pin_hash = excluded.pin_hash, updated_at = now();

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.admin_lock_settings (
  id int primary key default 1 check (id = 1),
  pin_hash text not null,
  updated_at timestamptz not null default now()
);

create table if not exists private.admin_unlocks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  unlocked_until timestamptz,
  failed_attempts int not null default 0,
  locked_until timestamptz
);

-- Admin = admin role + unlocked recently. Used by every admin RLS policy and guard.
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
     and exists (select 1 from private.admin_unlocks u where u.user_id = auth.uid() and u.unlocked_until > now());
$$;

-- Try the password. 5 wrong tries lock it for 15 minutes.
create or replace function public.admin_unlock(p_password text)
returns jsonb
language plpgsql volatile security definer set search_path = public
as $$
declare
  uid uuid := auth.uid();
  row private.admin_unlocks;
  hash text;
begin
  if uid is null or not exists (select 1 from public.profiles where id = uid and role = 'admin') then
    return jsonb_build_object('ok', false, 'reason', 'not_admin');
  end if;
  select pin_hash into hash from private.admin_lock_settings where id = 1;
  if hash is null then
    return jsonb_build_object('ok', false, 'reason', 'not_configured');
  end if;
  insert into private.admin_unlocks (user_id) values (uid) on conflict (user_id) do nothing;
  select * into row from private.admin_unlocks where user_id = uid for update;
  if row.locked_until is not null and row.locked_until > now() then
    return jsonb_build_object('ok', false, 'reason', 'locked', 'locked_until', row.locked_until);
  end if;
  if extensions.crypt(coalesce(p_password, ''), hash) = hash then
    update private.admin_unlocks set unlocked_until = now() + interval '30 minutes', failed_attempts = 0, locked_until = null where user_id = uid;
    return jsonb_build_object('ok', true, 'unlocked_until', now() + interval '30 minutes');
  end if;
  if row.failed_attempts + 1 >= 5 then
    update private.admin_unlocks set failed_attempts = 0, locked_until = now() + interval '15 minutes', unlocked_until = null where user_id = uid;
    return jsonb_build_object('ok', false, 'reason', 'locked', 'locked_until', now() + interval '15 minutes');
  end if;
  update private.admin_unlocks set failed_attempts = row.failed_attempts + 1 where user_id = uid;
  return jsonb_build_object('ok', false, 'reason', 'wrong', 'remaining', 5 - (row.failed_attempts + 1));
end;
$$;

-- When does the current unlock end (null = locked)?
create or replace function public.admin_unlock_status()
returns timestamptz
language sql stable security definer set search_path = public
as $$ select unlocked_until from private.admin_unlocks where user_id = auth.uid() and unlocked_until > now() $$;

-- Lock again right away.
create or replace function public.admin_lock()
returns void
language sql volatile security definer set search_path = public
as $$ update private.admin_unlocks set unlocked_until = null where user_id = auth.uid() $$;

revoke execute on function public.admin_unlock(text), public.admin_unlock_status(), public.admin_lock() from public, anon;
grant execute on function public.admin_unlock(text), public.admin_unlock_status(), public.admin_lock() to authenticated;
