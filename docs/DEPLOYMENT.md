# Deploy and install Content Transfer

## 1. Deploy to Vercel

- Framework: Next.js
- Node.js: 22.x or 24.x
- Install: `npm ci`
- Build: `npm run build`
- Root: repository root

No environment variables, database, credentials or worker are needed. The app talks to SitecoreAI only from the browser, through the Marketplace SDK.

Smoke test:

```sh
curl -f https://YOUR_DOMAIN/api/health
```

Expected: `status: ok`, `mode: marketplace-app`, `applicationDatabaseRequired: false`. `liveTenantValidated: false` records that a real two-environment transfer hasn't been validated yet.

Opening the URL directly (outside SitecoreAI) shows the how-to steps and the offline demo. That is expected.

## 2. Register the app in App Studio

1. In the Sitecore Cloud Portal, open **App Studio** and create a custom app.
2. Add an extension point (Standalone or SitecoreAI full screen) with route `/`, and set the app URL to your deployment.
3. Under API access, enable **SitecoreAI APIs**. The app needs Authoring GraphQL and the Content Transfer API.
4. Upload the logo from `public/brand/content-transfer-512.png`.

## 3. Install it in every environment

Install the app and give it access to **each** environment you want to copy between. The app lists only the environments it's installed in. With fewer than two, it explains what to do instead of showing the trees.

## First real transfer

1. Use two non-production environments.
2. Pick one small item whose parent folders exist, with the same IDs, in both.
3. Keep **Keep the To version** on the first run.
4. Run the check, read each row, approve and start.
5. Watch the five steps: package, copy chunks, prepare file, import, done.
6. Check the item, its fields, languages and references in the destination.
7. Try a conflict (same path, different ID) and a missing parent: neither should start a transfer.
8. Publish through your normal workflow when you mean to.

The app doesn't retry failed writes, roll back, keep copying after the tab closes, or publish. Deleting or replacing whole trees isn't available.

## Legacy code

The old SQL schemas, worker source and database-backed routes remain for reference only. Don't run the migrations or the worker for this app.
