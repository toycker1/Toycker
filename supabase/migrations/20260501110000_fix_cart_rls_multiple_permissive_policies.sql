-- Fix Supabase Advisor multiple permissive policy warnings for carts/cart_items.
--
-- Root cause:
--   public.carts and public.cart_items each had separate authenticated
--   permissive FOR ALL policies for customer ownership and admin access.
--   PostgreSQL evaluates each permissive policy and ORs the result, which is
--   correct but less efficient at scale.
--
-- Fix:
--   Consolidate the authenticated user and admin rules into one policy per
--   table while preserving the same access behavior.

BEGIN;

-- =====================================================
-- public.carts
-- =====================================================

DROP POLICY IF EXISTS "Users access own carts" ON public.carts;
DROP POLICY IF EXISTS "Admins manage carts" ON public.carts;
DROP POLICY IF EXISTS "Users and admins access carts" ON public.carts;

CREATE POLICY "Users and admins access carts"
  ON public.carts FOR ALL
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (SELECT public.is_admin())
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR (SELECT public.is_admin())
  );

-- Keep "Guests access carts by ID" unchanged. It applies only to anon SELECT
-- and is not part of the authenticated multiple-permissive warning.

-- =====================================================
-- public.cart_items
-- =====================================================

DROP POLICY IF EXISTS "Users access own cart_items" ON public.cart_items;
DROP POLICY IF EXISTS "Admins manage cart_items" ON public.cart_items;
DROP POLICY IF EXISTS "Users and admins access cart_items" ON public.cart_items;

CREATE POLICY "Users and admins access cart_items"
  ON public.cart_items FOR ALL
  TO authenticated
  USING (
    cart_id IN (
      SELECT id
      FROM public.carts
      WHERE user_id = (SELECT auth.uid())
    )
    OR (SELECT public.is_admin())
  )
  WITH CHECK (
    cart_id IN (
      SELECT id
      FROM public.carts
      WHERE user_id = (SELECT auth.uid())
    )
    OR (SELECT public.is_admin())
  );

COMMIT;
