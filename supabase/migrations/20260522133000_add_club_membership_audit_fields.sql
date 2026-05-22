ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS club_membership_status TEXT NOT NULL DEFAULT 'none',
ADD COLUMN IF NOT EXISTS club_qualifying_order_id TEXT,
ADD COLUMN IF NOT EXISTS club_revocation_reason TEXT;

ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_club_membership_status_check;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_club_membership_status_check
CHECK (club_membership_status IN ('none', 'pending_eligible', 'active', 'revoked'));

UPDATE public.profiles
SET club_membership_status = CASE
  WHEN COALESCE(is_club_member, false) = true THEN 'active'
  ELSE 'none'
END
WHERE club_membership_status = 'none';

CREATE INDEX IF NOT EXISTS idx_profiles_club_qualifying_order_id
ON public.profiles(club_qualifying_order_id)
WHERE club_qualifying_order_id IS NOT NULL;
