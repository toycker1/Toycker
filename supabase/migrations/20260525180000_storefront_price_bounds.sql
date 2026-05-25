-- Provide variant-aware price bounds for the storefront price slider.
-- Bounds use the current non-price listing filters and intentionally ignore
-- pagination and the active price range.

BEGIN;

CREATE OR REPLACE FUNCTION public.get_storefront_product_price_bounds(
  p_category_ids text[] DEFAULT NULL,
  p_collection_ids text[] DEFAULT NULL,
  p_product_ids text[] DEFAULT NULL,
  p_search_query text DEFAULT NULL,
  p_availability text DEFAULT NULL
)
RETURNS TABLE (
  min_price numeric,
  max_price numeric
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH product_prices AS (
    SELECT
      COALESCE(
        (
          SELECT min(v.price)
          FROM public.product_variants v
          WHERE v.product_id = p.id
        ),
        p.price
      ) AS display_price
    FROM public.products p
    WHERE p.status = 'active'
      AND (
        p_product_ids IS NULL
        OR cardinality(p_product_ids) = 0
        OR p.id = ANY(p_product_ids)
      )
      AND (
        p_category_ids IS NULL
        OR cardinality(p_category_ids) = 0
        OR EXISTS (
          SELECT 1
          FROM public.product_categories pc
          WHERE pc.product_id = p.id
            AND pc.category_id = ANY(p_category_ids)
        )
      )
      AND (
        p_collection_ids IS NULL
        OR cardinality(p_collection_ids) = 0
        OR EXISTS (
          SELECT 1
          FROM public.product_collections pcl
          WHERE pcl.product_id = p.id
            AND pcl.collection_id = ANY(p_collection_ids)
        )
      )
      AND (
        p_search_query IS NULL
        OR p.name ILIKE ('%' || p_search_query || '%')
      )
      AND (
        p_availability IS NULL
        OR (p_availability = 'in_stock' AND p.stock_count > 0)
        OR (p_availability = 'out_of_stock' AND p.stock_count = 0)
      )
  )
  SELECT
    min(display_price) AS min_price,
    max(display_price) AS max_price
  FROM product_prices
  WHERE display_price <> 0;
$$;

COMMENT ON FUNCTION public.get_storefront_product_price_bounds IS
  'Returns variant-aware storefront price slider bounds for the current non-price product filters.';

COMMIT;
