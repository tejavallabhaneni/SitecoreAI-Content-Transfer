# SitecoreAI Content Transfer — standalone development preview

> **Not production-ready:** This is a standalone Next.js UI demonstration.
> Content items, environments, field mappings and transfer jobs are simulated.
> No live SitecoreAI content is copied or published.

This repository is separate from any internal Marketplace application.
It is a foundation for an independently deployable tool.

## Local demo

Requires Node.js 22+ and npm.

```bash
git clone https://github.com/tejavallabhaneni/SitecoreAI-Content-Transfer.git
cd SitecoreAI-Content-Transfer
npm ci
cp .env.example .env.local
npm run dev
```

Visit http://localhost:3000. The mock APIs are **development-only** and
require `ENABLE_DEMO_MODE=true` in a non-production Node runtime. A production
deployment will return HTTP 503 for mock API requests, to prevent false
claims of successful content transfers.

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## What is implemented

- Transfer dashboard and job detail views (simulated).
- Fake environment/item selection and predetermined mapping suggestions.
- Demo-only API guard and a readiness endpoint at `/api/health`.
- Server-only SitecoreAI automation credential/token helper in
  `src/lib/sitecore/client.ts` (not yet connected to any job runner).

## What remains

A real application needs authentication and authorization, live SitecoreAI
environment/item discovery, native Content Transfer API and Item Transfer API
orchestration, persistent job state, background worker, preflight validation,
safe conflict handling, recoverable errors and staging integration tests.
See [production readiness](docs/PRODUCTION_READINESS.md).

Sitecore references:
- [Content Transfer API](https://api-docs.sitecore.com/sai/content-transfer-api/section/base-url)
- [Item Transfer API](https://api-docs.sitecore.com/sai/item-transfer-api/section/base-url)

## Contributions & licensing

Read [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md).
No open-source license has been granted yet. Code/asset ownership must be
reviewed before the repository is published.
