# Deploy the public app to Vercel

## Settings

- Framework: Next.js
- Node.js: 22.x or 24.x
- Install: `npm ci`
- Build: `npm run build`
- Root: repository root
- Output: Next.js default

The public workflow requires no database, GitHub OAuth configuration, shared Sitecore credentials or separate worker. Do not configure shared Sitecore automation credentials for public users.

`APP_BASE_URL` is optional. Leave it unset to use the request origin, or set the exact production origin such as `https://sitecoreai-ae-content-transfer-app.vercel.app`. A preview deployment needs its own matching origin or the variable omitted. Every API request requires a matching Origin header and JSON content type.

The `/api/sitecore` route is stateless and has a maximum function duration of 120 seconds. Export polling, chunk forwarding and import polling are separate requests. Binary chunks are streamed from Sitecore source to Sitecore destination without transformation. Hosting-plan duration/memory limits still apply.

## Optional Sitecore sign-in

See [SITECORE_SIGN_IN.md](SITECORE_SIGN_IN.md). A registered public SPA client, approved API audience/scopes, callback URLs and a live compatibility test are required. Merely signing into the Cloud Portal does not authorize this separate app. Until configured, the UI clearly marks Sitecore sign-in as awaiting registration.

## Public access

1. Deploy this revision.
2. Verify the production domain opens without Vercel Authentication.
3. Verify `/`, `/environments`, `/items` and `/jobs/new` render without GitHub login.
4. Leave private preview deployment protection in place; only the production app needs public access.
5. Connect two non-production authoring environments using the UI. Organization Admin/Owner permissions are required by Sitecore.

The connection form sends credentials to the app's server solely to obtain Sitecore tokens. The server returns the tokens to the current tab's memory, then discards the supplied secrets. API calls carry only that user's connection. No credentials, tokens, content or history are saved in an application database or browser persistent storage. Disconnecting/reloading clears the browser session. Existing Sitecore imports may continue after disconnect.

## Smoke tests

```sh
curl -f https://YOUR_DOMAIN/api/health
```

Expected health fields include `status: ok`, `mode: public-user-connected`, `applicationDatabaseRequired: false`. `liveTenantValidated: false` correctly records that this revision has not yet been exercised against a real tenant; it is separate from HTTP application health.

Without a user connection, a POST to `/api/sitecore` must fail without using any installation credentials. Cross-origin requests must fail with 403. Legacy `/api/transfers` routes must return 410 and never access PostgreSQL.

## First real transfer

1. Use two disposable/non-production authoring environments.
2. Select one small content root with matching parent IDs in both environments.
3. Keep existing destination items on the first run.
4. Run preflight, inspect its results, and approve explicitly.
5. Observe the export ID, chunk forwarding, file creation and native import completion.
6. Verify the destination item, field values, languages and references manually.
7. Reload, reconnect and confirm the import and its state changes appear in native history.
8. Test a parent-ID mismatch and a permission failure; neither should start an export.
9. Test interrupted forwarding and verify native state before manually restarting anything.
10. Publish only through the normal Sitecore workflow when intended.

The app does not promise automatic retries, rollback, background forwarding after closing the tab, AI field mapping, or automatic publishing. Delete/tree-replacement operations are unavailable. Transfer package cleanup is left to the environment operator.

## Legacy code

The old SQL schemas and worker source remain for reference. Do not run database migrations or start the worker for this public deployment. Database-backed routes are retired. Repository history preserves the previous authenticated deployment implementation.
