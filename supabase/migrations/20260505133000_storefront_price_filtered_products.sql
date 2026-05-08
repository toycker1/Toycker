-- Move storefront price filtering into the database so price-filtered pages
-- return only the requested page instead of scanning extra product rows in app code.

BEGIN;

CREATE INDEX IF NOT EXISTS idx_product_variants_product_id_price
  ON public.product_variants(product_id, price);

CREATE OR REPLACE FUNCTION public.list_storefront_products_by_price(
  p_min_price numeric DEFAULT NULL,
  p_max_price numeric DEFAULT NULL,
  p_category_ids text[] DEFAULT NULL,
  p_collection_ids text[] DEFAULT NULL,
  p_product_ids text[] DEFAULT NULL,
  p_search_query text DEFAULT NULL,
  p_availability text DEFAULT NULL,
  p_sort_by text DEFAULT 'featured',
  p_offset integer DEFAULT 0,
  p_limit integer DEFAULT 12
)
RETURNS TABLE (
  id text,
  handle text,
  name text,
  short_description text,
  price numeric,
  currency_code text,
  image_url text,
  thumbnail text,
  stock_count integer,
  metadata jsonb,
  category_id text,
  collection_id text,
  created_at timestamptz,
  updated_at timestamptz,
  status text,
  variants jsonb,
  display_price numeric,
  total_count bigint
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH product_prices AS (
    SELECT
      p.id,
      p.handle,
      p.name,
      p.short_description,
      p.price,
      p.currency_code,
      p.image_url,
      p.thumbnail,
      p.stock_count,
      p.metadata,
      p.category_id,
      p.collection_id,
      p.created_at,
      p.updated_at,
      p.status,
      COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object(
              'id', v.id,
              'title', v.title,
              'price', v.price,
              'compare_at_price', v.compare_at_price,
              'inventory_quantity', v.inventory_quantity,
              'manage_inventory', v.manage_inventory,
              'allow_backorder', v.allow_backorder,
              'product_id', v.product_id,
              'image_url', v.image_url,
              'options', v.options
            )
            ORDER BY v.price ASC, v.created_at ASC
          )
          FROM public.product_variants v
          WHERE v.product_id = p.id
        ),
        '[]'::jsonb
      ) AS variants,
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
  ),
  filtered AS (
    SELECT *
    FROM product_prices
    WHERE display_price <> 0
      AND (p_min_price IS NULL OR display_price >= p_min_price)
      AND (p_max_price IS NULL OR display_price <= p_max_price)
  ),
  counted AS (
    SELECT
      filtered.*,
      count(*) OVER () AS total_count
    FROM filtered
  )
  SELECT
    counted.id,
    counted.handle,
    counted.name,
    counted.short_description,
    counted.price,
    counted.currency_code,
    counted.image_url,
    counted.thumbnail,
    counted.stock_count,
    counted.metadata,
    counted.category_id,
    counted.collection_id,
    counted.created_at,
    counted.updated_at,
    counted.status,
    counted.variants,
    counted.display_price,
    counted.total_count
  FROM counted
  ORDER BY
    CASE WHEN p_sort_by = 'price_asc' THEN counted.display_price END ASC NULLS LAST,
    CASE WHEN p_sort_by = 'price_desc' THEN counted.display_price END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'alpha_asc' THEN counted.name END ASC NULLS LAST,
    CASE WHEN p_sort_by = 'alpha_desc' THEN counted.name END DESC NULLS LAST,
    CASE WHEN p_sort_by = 'date_old_new' THEN counted.created_at END ASC NULLS LAST,
    CASE WHEN p_sort_by IN ('date_new_old', 'featured', 'best_selling') OR p_sort_by IS NULL THEN counted.created_at END DESC NULLS LAST,
    counted.created_at DESC,
    counted.id ASC
  OFFSET GREATEST(p_offset, 0)
  LIMIT LEAST(GREATEST(p_limit, 1), 100);
$$;

COMMENT ON FUNCTION public.list_storefront_products_by_price IS
  'Storefront product listing helper that applies variant-aware price filtering, sorting, and pagination in SQL.';

COMMIT;
