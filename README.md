# SitecoreAI Content Transfer — standalone (pre-release)

A Next.js application for reviewing and approving transfers of Sitecore content
between separately authorized SitecoreAI environments.

**Release status:** Not production-certified. The web app has GitHub login,
PostgreSQL-backed jobs, preflight verification and explicit approval. A
separate worker implements the native Content Transfer and Item Transfer API
sequence. Live transfers require deployment credentials and **real staging
validation**; do not use this project against production content yet.

## Features

- GitHub OAuth login, signed session cookies and allowlisted operators.
- PostgreSQL job drafts, transfer status and progress.
- Source and target environment configuration using server-only credentials.
- Real preflight checks against the Authoring GraphQL API, including matching
  destination parent-item IDs.
- Reviewed transfers that are queued for an independently hosted worker.
- Native API worker implementing source export, binary chunk forwarding,
  .raif file creation and destination master import.
- Fail-closed simulated demo endpoints in production.

### Safety restrictions

- OverrideExistingTree is intentionally unavailable.
- A completed import is **not** published content.
- Background workers must be enabled separately; no live worker runs in Vercel.
- Worker failures do not trigger automatic retries; operator reconciliation
  is required before any restart of an interrupted operation.
- Cleanup of transferred package resources and full staging integration tests
  remain release blockers.

## Local demo

Requires Node.js 22+ and npm.

```bash
git clone https://github.com/tejavallabhaneni/SitecoreAI-Content-Transfer.git
cd SitecoreAI-Content-Transfer
npm ci
cp .env.example .env.local
npm run dev
```

Only local development with `ENABLE_DEMO_MODE=true` shows sample transfer
jobs. A production runtime never enables fixture-backed transfer APIs.

## Production setup

See [Deployment guide](docs/DEPLOYMENT.md) for GitHub OAuth,
PostgreSQL schema, server-only Sitecore credentials, worker container,
preflight workflow and staging test requirements.

```bash
npm run lint
npx tsc --noEmit
node --experimental-strip-types --test tests/*.test.mjs
npm run build
npm run build:worker
```

The `/api/health` endpoint intentionally reports not ready until the
release gate is cleared.

## Contributions

See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).
This private repository has no open-source license yet. Publication requires
code/asset ownership approval, a history secret scan and enforced reviews.
