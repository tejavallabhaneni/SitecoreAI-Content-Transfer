# SitecoreAI Content Transfer

[Launch the app](https://sitecoreai-ae-content-transfer-app.vercel.app) · [Deployment](docs/DEPLOYMENT.md)

A public Next.js application for transferring content between **your own** SitecoreAI authoring environments. It retains the dashboard, content browser, transfer wizard, environment cards and job-detail views.

## How it works

1. Open **Environments**. The preferred **Sign in with Sitecore** integration is prepared but awaits app registration and live API compatibility validation. The advanced connection option accepts automation credentials for two authoring environments you are authorized to manage. The native transfer APIs require an Organization Admin or Owner role.
2. Browse source content, select up to 20 roots, and choose single-item or subtree scope.
3. Choose **Keep existing items** (default) or **Overwrite matching items**.
4. Review the plan and verify destination parent-item IDs.
5. Explicitly approve the transfer. The server checks the parent IDs again before exporting.
6. Keep the tab open while it polls the export and forwards binary chunks to the destination.
7. Monitor the destination import and follow your normal publishing workflow afterward.

Native transfer preserves item IDs and fields. It does not generate AI field mappings. Destructive tree replacement, publishing, and delete operations are not exposed.

## Data and history

- No application database, external job store, or content archive is required.
- Optional Sitecore sign-in uses the official Auth0 React SDK with an in-memory token cache and Authorization Code with PKCE. See [Sitecore sign-in setup](docs/SITECORE_SIGN_IN.md) for registration, scope and compatibility requirements. OAuth redirect transaction state is temporary browser protocol state, not saved customer data.
- Client secrets are exchanged with Sitecore and cleared from the form on successful connection.
- Access tokens, draft plans and forwarding progress exist only in the current tab's memory. The app does not write them to browser storage, cookies or files. Reloading/closing the tab clears them.
- A stateless server endpoint authenticates each request with the calling user's token. It never falls back to the installation owner's credentials.
- Destination status comes from `/sitecore/shell/api/v3/ItemsTransfer/transfers`; state-change history comes from `/sitecore/shell/api/v3/ItemsTransfer/history`.
- Sitecore history covers destination imports, including imports created outside this app. It does **not** retain the source environment, friendly draft names, or every export/chunk step. Missing information is shown as unavailable.
- History and item browsing are paginated/bounded. The item browser shows one folder plus its first 50 children; enter an exact path to reach deeper items.

## Local development

Node.js 22+ and npm:

```sh
npm ci
npm run dev
```

No GitHub OAuth, PostgreSQL or shared Sitecore installation secrets are needed to launch the public UI. Enabling Sitecore sign-in requires the one-time public SPA client configuration described in docs/SITECORE_SIGN_IN.md; it is not configured by default. The advanced environment-credential form remains available. `APP_BASE_URL` is optional; if set, it must match the deployed origin.

```sh
npm run lint
npx tsc --noEmit
npm run build:worker
node --experimental-strip-types --test tests/*.test.mjs
node --test tests/*.test.cjs
npm run build
```

`build:worker` compiles the API modules for the Node contract tests and retains compatibility with the old optional worker. The public app does not run that worker.

## Current validation limits

Automated tests exercise mocked Sitecore APIs, connection isolation, parent checks, history parsing and binary forwarding. A real two-environment transfer has not been validated for this revision. Start with a small non-production content root before broad adoption.

The browser coordinates the phases. Closing it can stop forwarding; an import already accepted by Sitecore can continue. A failed write is not retried automatically because its outcome may be uncertain. Check native status before starting another operation. Very large chunks remain subject to hosting duration and memory limits. Source export resources and destination `.raif` files are retained; the app does not delete them automatically.

Legacy database/worker modules remain in source for reference, with their database-backed HTTP routes retired. They are not part of the public workflow. No existing content or database records are deleted by this change.

## Contributions

See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md). No open-source license has been selected; public repository visibility alone does not grant additional reuse rights.
