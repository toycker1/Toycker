-- Priority 8: keep Supabase Realtime enabled only for tables that are actively subscribed to.
-- The codebase does not subscribe to wishlist_items realtime changes, so remove it from
-- the supabase_realtime publication. Normal wishlist reads/writes are unchanged.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'wishlist_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.wishlist_items;
  END IF;
END $$;
