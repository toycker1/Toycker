ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS contact_email TEXT;

UPDATE public.profiles
SET contact_email = NULLIF(BTRIM(email), '')
WHERE COALESCE(BTRIM(contact_email), '') = ''
  AND COALESCE(BTRIM(email), '') <> ''
  AND LOWER(BTRIM(email)) NOT LIKE '%@wa.toycker.store';

WITH order_email_candidates AS (
  SELECT
    o.user_id,
    COALESCE(
      CASE
        WHEN COALESCE(BTRIM(o.customer_email), '') <> ''
          AND LOWER(BTRIM(o.customer_email)) NOT LIKE '%@wa.toycker.store'
          THEN BTRIM(o.customer_email)
        ELSE NULL
      END,
      CASE
        WHEN COALESCE(BTRIM(o.email), '') <> ''
          AND LOWER(BTRIM(o.email)) NOT LIKE '%@wa.toycker.store'
          THEN BTRIM(o.email)
        ELSE NULL
      END
    ) AS resolved_email,
    o.created_at,
    o.id
  FROM public.orders o
  WHERE o.user_id IS NOT NULL
),
latest_order_email AS (
  SELECT
    user_id,
    resolved_email,
    ROW_NUMBER() OVER (
      PARTITION BY user_id
      ORDER BY created_at DESC, id DESC
    ) AS row_number
  FROM order_email_candidates
  WHERE resolved_email IS NOT NULL
)
UPDATE public.profiles p
SET contact_email = latest_order_email.resolved_email
FROM latest_order_email
WHERE p.id = latest_order_email.user_id
  AND latest_order_email.row_number = 1
  AND latest_order_email.resolved_email IS NOT NULL
  AND COALESCE(BTRIM(p.contact_email), '') = '';

UPDATE public.carts c
SET
  email = p.contact_email,
  updated_at = NOW()
FROM public.profiles p
WHERE c.user_id = p.id
  AND COALESCE(BTRIM(p.contact_email), '') <> ''
  AND COALESCE(BTRIM(c.email), '') <> ''
  AND LOWER(BTRIM(c.email)) LIKE '%@wa.toycker.store';

UPDATE public.orders o
SET
  customer_email = p.contact_email,
  email = p.contact_email,
  updated_at = NOW()
FROM public.profiles p
WHERE o.user_id = p.id
  AND COALESCE(BTRIM(p.contact_email), '') <> ''
  AND (
    (
      COALESCE(BTRIM(o.customer_email), '') <> ''
      AND LOWER(BTRIM(o.customer_email)) LIKE '%@wa.toycker.store'
    )
    OR (
      COALESCE(BTRIM(o.email), '') <> ''
      AND LOWER(BTRIM(o.email)) LIKE '%@wa.toycker.store'
    )
  );
