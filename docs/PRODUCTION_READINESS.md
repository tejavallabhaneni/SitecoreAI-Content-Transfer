# Historical deployment checklist

This file describes the previous database-backed worker architecture. The current public app is documented in [DEPLOYMENT.md](DEPLOYMENT.md) and does not use that database or worker. The historical checklist below is retained for reference.

# Production readiness — work required

## Status

The UI and API routes currently use fixed seed environments, content items,
field mappings and simulated transfer jobs. Real SitecoreAI content is never
moved. The current `src/lib/store.ts` is not a production database.

As a first security measure, simulated API routes are available only when
`ENABLE_DEMO_MODE=true` outside production. `GET /api/health` intentionally
returns HTTP 503. The server-side `src/lib/sitecore/client.ts` supports OAuth
tokens and restricted API requests but is **not wired into transfer jobs**. A separate
`src/lib/sitecore/native-transfer.ts` implements the documented API sequence
as a worker-only foundation. It must not be exposed to users until preflight,
authorization, durability, idempotency, and real staging validation exist.

## Blocking work

1. **Identity & permissions:** real authenticated sessions and request-level
   organization/environment authorization on every API route.
2. **Live environment discovery:** permission-checked source/destination CM
   environments and item hierarchy; remove seed fixtures from live mode.
3. **Native API worker:** Content Transfer API operation creation, polling,
   binary chunk streaming, chunk-set completion, then destination Item
   Transfer API blob consumption and terminal-state verification.
4. **Preflight:** parent chain IDs, item hierarchy, scope, languages/versions,
   merge strategies and destructive-operation confirmation.
5. **Durability:** database, persistent job queue, worker process, resumable
   chunk checkpoints, idempotency and rate-limited retry.
6. **Accuracy:** actual progress and errors; distinguish import-to-master
   from publishing. Fake AI mappings must be removed or explicitly kept only
   in the separate demo flow.
7. **Quality:** unit tests, mocked API contract tests, integration tests in
   SitecoreAI staging, large media, rollback, logs, and alerting.
8. **Release:** full git-history secret scan, company code/publication rights,
   open-source license selection, CI, branch rules, CODEOWNERS and docs.

## Official API workflow

The source Content Transfer API creates an operation and exposes chunk sets.
Stream every chunk **without altering its bytes** to the destination; complete
each chunk set to create .raif blobs. The destination Item Transfer API imports
those blobs into master. A completed transfer does **not** imply content
publishing. Organization Owner or Organization Admin access is required.

- https://api-docs.sitecore.com/sai/content-transfer-api/section/base-url
- https://api-docs.sitecore.com/sai/item-transfer-api/section/base-url

## Release criteria

Do not mark this repository production-ready until every blocking item above
is implemented and demonstrated against test environments.

