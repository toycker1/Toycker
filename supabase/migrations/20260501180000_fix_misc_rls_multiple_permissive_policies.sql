-- Fix Supabase Advisor multiple permissive policy warnings for payment,
-- profile, promotion, review, reward, search analytics, and shipping tables.
--
-- Root cause:
--   These tables had permissive policies that overlapped for the same role and
--   command. The most common pattern was a public/user policy plus an
--   authenticated admin FOR ALL policy. PostgreSQL applies FOR ALL policies to
--   SELECT, INSERT, UPDATE, and DELETE, so authenticated requests can match and
--   evaluate multiple policies for one action.
--
-- Fix:
--   Preserve Toycker's existing access model while ensuring each affected
--   role/action has only one permissive policy. Public/storefront reads remain
--   public where currently intended. Customer-owned rows remain scoped to the
--   authenticated user. Admin management is split into command-specific
--   policies so it no longer overlaps with SELECT or customer INSERT policies.

BEGIN;

-- =====================================================
-- public.payment_providers
-- =====================================================
-- Storefront checkout can read payment methods. Admin writes are separated
-- from SELECT so authenticated reads do not match two policies.

DROP POLICY IF EXISTS "Admins manage payment_providers" ON public.payment_providers;
DROP POLICY IF EXISTS "Public read payment_providers" ON public.payment_providers;
DROP POLICY IF EXISTS "Public can view payment_providers" ON public.payment_providers;
DROP POLICY IF EXISTS "Public SELECT payment_providers" ON public.payment_providers;
DROP POLICY IF EXISTS "Admins can insert payment_providers" ON public.payment_providers;
DROP POLICY IF EXISTS "Admins can update payment_providers" ON public.payment_providers;
DROP POLICY IF EXISTS "Admins can delete payment_providers" ON public.payment_providers;

CREATE POLICY "Public read payment_providers"
  ON public.payment_providers
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins can insert payment_providers"
  ON public.payment_providers
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can update payment_providers"
  ON public.payment_providers
  FOR UPDATE
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can delete payment_providers"
  ON public.payment_providers
  FOR DELETE
  TO authenticated
  USING ((SELECT public.is_admin()));

-- =====================================================
-- public.profiles
-- =====================================================
-- Users can read/update their own profile. Admins can read/update all profiles.
-- The customers:delete policy is intentionally left separate because it applies
-- only to DELETE and is permission-specific.

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Consolidated SELECT for profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users and admins can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
DROP POLICY IF EXISTS "Consolidated UPDATE for profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users and admins can update profiles" ON public.profiles;

CREATE POLICY "Users and admins can view profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR (SELECT public.is_admin())
  );

CREATE POLICY "Users and admins can update profiles"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (
    id = (SELECT auth.uid())
    OR (SELECT public.is_admin())
  )
  WITH CHECK (
    id = (SELECT auth.uid())
    OR (SELECT public.is_admin())
  );

-- =====================================================
-- public.promotions
-- =====================================================
-- Public users can read active, non-deleted promotions for discount validation.
-- Admins can read all promotions through the same SELECT policy.

DROP POLICY IF EXISTS "Admins manage promotions" ON public.promotions;
DROP POLICY IF EXISTS "Admins read all promotions" ON public.promotions;
DROP POLICY IF EXISTS "Public read active promotions" ON public.promotions;
DROP POLICY IF EXISTS "Consolidated SELECT for promotions" ON public.promotions;
DROP POLICY IF EXISTS "Public and admins can view promotions" ON public.promotions;
DROP POLICY IF EXISTS "Admins can insert promotions" ON public.promotions;
DROP POLICY IF EXISTS "Admins can update promotions" ON public.promotions;
DROP POLICY IF EXISTS "Admins can delete promotions" ON public.promotions;

CREATE POLICY "Public and admins can view promotions"
  ON public.promotions
  FOR SELECT
  TO public
  USING (
    (
      is_active = true
      AND is_deleted = false
      AND (starts_at IS NULL OR starts_at <= now())
    )
    OR (SELECT public.is_admin())
  );

