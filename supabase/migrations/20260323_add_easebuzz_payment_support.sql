-- Add Easebuzz payment gateway support
-- Strategy: additive only — existing payu_txn_id column and pp_payu_payu row are untouched for safe revert

-- Add gateway_txn_id column for storing Easebuzz (and future gateway) transaction IDs
ALTER TABLE orders ADD COLUMN IF NOT EXISTS gateway_txn_id TEXT;

-- Add Easebuzz payment provider row (does not modify existing pp_payu_payu row)
INSERT INTO payment_providers (id, name, description, is_active, discount_percentage)
VALUES (
  'pp_easebuzz_easebuzz',
  'Easebuzz',
  'Pay securely using cards, UPI, net banking, or wallets.',
  true,
  0
)
ON CONFLICT (id) DO NOTHING;
