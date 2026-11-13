# Vercel deployment — no database

## 1. Create a GitHub OAuth app

This app is self-hosted and single-operator/team by default. To prevent anyone
from using your SitecoreAI automation clients, sign-in is required.

In GitHub Developer Settings, create an OAuth App. Configure:
- Homepage URL: `https://YOUR-VERCEL-DOMAIN`
- Authorization callback: `https://YOUR-VERCEL-DOMAIN/api/auth/github/callback`

Set `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`,
`ALLOWED_GITHUB_USERS` and a random `SESSION_SECRET` (32+ characters)
as **server-only** secrets in Vercel. Set `APP_BASE_URL` to the exact HTTPS origin.

## 2. Configure your two non-production SitecoreAI authoring environments

In SitecoreAI Deploy → Credentials → Environment → Create credentials →
Automation, create separate automation clients for source and destination.
The account requires appropriate Organization Admin or Organization Owner
permissions to use Content Transfer and Item Transfer APIs.

Add to Vercel's server-only environment variables:

- `SITECORE_SOURCE_HOST`
- `SITECORE_SOURCE_CLIENT_ID`
- `SITECORE_SOURCE_CLIENT_SECRET`
- `SITECORE_DESTINATION_HOST`
- `SITECORE_DESTINATION_CLIENT_ID`
- `SITECORE_DESTINATION_CLIENT_SECRET`

Use environment hostnames ending in `.sitecorecloud.io` (no protocol/path).
Never put client credentials into `NEXT_PUBLIC_*`, Git commits, or the chat.

**No Supabase, SQL migration, Redis, external worker, or application database
is required for the bounded single-item workflow.**

## 3. Deploy

Import the GitHub repository into Vercel using the Next.js preset. Configure
the above server variables and leave `ENABLE_LIVE_TRANSFERS=false`.

Deploy and open `/`. Sign in via your allowlisted GitHub identity.

Verify these screens in the **original UI**:
- **Jobs**: history and active import statuses from destination SitecoreAI.
- **Items**: navigate the source Authoring GraphQL content tree by path.
- **Environments**: source/target connection verification.
- **New transfer**: select a small item, review preflight and parent IDs.

SitecoreAI import history can be empty on new environments; that isn't a
database error.

## 4. Perform a careful staging transfer

Only after read-only features and preflight work with two disposable
environments, set `ENABLE_LIVE_TRANSFERS=true` in Vercel and redeploy.

1. Select a small non-critical source item.
2. Select **Single item** and **Keep existing items**.
3. Click **Validate transfer**.
4. Review the item ID, destination, and matching parent IDs.
5. Confirm transfer. Keep the page open while Vercel streams progress.
6. Verify the destination's **master** content in SitecoreAI.
7. Reload Jobs to see the resulting Item Transfer API history.
8. Publishing to Experience Edge, if needed, is separate.

**Avoid large content trees and media during the first test.** The transfer
endpoint uses a four-minute abort to stay below Vercel Hobby's standard
five-minute function limit. Higher plans offer configurable durations but do
not provide durable crash recovery by themselves.

## 5. Recovery and release gates

If a browser disconnects, Vercel times out, or SitecoreAI responds with a
partial failure, **do not blindly retry**. Inspect the source Content Transfer
operation, destination blob sources, `/transfers`, and `/history`. The
destination may have already imported content even if the browser never
received a confirmation.

SitecoreAI's history API records consumed sources, not failed source exports
that never reached the destination. Do not claim otherwise.

Before customer production use, validate cross-origin rejection, tenant
isolation (each deployment uses only its configured environments), failure
recovery, cleanup of RAIF and transfer resources, media/language/version edge
cases, idempotent retries, and permission management.

Sitecore refs:
- https://api-docs.sitecore.com/sai/content-transfer-api/section/base-url
- https://api-docs.sitecore.com/sai/item-transfer-api/history
- https://vercel.com/docs/functions/configuring-functions/duration
