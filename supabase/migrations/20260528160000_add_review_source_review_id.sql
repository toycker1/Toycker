BEGIN;

ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS source_review_id text;

CREATE UNIQUE INDEX IF NOT EXISTS reviews_product_source_review_id_unique
  ON public.reviews (product_id, source_review_id)
  WHERE source_review_id IS NOT NULL;

COMMIT;
