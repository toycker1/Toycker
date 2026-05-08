-- Fix Supabase Advisor "Auth RLS Initialization Plan" warnings for review policies.
-- The policy behavior is unchanged; auth.uid() is wrapped in SELECT so PostgreSQL
-- can evaluate it once per statement instead of once per row.

BEGIN;

DROP POLICY IF EXISTS "Users can view their own reviews" ON public.reviews;

CREATE POLICY "Users can view their own reviews"
  ON public.reviews
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users create their own reviews" ON public.reviews;

CREATE POLICY "Users create their own reviews"
  ON public.reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users upload review media for their reviews" ON public.review_media;

CREATE POLICY "Users upload review media for their reviews"
  ON public.review_media
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.reviews r
      WHERE r.id = review_id
        AND r.user_id = (SELECT auth.uid())
    )
  );

COMMIT;
