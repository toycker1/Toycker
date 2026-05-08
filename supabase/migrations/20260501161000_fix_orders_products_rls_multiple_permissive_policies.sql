-- Fix Supabase Advisor multiple permissive policy warnings for orders and
-- product catalog tables.
--
-- Root cause:
--   Several tables have an authenticated admin FOR ALL policy plus a public,
--   customer, or admin policy for the same command. PostgreSQL applies FOR ALL
--   policies to SELECT, INSERT, UPDATE, and DELETE, so authenticated requests
--   can match multiple permissive policies for one action.
--
-- Fix:
--   Preserve the intended access model while ensuring each affected
--   role/action has only one permissive policy. Public catalog reads stay
--   public. Admin management is split into INSERT, UPDATE, and DELETE policies
--   so it no longer overlaps with SELECT. Orders are made customer/admin read
--   only because public order reads expose customer/order data and the app uses
--   authenticated or service-role access for order flows.

BEGIN;

-- =====================================================
-- public.orders
-- =====================================================
-- Customers can read their own orders; admins can read all orders. Customers
-- can create their own authenticated orders. Existing guest checkout/server
-- payment flows use the service role and are not dependent on public RLS.

DROP POLICY IF EXISTS "Admins can see all orders" ON public.orders;
DROP POLICY IF EXISTS "Customers can see their own orders" ON public.orders;
DROP POLICY IF EXISTS "Public read orders" ON public.orders;
DROP POLICY IF EXISTS "Users create own orders" ON public.orders;
DROP POLICY IF EXISTS "Authenticated users can create orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can update orders" ON public.orders;
DROP POLICY IF EXISTS "Orders are visible to customers and admins" ON public.orders;
DROP POLICY IF EXISTS "Users and admins can create orders" ON public.orders;
DROP POLICY IF EXISTS "Admins can update orders only" ON public.orders;
DROP POLICY IF EXISTS "Admins can delete orders" ON public.orders;

CREATE POLICY "Orders are visible to customers and admins"
  ON public.orders
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (SELECT public.is_admin())
  );

CREATE POLICY "Users and admins can create orders"
  ON public.orders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR user_id IS NULL
    OR (SELECT public.is_admin())
  );

CREATE POLICY "Admins can update orders only"
  ON public.orders
  FOR UPDATE
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can delete orders"
  ON public.orders
  FOR DELETE
  TO authenticated
  USING ((SELECT public.is_admin()));

-- =====================================================
-- public.products
-- =====================================================
-- Products are intentionally public-readable. Admin writes are separated from
-- SELECT so authenticated storefront/admin reads do not evaluate two policies.

DROP POLICY IF EXISTS "Admins can manage products" ON public.products;
DROP POLICY IF EXISTS "Allow public read access" ON public.products;
DROP POLICY IF EXISTS "Public SELECT products" ON public.products;
DROP POLICY IF EXISTS "Public read products" ON public.products;
DROP POLICY IF EXISTS "Public can view products" ON public.products;
DROP POLICY IF EXISTS "Admins can insert products" ON public.products;
DROP POLICY IF EXISTS "Admins can update products" ON public.products;
DROP POLICY IF EXISTS "Admins can delete products" ON public.products;

CREATE POLICY "Allow public read access"
  ON public.products
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins can insert products"
  ON public.products
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can update products"
  ON public.products
  FOR UPDATE
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can delete products"
  ON public.products
  FOR DELETE
  TO authenticated
  USING ((SELECT public.is_admin()));

-- =====================================================
-- public.product_variants
-- =====================================================

DROP POLICY IF EXISTS "Admins can manage product_variants" ON public.product_variants;
DROP POLICY IF EXISTS "Public read variants" ON public.product_variants;
DROP POLICY IF EXISTS "Public SELECT product_variants" ON public.product_variants;
DROP POLICY IF EXISTS "Public read product_variants" ON public.product_variants;
DROP POLICY IF EXISTS "Public can view product_variants" ON public.product_variants;
DROP POLICY IF EXISTS "Admins can insert product_variants" ON public.product_variants;
DROP POLICY IF EXISTS "Admins can update product_variants" ON public.product_variants;
DROP POLICY IF EXISTS "Admins can delete product_variants" ON public.product_variants;

CREATE POLICY "Public read variants"
  ON public.product_variants
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins can insert product_variants"
  ON public.product_variants
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can update product_variants"
  ON public.product_variants
  FOR UPDATE
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can delete product_variants"
  ON public.product_variants
  FOR DELETE
  TO authenticated
  USING ((SELECT public.is_admin()));

-- =====================================================
-- public.product_options
-- =====================================================

DROP POLICY IF EXISTS "Admins can manage product_options" ON public.product_options;
DROP POLICY IF EXISTS "Public read product_options" ON public.product_options;
DROP POLICY IF EXISTS "Public SELECT product_options" ON public.product_options;
DROP POLICY IF EXISTS "Allow public read access to product options" ON public.product_options;
DROP POLICY IF EXISTS "Public can view product_options" ON public.product_options;
DROP POLICY IF EXISTS "Admins can insert product_options" ON public.product_options;
DROP POLICY IF EXISTS "Admins can update product_options" ON public.product_options;
DROP POLICY IF EXISTS "Admins can delete product_options" ON public.product_options;

