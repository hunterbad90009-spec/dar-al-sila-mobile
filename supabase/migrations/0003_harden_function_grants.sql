-- Applied to TEST on 2026-11-03 after the Supabase security advisor run.
-- Trigger-only functions must not be callable through /rest/v1/rpc.
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.log_listing_change() from public, anon, authenticated;
revoke execute on function public.log_admin_action() from public, anon, authenticated;
revoke execute on function public.on_listing_moderated() from public, anon, authenticated;
revoke execute on function public.on_store_message() from public, anon, authenticated;
-- Used inside RLS policies by signed-in users only.
revoke execute on function public.is_blocked_between(uuid, uuid) from public, anon;
grant execute on function public.is_blocked_between(uuid, uuid) to authenticated;
-- View counter: signed-in users only (the app calls it only when logged in).
revoke execute on function public.increment_listing_views(uuid) from public, anon;
grant execute on function public.increment_listing_views(uuid) to authenticated;
alter function public.increment_listing_views(uuid) set search_path = public;
alter function public.set_updated_at() set search_path = public;
