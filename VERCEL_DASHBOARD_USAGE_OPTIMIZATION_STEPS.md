# Vercel Dashboard Usage Optimization Steps

This document explains the non-code changes that should be done directly inside Vercel to reduce Toycker's Hobby plan usage. It is based on the existing `VERCEL_FREE_PLAN_USAGE_OPTIMIZATION.md`, the Vercel screenshots, and the current codebase behavior.

## Current Situation

Toycker is live and working, but the Vercel Hobby limits are being consumed quickly.

The strongest signals from Vercel are:

- Fast Data Transfer is almost full.
- Fast Origin Transfer exceeded the Hobby limit.
- Edge Requests exceeded the Hobby limit.
- Function Invocations exceeded the Hobby limit.
- Middleware is responsible for about half of function invocations.
- Bot Protection and AI Bots are currently off.
- There are no custom Firewall rules.
- Many requests are going to public storefront pages, fake paths, image paths, and telemetry.

The dashboard work should be done first because it can reduce waste immediately without waiting for a deployment.

## Step 1: Add A Firewall Rule For Fake And Wasteful Paths

This is the first Vercel change to make.

From the screenshots, Vercel showed repeated traffic to paths like:

- `/products.json`
- `/api/cache/telemetry`
- `/products/...`
- `/categories/...`
- `/collections/...`
- fake API paths such as `/api/blog`, `/api/demo`, `/api/generate`
- fake blog paths such as `/blog/1`, `/blog/2`, `/blog/3`

Some of these are real pages, so do not block all product, category, or collection pages. Start by blocking only fake paths that your real website does not need.

### Where To Go

1. Open Vercel.
2. Open the `toycker` project.
3. Go to `Firewall`.
4. Open `Rules`.
5. Click `Add Rule`.

### Rule Name

Use:

```text
Block fake bot paths
```

### Description

Use:

```text
Deny known fake or non-existing bot target paths that waste Hobby usage.
```

### Conditions

Set the rule to match any of these paths:

```text
Request Path Equals /products.json
OR Request Path Equals /api/blog
OR Request Path Equals /api/demo
OR Request Path Equals /api/generate
OR Request Path Starts With /blog
```

### Action

Set:

```text
Deny
```

### Why This Helps

These requests are not part of the real Toycker storefront flow. Blocking them at Vercel Firewall prevents them from reaching the Next.js app. That means they should not consume normal function, middleware, or page rendering work.

### Verification

After saving the rule:

1. Go to `Firewall > Traffic`.
2. Check `Denied`.
3. Check `Top Request Paths`.
4. Confirm fake paths are denied.
5. Watch `Edge Requests` and `Function Invocations` over the next 1 to 12 hours.

## Step 2: Add A Temporary Log Rule For Heavy Storefront Crawling

Do not immediately deny real storefront pages like `/products/...`, `/collections/...`, or `/categories/...`. These are valid SEO and user pages. First log them so you can identify whether the traffic is real users, search engines, AI bots, or abusive crawlers.

### Where To Go

1. Open `Firewall`.
2. Open `Rules`.
3. Click `Add Rule`.

### Rule Name

Use:

```text
Log heavy storefront crawling
```

### Description

Use:

```text
Log product, collection, and category crawling before deciding whether to challenge or rate limit.
```

### Conditions

Use:

```text
Request Path Starts With /products
OR Request Path Starts With /collections
OR Request Path Starts With /categories
```

### Action

Set:

```text
Log
```

### Why This Helps

This gives you visibility without breaking SEO or customer browsing. After enough data is collected, you can decide whether to challenge specific user agents, IPs, countries, or hosts.

## Step 3: Turn On Bot Protection

Your screenshots show:

```text
Bot Protection: Off
AI Bots: Off
No Custom Rules
```

This is important because the top user agents include automated browsers and crawlers, including HeadlessChrome, `meta-externalagent`, Baiduspider, Bytespider, and Facebook crawlers.

### Where To Go

1. Go to `Firewall`.
2. Go to `Rules`.
3. Scroll to `Bot Management`.
4. Set `Bot Protection` to `On`.

### Recommended Starting Setting

Use:

```text
Bot Protection: On
```

If Vercel asks for an action, choose a conservative option first:

```text
Challenge
```

Use `Deny` only when you are sure the traffic is not useful.

### Why This Helps

Bot Protection can stop or challenge non-browser automation before it reaches your app. That is more useful than optimizing React code for traffic that should not be served at all.

## Step 4: Turn On AI Bot Controls

AI crawlers can create many requests across product and category pages. If they do not provide business value, they should not be allowed to consume Hobby plan usage.

### Where To Go

1. Go to `Firewall`.
2. Go to `Rules`.
3. Scroll to `Bot Management`.
4. Find `AI Bots`.

### Recommended Setting

Start with:

```text
AI Bots: On
Action: Deny or Challenge
```

