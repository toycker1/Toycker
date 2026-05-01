-- Fix Supabase Advisor multiple permissive SELECT policy warnings.
--
-- Root cause:
--   Several tables had a public/user SELECT policy plus an authenticated
--   admin FOR ALL policy. PostgreSQL applies FOR ALL policies to SELECT too,
--   so authenticated SELECT queries had multiple permissive policies that
--   were OR'd together and evaluated for each relevant query.
--
-- Fix:
--   Keep the intended read behavior, but ensure each affected role/action has
--   only one permissive SELECT policy. Admin write access is split into
--   INSERT, UPDATE, and DELETE policies so it no longer overlaps with SELECT.

BEGIN;

-- =====================================================
-- public.addresses
-- =====================================================
-- Customers can read their own addresses; admins can read all addresses.

DROP POLICY IF EXISTS "Users can view their own addresses" ON public.addresses;
DROP POLICY IF EXISTS "Admins read all addresses" ON public.addresses;
DROP POLICY IF EXISTS "Consolidated SELECT for addresses" ON public.addresses;
DROP POLICY IF EXISTS "Users and admins can view addresses" ON public.addresses;

CREATE POLICY "Users and admins can view addresses"
  ON public.addresses
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (SELECT public.is_admin())
  );

-- =====================================================
-- public.categories
-- =====================================================
-- Categories are intentionally public-readable. Admin writes are separated
-- from SELECT so authenticated users do not match two SELECT policies.

DROP POLICY IF EXISTS "Public read categories" ON public.categories;
DROP POLICY IF EXISTS "Public can view categories" ON public.categories;
DROP POLICY IF EXISTS "Public SELECT categories" ON public.categories;
DROP POLICY IF EXISTS "Admins can manage categories" ON public.categories;
DROP POLICY IF EXISTS "Admins can insert categories" ON public.categories;
DROP POLICY IF EXISTS "Admins can update categories" ON public.categories;
DROP POLICY IF EXISTS "Admins can delete categories" ON public.categories;

CREATE POLICY "Public read categories"
  ON public.categories
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins can insert categories"
  ON public.categories
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can update categories"
  ON public.categories
  FOR UPDATE
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can delete categories"
  ON public.categories
  FOR DELETE
  TO authenticated
  USING ((SELECT public.is_admin()));

-- =====================================================
-- public.collections
-- =====================================================
-- Collections are intentionally public-readable. Admin writes are separated
-- from SELECT so authenticated users do not match two SELECT policies.

DROP POLICY IF EXISTS "Public read collections" ON public.collections;
DROP POLICY IF EXISTS "Public can view collections" ON public.collections;
DROP POLICY IF EXISTS "Public SELECT collections" ON public.collections;
DROP POLICY IF EXISTS "Admins can manage collections" ON public.collections;
DROP POLICY IF EXISTS "Admins can insert collections" ON public.collections;
DROP POLICY IF EXISTS "Admins can update collections" ON public.collections;
DROP POLICY IF EXISTS "Admins can delete collections" ON public.collections;

CREATE POLICY "Public read collections"
  ON public.collections
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins can insert collections"
  ON public.collections
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can update collections"
  ON public.collections
  FOR UPDATE
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can delete collections"
  ON public.collections
  FOR DELETE
  TO authenticated
  USING ((SELECT public.is_admin()));

-- =====================================================
-- public.global_settings
-- =====================================================
-- Global settings are intentionally public-readable. Admin writes are
-- separated from SELECT to remove the authenticated SELECT overlap.

DROP POLICY IF EXISTS "Public can read global settings" ON public.global_settings;
DROP POLICY IF EXISTS "Admins can manage global settings" ON public.global_settings;
DROP POLICY IF EXISTS "Admins can insert global settings" ON public.global_settings;
DROP POLICY IF EXISTS "Admins can update global settings" ON public.global_settings;
DROP POLICY IF EXISTS "Admins can delete global settings" ON public.global_settings;

