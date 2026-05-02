-- Fix Supabase Advisor warnings for public.home_reviews RLS policies.
--
-- Root cause:
--   The table had a public SELECT policy plus a public FOR ALL policy with
--   USING (true). Because FOR ALL also applies to SELECT, PostgreSQL evaluated
--   multiple permissive SELECT policies for every role. The FOR ALL policy also
--   allowed unrestricted writes through RLS.
--
-- Fix:
--   Keep the intentional public read policy, but replace the unrestricted
--   FOR ALL policy with admin-only INSERT, UPDATE, and DELETE policies.

BEGIN;

DROP POLICY IF EXISTS "Admins can manage home reviews" ON public.home_reviews;
DROP POLICY IF EXISTS "Home reviews are viewable by everyone" ON public.home_reviews;

CREATE POLICY "Home reviews are viewable by everyone"
  ON public.home_reviews
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins can insert home reviews"
  ON public.home_reviews
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can update home reviews"
  ON public.home_reviews
  FOR UPDATE
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can delete home reviews"
  ON public.home_reviews
  FOR DELETE
  TO authenticated
  USING ((SELECT public.is_admin()));

COMMIT;