Use `Deny` if you do not want AI scrapers crawling Toycker product pages.

Use `Challenge` if you want a safer first step.

### Important SEO Note

Do not blindly block verified search engines like Googlebot if SEO matters. AI bot controls and generic bot controls should be reviewed after enabling.

## Step 5: Watch The Top IPs Before Blocking

The Firewall dashboard showed one IP with heavy traffic:

```text
171.61.164.192 - about 2.3K requests in the past hour
```

Do not permanently block a consumer ISP IP after one short spike unless it keeps repeating or clearly hits fake paths.

### When To Block An IP

Block the IP if:

- it repeatedly appears as a top IP,
- it requests fake paths,
- it creates thousands of requests per hour,
- it does not look like a real customer or verified search crawler.

### Where To Add IP Blocking

1. Go to `Firewall`.
2. Go to `Rules`.
3. Find `IP Blocking`.
4. Click `Add IP`.
5. Add the IP address.
6. Add a note explaining why it was blocked.

### Suggested Note

```text
Repeated high request volume to non-customer paths; added to protect Hobby usage.
```

## Step 6: Protect Preview And Deployment URLs

Your Vercel traffic shows requests to production custom domains and Vercel-generated deployment hosts.

Examples:

- `www.toycker.com`
- `toycker.com`
- `toycker-...vercel.app`

Public users should normally use the real production domain, not random Vercel deployment URLs.

### What To Check

1. Go to the project `Deployments`.
2. Open the latest production deployment.
3. Check which domains are attached.
4. Check whether preview/deployment URLs are being indexed or shared.
5. If available on your plan, use deployment protection for preview deployments.

### Optional Firewall Rule For Preview Hosts

Only do this if you are sure public users do not need the `vercel.app` deployment URLs.

Rule idea:

```text
Name: Log vercel app host traffic
If Host Contains vercel.app
Then Log
```

Start with `Log`, not `Deny`.

After confirming the traffic is unwanted, you can decide whether to challenge or deny.

## Step 7: Monitor These Metrics After Every Dashboard Change

After each rule change, check the numbers at these times:

- after 30 minutes,
- after 1 hour,
- after 6 hours,
- after 12 hours,
- the next day.

Track these Vercel pages:

- `Usage > Edge Requests`
- `Usage > Function Invocations`
- `Usage > Fast Data Transfer`
- `Usage > Fast Origin Transfer`
- `Observability > Edge Requests`
- `Observability > Fast Data Transfer`
- `Firewall > Traffic`
- `Firewall > Audit Log`
- `Logs`

## Step 8: What Good Results Should Look Like

After correct Firewall setup:

- `Denied` traffic should increase for fake paths.
- `/products.json` should stop appearing as a top real request path.
- fake `/api/...` paths should stop reaching the app.
- Function invocations should drop if bad requests were reaching functions.
- Middleware invocations may still remain high until code changes are deployed.
- Real product/category/collection page traffic should still work.

## Step 9: Do Not Use Firewall To Fix Everything

Firewall is best for unwanted traffic. It cannot fix every Vercel usage issue.

Use Vercel configuration for:

- fake paths,
- abusive IPs,
- non-browser automation,
- AI scrapers,
- preview URL traffic,
- temporary logging and investigation.

Use code changes for:

- middleware running on too many public routes,
- custom telemetry hitting `/api/cache/telemetry`,
- dynamic rendering on public pages,
- layout APIs loading for every visitor,
- image optimization behavior,
- product listing API cache behavior.

## Step 10: Safe Rule Order

Apply rules in this order:

1. Deny fake paths.
2. Log real storefront crawling.
3. Turn on Bot Protection.
4. Turn on AI Bot controls.
5. Watch Firewall traffic for 1 to 12 hours.
6. Block repeated abusive IPs only after confirmation.
7. Move from `Log` to `Challenge` for suspicious real-page traffic.
8. Use `Deny` for real-page traffic only when you are sure it is abusive.

## Recommended First Vercel Setup

Start with these exact changes:

```text
Rule 1:
Name: Block fake bot paths
Condition:
  Request Path Equals /products.json
  OR Request Path Equals /api/blog
  OR Request Path Equals /api/demo
  OR Request Path Equals /api/generate
  OR Request Path Starts With /blog
Action:
  Deny

Rule 2:
Name: Log heavy storefront crawling
Condition:
  Request Path Starts With /products
  OR Request Path Starts With /collections
  OR Request Path Starts With /categories
Action:
  Log

Bot Management:
  Bot Protection: On
  AI Bots: On
```

## Final Dashboard Priority

The highest-impact Vercel-only action is not upgrading the plan. The highest-impact first action is stopping unwanted traffic before it reaches the app.

Once these dashboard changes are active, the next highest-impact work is code-side: narrowing middleware, disabling duplicate telemetry, and making public storefront pages cache correctly.
