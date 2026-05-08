INSERT INTO public.shipping_partners (id, name, is_active)
SELECT 'sp_trivara_logistics', 'Trivara Logistics', true
WHERE NOT EXISTS (
  SELECT 1
  FROM public.shipping_partners
  WHERE lower(name) = lower('Trivara Logistics')
);
