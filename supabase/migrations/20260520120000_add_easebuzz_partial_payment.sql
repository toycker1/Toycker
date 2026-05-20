-- Add Easebuzz partial-payment provider support.
-- Full Easebuzz payments remain on pp_easebuzz_easebuzz.

ALTER TABLE public.payment_providers
ADD COLUMN IF NOT EXISTS partial_payment_percentage NUMERIC DEFAULT NULL;

INSERT INTO public.payment_providers (
  id,
  name,
  description,
  is_active,
  discount_percentage,
  partial_payment_percentage
)
VALUES (
  'pp_easebuzz_partial_payment',
  'Partial Payment',
  'Pay an advance amount now. Remaining balance will be handled by admin.',
  false,
  0,
  20
)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  partial_payment_percentage = COALESCE(
    public.payment_providers.partial_payment_percentage,
    EXCLUDED.partial_payment_percentage
  ),
  discount_percentage = 0;