CREATE POLICY "Public can read global settings"
  ON public.global_settings
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins can insert global settings"
  ON public.global_settings
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can update global settings"
  ON public.global_settings
  FOR UPDATE
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can delete global settings"
  ON public.global_settings
  FOR DELETE
  TO authenticated
  USING ((SELECT public.is_admin()));

-- =====================================================
-- public.home_banners
-- =====================================================
-- Public users can read only active, currently scheduled banners. Admins can
-- read all banners for the dashboard through the same SELECT policy.

DROP POLICY IF EXISTS "Public can view active home banners" ON public.home_banners;
DROP POLICY IF EXISTS "Public read home_banners" ON public.home_banners;
DROP POLICY IF EXISTS "Public can view home_banners" ON public.home_banners;
DROP POLICY IF EXISTS "Public SELECT home_banners" ON public.home_banners;
DROP POLICY IF EXISTS "Admins manage home_banners" ON public.home_banners;
DROP POLICY IF EXISTS "Admins can manage home banners" ON public.home_banners;
DROP POLICY IF EXISTS "Public and admins can view home banners" ON public.home_banners;
DROP POLICY IF EXISTS "Admins can insert home banners" ON public.home_banners;
DROP POLICY IF EXISTS "Admins can update home banners" ON public.home_banners;
DROP POLICY IF EXISTS "Admins can delete home banners" ON public.home_banners;

CREATE POLICY "Public and admins can view home banners"
  ON public.home_banners
  FOR SELECT
  TO public
  USING (
    (
      is_active = true
      AND (starts_at IS NULL OR starts_at <= now())
      AND (ends_at IS NULL OR ends_at > now())
    )
    OR (SELECT public.is_admin())
  );

CREATE POLICY "Admins can insert home banners"
  ON public.home_banners
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can update home banners"
  ON public.home_banners
  FOR UPDATE
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can delete home banners"
  ON public.home_banners
  FOR DELETE
  TO authenticated
  USING ((SELECT public.is_admin()));

-- =====================================================
-- public.home_exclusive_collections
-- =====================================================
-- Public users can read only active exclusive collections. Admins can read all
-- rows for the dashboard through the same SELECT policy.

DROP POLICY IF EXISTS "Public can view active exclusive collections" ON public.home_exclusive_collections;
DROP POLICY IF EXISTS "Public read home_exclusive_collections" ON public.home_exclusive_collections;
DROP POLICY IF EXISTS "Public can view home_exclusive_collections" ON public.home_exclusive_collections;
DROP POLICY IF EXISTS "Public SELECT home_exclusive_collections" ON public.home_exclusive_collections;
DROP POLICY IF EXISTS "Admins manage home_exclusive_collections" ON public.home_exclusive_collections;
DROP POLICY IF EXISTS "Admins can manage exclusive collections" ON public.home_exclusive_collections;
DROP POLICY IF EXISTS "Public and admins can view exclusive collections" ON public.home_exclusive_collections;
DROP POLICY IF EXISTS "Admins can insert exclusive collections" ON public.home_exclusive_collections;
DROP POLICY IF EXISTS "Admins can update exclusive collections" ON public.home_exclusive_collections;
DROP POLICY IF EXISTS "Admins can delete exclusive collections" ON public.home_exclusive_collections;

CREATE POLICY "Public and admins can view exclusive collections"
  ON public.home_exclusive_collections
  FOR SELECT
  TO public
  USING (
    is_active = true
    OR (SELECT public.is_admin())
  );

CREATE POLICY "Admins can insert exclusive collections"
  ON public.home_exclusive_collections
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can update exclusive collections"
  ON public.home_exclusive_collections
  FOR UPDATE
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can delete exclusive collections"
  ON public.home_exclusive_collections
  FOR DELETE
  TO authenticated
  USING ((SELECT public.is_admin()));

COMMIT;
