# Priority 11: Monitoring And Usage Review

## Classification

`Supabase-only`

## Priority

Do this continuously. It does not block code-only improvements.

## Problem

The Free Plan can continue working only if usage stays below quota. The project needs a simple review process so egress does not quietly approach the limit again.

## Current Toycker Evidence

The supplied screenshot showed:

- Egress: 2.867 GB / 5 GB
- Database Size: 0.039 GB / 0.5 GB
- Storage Size: 0 GB / 1 GB
- Monthly Active Users: 14 / 50,000
- Realtime Messages: 56 / 2,000,000

The main risk is egress, especially database egress.

## Recommended Supabase-Only Process

Check Supabase Usage weekly during active development and more frequently after deployments.

Review:

- Egress
- Cached Egress
- Database requests
- Auth requests
- Storage requests
- Realtime messages
- Realtime peak connections
- Database size
- Storage size

If egress grows quickly:

- Check which project is using it.
- Check whether database requests increased.
- Review frequently used API routes.
- Inspect query performance and heavy responses.
- Confirm no bot/test script is repeatedly hitting storefront APIs.

## Alert Thresholds

Recommended internal thresholds for a Free Plan project:

- 3.0 GB egress: review recent deploys and traffic.
- 3.5 GB egress: pause non-essential testing and optimize high-traffic queries.
- 4.0 GB egress: treat as urgent; reduce traffic and merge optimization fixes.
- 4.5 GB egress: avoid load testing, heavy admin exports, and repeated media checks.

## Expected Impact

- Reduces risk of surprise restrictions.
- Gives the team time to react before reaching Free Plan limits.
- Helps validate whether code optimizations are working.

## Risks / Notes

- Supabase dashboard usage can lag.
- One-time imports, bots, or manual testing can distort short-term numbers.
- Monitoring does not reduce usage by itself; it only catches risk earlier.

## Acceptance Checks

- Weekly review owner is assigned.
- Egress is checked against the thresholds above.
- After each optimization deployment, compare usage trend before and after.
- If usage approaches 4 GB, code-only priorities are reviewed before considering any upgrade.

## References

- Supabase billing: https://supabase.com/docs/guides/platform/billing-on-supabase
- Supabase billing FAQ: https://supabase.com/docs/guides/platform/billing-faq
- Supabase egress overview: https://supabase.com/docs/guides/troubleshooting/all-about-supabase-egress-a_Sg_e
