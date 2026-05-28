-- Add admin-managed Partial Payment percentage rules by final order amount.
-- Existing payment_providers.partial_payment_percentage remains as fallback.

BEGIN;

CREATE TABLE IF NOT EXISTS public.partial_payment_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_provider_id TEXT NOT NULL REFERENCES public.payment_providers(id) ON DELETE CASCADE,
  min_order_amount NUMERIC NOT NULL DEFAULT 0,
  max_order_amount NUMERIC DEFAULT NULL,
  advance_percentage NUMERIC NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT partial_payment_rules_amount_check CHECK (
    min_order_amount >= 0
    AND (max_order_amount IS NULL OR max_order_amount > min_order_amount)
  ),
  CONSTRAINT partial_payment_rules_percentage_check CHECK (
    advance_percentage > 0
    AND advance_percentage < 100
  )
);

CREATE INDEX IF NOT EXISTS partial_payment_rules_provider_active_idx
  ON public.partial_payment_rules(payment_provider_id, is_active, min_order_amount, max_order_amount);

CREATE OR REPLACE FUNCTION public.prevent_partial_payment_rule_overlap()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.is_active AND EXISTS (
    SELECT 1
    FROM public.partial_payment_rules existing
    WHERE existing.payment_provider_id = NEW.payment_provider_id
      AND existing.is_active = true
      AND existing.id <> NEW.id
      AND NOT (
        COALESCE(existing.max_order_amount, 999999999999999) < NEW.min_order_amount
        OR COALESCE(NEW.max_order_amount, 999999999999999) < existing.min_order_amount
      )
  ) THEN
    RAISE EXCEPTION 'Active partial payment ranges cannot overlap for the same provider.';
  END IF;

  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_partial_payment_rule_overlap_trigger
  ON public.partial_payment_rules;

CREATE TRIGGER prevent_partial_payment_rule_overlap_trigger
  BEFORE INSERT OR UPDATE ON public.partial_payment_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_partial_payment_rule_overlap();

ALTER TABLE public.partial_payment_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read active partial_payment_rules"
  ON public.partial_payment_rules;
DROP POLICY IF EXISTS "Admins read partial_payment_rules"
  ON public.partial_payment_rules;
DROP POLICY IF EXISTS "Admins can insert partial_payment_rules"
  ON public.partial_payment_rules;
DROP POLICY IF EXISTS "Admins can update partial_payment_rules"
  ON public.partial_payment_rules;
DROP POLICY IF EXISTS "Admins can delete partial_payment_rules"
  ON public.partial_payment_rules;

CREATE POLICY "Public read active partial_payment_rules"
  ON public.partial_payment_rules
  FOR SELECT
  TO public
  USING (is_active = true);

CREATE POLICY "Admins read partial_payment_rules"
  ON public.partial_payment_rules
  FOR SELECT
  TO authenticated
  USING ((SELECT public.is_admin()));

CREATE POLICY "Admins can insert partial_payment_rules"
  ON public.partial_payment_rules
  FOR INSERT
  TO authenticated
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can update partial_payment_rules"
  ON public.partial_payment_rules
  FOR UPDATE
  TO authenticated
  USING ((SELECT public.is_admin()))
  WITH CHECK ((SELECT public.is_admin()));

CREATE POLICY "Admins can delete partial_payment_rules"
  ON public.partial_payment_rules
  FOR DELETE
  TO authenticated
  USING ((SELECT public.is_admin()));

INSERT INTO public.partial_payment_rules (
  payment_provider_id,
  min_order_amount,
  max_order_amount,
  advance_percentage,
  is_active,
  sort_order
)
SELECT
  id,
  0,
  NULL,
  COALESCE(partial_payment_percentage, 20),
  true,
  0
FROM public.payment_providers
WHERE id = 'pp_easebuzz_partial_payment'
  AND NOT EXISTS (
    SELECT 1
    FROM public.partial_payment_rules
    WHERE payment_provider_id = 'pp_easebuzz_partial_payment'
  );

COMMIT;
