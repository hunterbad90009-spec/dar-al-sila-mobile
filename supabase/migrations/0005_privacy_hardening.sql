-- 0005: privacy hardening
-- 1) Phone numbers in profiles are private: only the owner (my_profile) and admins
--    (admin_list_profiles) can read them. Every other column stays publicly readable.
-- 2) The listing-media bucket accepts images only, max 10 MB per file.

revoke select on table public.profiles from anon, authenticated;
grant select (id, full_name, username, avatar_url, city, bio, created_at, updated_at, role, merchant_status)
  on table public.profiles to anon, authenticated;

create or replace function public.my_profile()
returns setof public.profiles
language sql stable security definer set search_path = public
as $$ select * from public.profiles where id = auth.uid() $$;

create or replace function public.admin_list_profiles(q text default null)
returns setof public.profiles
language sql stable security definer set search_path = public
as $$
  select * from public.profiles
  where public.is_admin()
    and (coalesce(q, '') = '' or full_name ilike '%' || q || '%' or username ilike '%' || q || '%')
  order by created_at desc
  limit 300
$$;

revoke execute on function public.my_profile() from public, anon;
revoke execute on function public.admin_list_profiles(text) from public, anon;
grant execute on function public.my_profile() to authenticated;
grant execute on function public.admin_list_profiles(text) to authenticated;

-- is_admin() stays executable by anon: RLS policies call it for every visitor (it returns false).

update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
where id = 'listing-media';
