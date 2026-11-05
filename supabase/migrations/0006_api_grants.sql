-- 0006: API grants for the tables added in 0001/0002.
-- This project does not auto-grant new tables to anon/authenticated, so those tables
-- were unreachable from the app. RLS policies still decide which rows each user sees.
grant select on public.stores, public.platform_settings, public.listing_ratings, public.merchant_subscriptions to anon, authenticated;
grant insert, update, delete on public.stores to authenticated;
grant insert, update on public.platform_settings to authenticated;
grant insert, update, delete on public.categories to authenticated;
grant insert, update on public.listing_ratings to authenticated;
grant insert, update, delete on public.merchant_subscriptions to authenticated;
grant select, insert, update on public.listing_views to authenticated;
grant select, update on public.notifications to authenticated;
grant select, insert, update on public.report_cases to authenticated;
grant select, insert, update on public.store_conversations to authenticated;
grant select, insert, update on public.store_messages to authenticated;
grant select, insert, delete on public.user_blocks to authenticated;
grant select, insert, delete on public.user_follows to authenticated;
grant select on public.admin_audit_logs, public.listing_audit_logs to authenticated;
grant usage on all sequences in schema public to authenticated;
-- TRUNCATE ignores RLS; the API never needs it.
revoke truncate on all tables in schema public from anon, authenticated;
