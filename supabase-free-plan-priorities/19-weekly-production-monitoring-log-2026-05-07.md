# Priority 19 Weekly Production Monitoring Log - 07 May 2026

## Review Metadata

```txt
Review date: 07 May 2026
Reviewer: User-provided Supabase dashboard screenshots
Billing cycle: 25 Apr 2026 - 25 May 2026
Production project: toycker
Production ref: xhfasilbxjjxaqgxkann
Latest deployed commit: check Git/Vercel before next production change
Recent deployment date: check Vercel before next production change
Next review date: 14 May 2026, or earlier if egress crosses 4.0 GB
```

## Supabase Usage Numbers

```txt
Total egress: 3.886 GB
Cached egress: 0.001 GB
Database requests: not visible in supplied screenshot
Auth requests: not visible in supplied screenshot
Storage requests: not visible in supplied screenshot
Realtime messages: 63
Realtime peak connections: 12
Database size: 0.039 GB
Storage size: 0 GB
Edge Function invocations: 0
Monthly active users: 25 MAU
Monthly active third-party users: 0 MAU
Monthly active SSO users: 0 MAU
Storage image transformations: 0
```

## Egress Breakdown From Dashboard

```txt
07 May 2026 PostgREST egress: 26.967 MB, about 96.6%
07 May 2026 Auth egress: 790.228 KB, about 2.8%
07 May 2026 Realtime egress: 200.153 KB, about 0.7%
07 May 2026 Cached egress: 30.912 KB
Storage egress: dashboard tooltip showed NaN/undefined, while Storage size is 0 GB
Database size detail: 37.12 MB
```

## Threshold Decision

```txt
Status: Watch closely
Reason: Total egress is 3.886 GB, which is inside the 3.5 GB to 4.0 GB watch range.
Action owner: Project owner/developer
Due date: Continue monitoring now; review again by 14 May 2026 or earlier if total egress crosses 4.0 GB.
```

## Expected Toycker Baseline Checks

```txt
Storage bucket count is still 0: consistent with Storage size 0 GB
Product Supabase Storage URLs are still 0: not rechecked in this screenshot set
Product CDN URLs still use https://cdn.toycker.in: not rechecked in this screenshot set
Realtime publication tables are still only orders and admin_notifications: verified previously; not rechecked in this screenshot set
Public listing payload still looks lightweight: verified during previous priority testing
Layout state response still looks small: verified during previous priority testing
Visual search response still excludes embeddings: verified during previous priority testing
Admin export/import was not run heavily this week: avoid until egress trend is safer
```

## Interpretation

The project is not over the Free Plan quota in this screenshot, but it is close enough that monitoring should be strict.

The main source shown by the dashboard is PostgREST/database egress, not Supabase Storage, Edge Functions, or Realtime.

This means the team should continue watching database/API traffic first. If usage increases again, use these files before changing code:

```txt
Product listing: 01, 02, 03, 06
Product detail: 13-product-detail-full-payload-risk.md
Cart/checkout: 14-cart-checkout-and-stale-cart-risk.md
Visual search: 15-visual-search-and-embedding-risk.md
Admin/export/import: 16-admin-dashboard-export-risk.md
Media/CDN/Storage: 17-media-cdn-cache-regression-risk.md
Bots/prefetch/public traffic: 18-bot-prefetch-and-public-traffic-risk.md
Monitoring process: 19-production-monitoring-and-alerting.md
```

## Immediate Action

```txt
Do not run load-style testing.
Avoid repeated visual-search testing unless needed.
Avoid repeated cart/checkout refresh testing unless needed.
Avoid admin export/import testing unless needed.
Check Supabase Usage again if total egress crosses 4.0 GB.
If total egress crosses 4.0 GB, inspect Supabase Logs Explorer and Query Performance before changing code.
```

## Final Review Result

```txt
Is Supabase Free Plan usage safe this week: Safe but watch closely
Is any action required: Monitoring action only
Action summary: Continue weekly review; investigate immediately if total egress crosses 4.0 GB.
Follow-up owner: Project owner/developer
Follow-up date: 14 May 2026
```
