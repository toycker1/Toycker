CREATE TABLE IF NOT EXISTS public.trivara_order_bookings (
  id TEXT PRIMARY KEY DEFAULT ('tob_' || uuid_generate_v4()),
  order_id TEXT NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'booked', 'failed', 'skipped', 'cancelled')),
  trivara_reference_number TEXT,
  request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_payload JSONB,
  error_message TEXT,
  tracking_status TEXT,
  tracking_payload JSONB,
  tracking_synced_at TIMESTAMP WITH TIME ZONE,
  print_slip_payload JSONB,
  print_slip_synced_at TIMESTAMP WITH TIME ZONE,
  cancel_payload JSONB,
  cancel_error_message TEXT,
  cancelled_at TIMESTAMP WITH TIME ZONE,
  booked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT trivara_order_bookings_order_id_key UNIQUE (order_id)
);

ALTER TABLE public.trivara_order_bookings ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.trivara_sync_snapshots (
  sync_key TEXT PRIMARY KEY,
  request_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  response_payload JSONB,
  error_message TEXT,
  synced_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.trivara_sync_snapshots ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_trivara_order_bookings_order_id
  ON public.trivara_order_bookings(order_id);

CREATE INDEX IF NOT EXISTS idx_trivara_order_bookings_status
  ON public.trivara_order_bookings(status);

CREATE OR REPLACE FUNCTION public.update_trivara_order_bookings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_trivara_order_bookings_updated_at ON public.trivara_order_bookings;

CREATE TRIGGER set_trivara_order_bookings_updated_at
  BEFORE UPDATE ON public.trivara_order_bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_trivara_order_bookings_updated_at();

CREATE OR REPLACE FUNCTION public.update_trivara_sync_snapshots_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_trivara_sync_snapshots_updated_at ON public.trivara_sync_snapshots;

CREATE TRIGGER set_trivara_sync_snapshots_updated_at
  BEFORE UPDATE ON public.trivara_sync_snapshots
  FOR EACH ROW
  EXECUTE FUNCTION public.update_trivara_sync_snapshots_updated_at();