CREATE POLICY "Admins can insert promotions"
  ON public.promotions
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can update promotions"
  ON public.promotions
  FOR UPDATE
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can delete promotions"
  ON public.promotions
  FOR DELETE
  TO authenticated
  USING ((SELECT public.is_admin()));

-- =====================================================
-- public.review_media
-- =====================================================
-- Review media remains publicly readable. Users can upload media for their own
-- reviews, and admins can upload/manage review media.

DROP POLICY IF EXISTS "Admins can manage review media" ON public.review_media;
DROP POLICY IF EXISTS "Public can view review media" ON public.review_media;
DROP POLICY IF EXISTS "Public SELECT review_media" ON public.review_media;
DROP POLICY IF EXISTS "Users upload review media for their reviews" ON public.review_media;
DROP POLICY IF EXISTS "Authenticated users can upload review media" ON public.review_media;
DROP POLICY IF EXISTS "Users and admins can upload review media" ON public.review_media;
DROP POLICY IF EXISTS "Admins can update review media" ON public.review_media;
DROP POLICY IF EXISTS "Admins can delete review media" ON public.review_media;

CREATE POLICY "Public can view review media"
  ON public.review_media
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Users and admins can upload review media"
  ON public.review_media
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (SELECT public.is_admin())
    OR EXISTS (
      SELECT 1
      FROM public.reviews r
      WHERE r.id = review_id
        AND r.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Admins can update review media"
  ON public.review_media
  FOR UPDATE
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can delete review media"
  ON public.review_media
  FOR DELETE
  TO authenticated
  USING ((SELECT public.is_admin()));

-- =====================================================
-- public.reviews
-- =====================================================
-- Approved reviews remain public. Authenticated users can also see their own
-- pending/rejected reviews, while admins can see and manage all reviews.

DROP POLICY IF EXISTS "Admins can manage reviews" ON public.reviews;
DROP POLICY IF EXISTS "Admins can do everything on reviews" ON public.reviews;
DROP POLICY IF EXISTS "Public can view approved reviews" ON public.reviews;
DROP POLICY IF EXISTS "Public can view reviews" ON public.reviews;
DROP POLICY IF EXISTS "Public SELECT reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users can view their own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users create their own reviews" ON public.reviews;
DROP POLICY IF EXISTS "Authenticated users can create reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users and admins can view reviews" ON public.reviews;
DROP POLICY IF EXISTS "Users and admins can create reviews" ON public.reviews;
DROP POLICY IF EXISTS "Admins can update reviews" ON public.reviews;
DROP POLICY IF EXISTS "Admins can delete reviews" ON public.reviews;

CREATE POLICY "Public can view approved reviews"
  ON public.reviews
  FOR SELECT
  TO anon
  USING (approval_status = 'approved');

CREATE POLICY "Users and admins can view reviews"
  ON public.reviews
  FOR SELECT
  TO authenticated
  USING (
    approval_status = 'approved'
    OR user_id = (SELECT auth.uid())
    OR (SELECT public.is_admin())
  );

CREATE POLICY "Users and admins can create reviews"
  ON public.reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR (SELECT public.is_admin())
  );

CREATE POLICY "Admins can update reviews"
  ON public.reviews
  FOR UPDATE
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can delete reviews"
  ON public.reviews
  FOR DELETE
  TO authenticated
  USING ((SELECT public.is_admin()));

-- =====================================================
-- public.reward_transactions
-- =====================================================
-- Users can read transactions for their own wallet; admins can read all.
-- Existing user INSERT behavior is unchanged.

DROP POLICY IF EXISTS "Users read own transactions" ON public.reward_transactions;
DROP POLICY IF EXISTS "Admins read all reward transactions" ON public.reward_transactions;
DROP POLICY IF EXISTS "Consolidated SELECT for reward_transactions" ON public.reward_transactions;
DROP POLICY IF EXISTS "Users and admins can view reward transactions" ON public.reward_transactions;

CREATE POLICY "Users and admins can view reward transactions"
  ON public.reward_transactions
  FOR SELECT
  TO authenticated
  USING (
    wallet_id IN (
      SELECT rw.id
      FROM public.reward_wallets rw
      WHERE rw.user_id = (SELECT auth.uid())
    )
    OR (SELECT public.is_admin())
  );