CREATE POLICY "Public read product_options"
  ON public.product_options
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins can insert product_options"
  ON public.product_options
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can update product_options"
  ON public.product_options
  FOR UPDATE
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can delete product_options"
  ON public.product_options
  FOR DELETE
  TO authenticated
  USING ((SELECT public.is_admin()));

-- =====================================================
-- public.product_option_values
-- =====================================================

DROP POLICY IF EXISTS "Admins can manage product_option_values" ON public.product_option_values;
DROP POLICY IF EXISTS "Public read product_option_values" ON public.product_option_values;
DROP POLICY IF EXISTS "Public SELECT product_option_values" ON public.product_option_values;
DROP POLICY IF EXISTS "Allow public read access to product option values" ON public.product_option_values;
DROP POLICY IF EXISTS "Public can view product_option_values" ON public.product_option_values;
DROP POLICY IF EXISTS "Admins can insert product_option_values" ON public.product_option_values;
DROP POLICY IF EXISTS "Admins can update product_option_values" ON public.product_option_values;
DROP POLICY IF EXISTS "Admins can delete product_option_values" ON public.product_option_values;

CREATE POLICY "Public read product_option_values"
  ON public.product_option_values
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins can insert product_option_values"
  ON public.product_option_values
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can update product_option_values"
  ON public.product_option_values
  FOR UPDATE
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can delete product_option_values"
  ON public.product_option_values
  FOR DELETE
  TO authenticated
  USING ((SELECT public.is_admin()));

-- =====================================================
-- public.product_categories
-- =====================================================

DROP POLICY IF EXISTS "Admins manage product_categories" ON public.product_categories;
DROP POLICY IF EXISTS "Public read product_categories" ON public.product_categories;
DROP POLICY IF EXISTS "Public SELECT product_categories" ON public.product_categories;
DROP POLICY IF EXISTS "Public can view product_categories" ON public.product_categories;
DROP POLICY IF EXISTS "Admins can insert product_categories" ON public.product_categories;
DROP POLICY IF EXISTS "Admins can update product_categories" ON public.product_categories;
DROP POLICY IF EXISTS "Admins can delete product_categories" ON public.product_categories;

CREATE POLICY "Public read product_categories"
  ON public.product_categories
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins can insert product_categories"
  ON public.product_categories
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can update product_categories"
  ON public.product_categories
  FOR UPDATE
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can delete product_categories"
  ON public.product_categories
  FOR DELETE
  TO authenticated
  USING ((SELECT public.is_admin()));

-- =====================================================
-- public.product_collections
-- =====================================================

DROP POLICY IF EXISTS "Admins can manage product_collections" ON public.product_collections;
DROP POLICY IF EXISTS "Admin manage product_collections" ON public.product_collections;
DROP POLICY IF EXISTS "Public read product_collections" ON public.product_collections;
DROP POLICY IF EXISTS "Public SELECT product_collections" ON public.product_collections;
DROP POLICY IF EXISTS "Public can view product_collections" ON public.product_collections;
DROP POLICY IF EXISTS "Admins can insert product_collections" ON public.product_collections;
DROP POLICY IF EXISTS "Admins can update product_collections" ON public.product_collections;
DROP POLICY IF EXISTS "Admins can delete product_collections" ON public.product_collections;

CREATE POLICY "Public read product_collections"
  ON public.product_collections
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins can insert product_collections"
  ON public.product_collections
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can update product_collections"
  ON public.product_collections
  FOR UPDATE
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can delete product_collections"
  ON public.product_collections
  FOR DELETE
  TO authenticated
  USING ((SELECT public.is_admin()));

-- =====================================================
-- public.product_combinations
-- =====================================================

DROP POLICY IF EXISTS "Admins manage product combinations" ON public.product_combinations;
DROP POLICY IF EXISTS "Allow public read access for product combinations" ON public.product_combinations;
DROP POLICY IF EXISTS "Public read product_combinations" ON public.product_combinations;
DROP POLICY IF EXISTS "Public SELECT product_combinations" ON public.product_combinations;
DROP POLICY IF EXISTS "Admins can insert product_combinations" ON public.product_combinations;
DROP POLICY IF EXISTS "Admins can update product_combinations" ON public.product_combinations;
DROP POLICY IF EXISTS "Admins can delete product_combinations" ON public.product_combinations;

CREATE POLICY "Allow public read access for product combinations"
  ON public.product_combinations
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins can insert product_combinations"
  ON public.product_combinations
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can update product_combinations"
  ON public.product_combinations
  FOR UPDATE
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can delete product_combinations"
  ON public.product_combinations
  FOR DELETE
  TO authenticated
  USING ((SELECT public.is_admin()));

COMMIT;
