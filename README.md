# SitecoreAI Content Transfer — Standalone / Stateless

A **standalone Next.js application** with the original SitecoreAI Content
Transfer dashboard, environment view, content-item browser and transfer wizard.

It uses SitecoreAI's native APIs. **No application database, user-content
storage or proprietary history storage is required.** Recent transfer and
historical import records are read from the destination SitecoreAI instance.

> **Pre-release:** Live transfer execution must be explicitly enabled and
> validated against disposable/non-production SitecoreAI environments. Vercel
> execution is bounded by function limits; interrupted exports must be reconciled
> in SitecoreAI before attempting another run. Don't use against customer
> production content before security and recovery testing.

## What the application does

- **Jobs dashboard:** original transfer dashboard layout, populated from
  `GET /sitecore/shell/api/v3/ItemsTransfer/transfers` and `/history`.
- **Item browser:** source SitecoreAI Authoring GraphQL; select a parent path
  to list its children, with the original item-list design.
- **Environments:** source/destination authoring environments configured for
  this particular deployment and verified against SitecoreAI.
- **New transfer wizard:** choose an item, scope and merge strategy; run a
  server-side parent-ID preflight; explicitly confirm before transfer.
- **Live progress:** one bounded Vercel request streams updates while the
  Content Transfer API exports and streams chunks to the destination, then
  the Item Transfer API imports the resulting .raif package.
- **History detail:** native SitecoreAI import status, errors and historical
  transitions, never fabricated publishing or AI field mappings.

Each deployment is intended for the operator's own SitecoreAI environments.
The GitHub OAuth allowlist limits who can use the configured automation clients.
Only an HttpOnly, signed session cookie is used for login; your own app does not
store content or transfer histories. SitecoreAI itself retains its normal
history and migration package resources under its own retention rules.

## Local development

Requires Node.js 22+ and npm.

```sh
git clone https://github.com/tejavallabhaneni/SitecoreAI-Content-Transfer.git
cd SitecoreAI-Content-Transfer
npm ci
cp .env.example .env.local
npm run dev
```

Configure `.env.local` with your own GitHub OAuth App and **non-production**
SitecoreAI automation clients. Do not commit this file.

```sh
npm run lint
npx tsc --noEmit
node --experimental-strip-types --test tests/*.test.mjs
npm run build
```

## Deploy to Vercel

See [Vercel setup and staging verification](docs/DEPLOYMENT.md).
Leave `ENABLE_LIVE_TRANSFERS=false` while initially validating authentication,
environment connection, live item browsing, native history, and preflight.
For the first write test, use two disposable authoring environments and a
small, non-critical item.

### Important limitations

- Vercel Hobby function duration is limited to 300 seconds with Fluid Compute.
  The transfer route aborts at four minutes rather than assume indefinite
  execution. A timed-out transfer may still have partial SitecoreAI resources.
- SitecoreAI's **history** API records destination imports, not every
  transient export/chunk operation. In-progress source exports may not appear.
- Native SitecoreAI transfers do not provide field-to-field AI mapping; the old
  fake mapping data has been removed from the live interface.
- Native import into `master` is **not publishing** to Experience Edge.
- Multiple-item batching, resumability, job arbitration, live integration
  testing, operation cleanup and complete security review remain future work.
- Do **not** expose the deployment publicly with automation credentials unless
  authenticated access and organization permissions are verified.

## References

- [Content Transfer API](https://api-docs.sitecore.com/sai/content-transfer-api/section/base-url)
- [Item Transfer API history](https://api-docs.sitecore.com/sai/item-transfer-api/history)
- [Authoring GraphQL](https://doc.sitecore.com/sai/en/developers/sitecoreai/content-modeling-and-presentation/sitecore-authoring-and-management-graphql-api/sitecore-authoring-and-management-graphql-api.html)

The repository remains private pending company asset/code clearance, history
secret review, GitHub rules, and open-source license approval.