-- =====================================================
-- public.reward_wallets
-- =====================================================
-- Users can read their own wallet; admins can read all. Existing user
-- INSERT/UPDATE behavior is unchanged.

DROP POLICY IF EXISTS "Users read own wallet" ON public.reward_wallets;
DROP POLICY IF EXISTS "Admins read all wallets" ON public.reward_wallets;
DROP POLICY IF EXISTS "Consolidated SELECT for reward_wallets" ON public.reward_wallets;
DROP POLICY IF EXISTS "Users and admins can view reward wallets" ON public.reward_wallets;

CREATE POLICY "Users and admins can view reward wallets"
  ON public.reward_wallets
  FOR SELECT
  TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR (SELECT public.is_admin())
  );

-- =====================================================
-- public.search_analytics
-- =====================================================
-- Public search tracking remains INSERT-only. Admin access is split so
-- authenticated INSERT does not match both public tracking and admin FOR ALL.

DROP POLICY IF EXISTS "Admins can manage search_analytics" ON public.search_analytics;
DROP POLICY IF EXISTS "Admins can read search_analytics" ON public.search_analytics;
DROP POLICY IF EXISTS "Admins can update search_analytics" ON public.search_analytics;
DROP POLICY IF EXISTS "Admins can delete search_analytics" ON public.search_analytics;

CREATE POLICY "Admins can read search_analytics"
  ON public.search_analytics
  FOR SELECT
  TO authenticated
  USING ((SELECT public.is_admin()));

CREATE POLICY "Admins can update search_analytics"
  ON public.search_analytics
  FOR UPDATE
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can delete search_analytics"
  ON public.search_analytics
  FOR DELETE
  TO authenticated
  USING ((SELECT public.is_admin()));

-- =====================================================
-- public.shipping_options
-- =====================================================
-- Storefront checkout can read shipping options. Admin writes are separated
-- from SELECT so authenticated reads do not match two policies.

DROP POLICY IF EXISTS "Admins manage shipping_options" ON public.shipping_options;
DROP POLICY IF EXISTS "Public read shipping_options" ON public.shipping_options;
DROP POLICY IF EXISTS "Public can view shipping_options" ON public.shipping_options;
DROP POLICY IF EXISTS "Public SELECT shipping_options" ON public.shipping_options;
DROP POLICY IF EXISTS "Admins can insert shipping_options" ON public.shipping_options;
DROP POLICY IF EXISTS "Admins can update shipping_options" ON public.shipping_options;
DROP POLICY IF EXISTS "Admins can delete shipping_options" ON public.shipping_options;

CREATE POLICY "Public read shipping_options"
  ON public.shipping_options
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins can insert shipping_options"
  ON public.shipping_options
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can update shipping_options"
  ON public.shipping_options
  FOR UPDATE
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can delete shipping_options"
  ON public.shipping_options
  FOR DELETE
  TO authenticated
  USING ((SELECT public.is_admin()));

-- =====================================================
-- public.shipping_partners
-- =====================================================
-- Shipping partners remain publicly readable for order tracking joins. Admin
-- writes are separated from SELECT.

DROP POLICY IF EXISTS "Admins can manage shipping_partners" ON public.shipping_partners;
DROP POLICY IF EXISTS "Public read shipping_partners" ON public.shipping_partners;
DROP POLICY IF EXISTS "Public can view shipping_partners" ON public.shipping_partners;
DROP POLICY IF EXISTS "Public SELECT shipping_partners" ON public.shipping_partners;
DROP POLICY IF EXISTS "Admins can insert shipping_partners" ON public.shipping_partners;
DROP POLICY IF EXISTS "Admins can update shipping_partners" ON public.shipping_partners;
DROP POLICY IF EXISTS "Admins can delete shipping_partners" ON public.shipping_partners;

CREATE POLICY "Public read shipping_partners"
  ON public.shipping_partners
  FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins can insert shipping_partners"
  ON public.shipping_partners
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can update shipping_partners"
  ON public.shipping_partners
  FOR UPDATE
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can delete shipping_partners"
  ON public.shipping_partners
  FOR DELETE
  TO authenticated
  USING ((SELECT public.is_admin()));

COMMIT;
