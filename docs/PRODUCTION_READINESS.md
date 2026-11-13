# Production-readiness notes

## Stateless design decision

This project intentionally maintains **no application database**. Each
operator deploys it with their own two SitecoreAI authoring environment
automation clients and a GitHub OAuth allowlist. All content comes from the
source Authoring GraphQL API; active and historical transfers are queried
directly from the destination Item Transfer API.

No simulated content, fake AI mapping, or local runtime.json data is used.
The UI keeps the original dashboard, item browser and transfer wizard.

## What the read-only APIs actually guarantee

- `GET /transfers`: current/completed destination import statuses.
- `GET /history`: previous consumed sources with state transition events.
- `GET /transfers/:id`: available details/validation errors.
- Authoring GraphQL: live content hierarchy at a selected parent.

The source export stage has a different Content Transfer API; it is **not**
listed in the destination import history until a package is consumed.

## Controlled staging-write flow

The bounded Vercel endpoint can perform a single-item Content Transfer and
Item Transfer sequence after fresh parent-ID preflight and explicit
confirmation. It streams progress over an HTTP response and does not persist
data. The operator must maintain the open connection.

## Outstanding before full production certification

- External SitecoreAI staging E2E validation with real tenant permissions.
- Vercel timeout/disconnection recovery, durable or Sitecore-native
  resumability, idempotent retry, and import-state reconciliation.
- Source/export and destination blob cleanup after success/failure.
- Media, multilingual, version, conflict and large-tree tests.
- Improved UI hierarchy pagination and multiple-item batching.
- Full security/permission testing and secret/history scan.
- GitHub branch protection, approved license and company asset rights.
- Consider Vercel Workflow or an alternative durable execution service if
  long transfers must survive request termination. That is a product choice
  separate from storing user content/history.

Do not label this pre-release build production-certified until those release
gates pass.
