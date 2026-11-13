# Standalone SitecoreAI Content Transfer deployment

**Important:** The application is not production-certified. It requires real
staging-environment verification before enabling any live transfer worker.

## Prerequisites

- Node.js 22+ and npm for the Next.js web app.
- A dedicated Supabase PostgreSQL project. Apply `db/schema.sql` then
  `db/002_worker.sql` from Supabase SQL Editor.
- A GitHub OAuth App with callback
  `https://YOUR_APP_HOST/api/auth/github/callback`.
- GitHub usernames authorized to run this installation (single operator/team).
- Separate SitecoreAI Environment Automation clients for the source and target,
  both with Organization Admin/Owner authorization.
- A secure container host (Azure Container Apps, AWS ECS/Fargate, or a VM)
  for the **long-running worker**.

## Web application configuration (Vercel or a trusted Node host)

Add these environment variables as **server-only secrets**:

| Setting | Purpose |
| --- | --- |
| APP_BASE_URL | HTTPS public origin of your deployment |
| GITHUB_OAUTH_CLIENT_ID | GitHub OAuth application client ID |
| GITHUB_OAUTH_CLIENT_SECRET | GitHub OAuth application secret |
| SESSION_SECRET | Random signing string at least 32 characters |
| ALLOWED_GITHUB_USERS | Comma-separated GitHub logins allowed to use app |
| SUPABASE_URL | Dedicated project origin |
| SUPABASE_SERVICE_ROLE_KEY | Service-role credential; never browser-accessible |
| SITECORE_SOURCE_HOST | Source CM environment hostname |
| SITECORE_SOURCE_CLIENT_ID | Source environment automation client ID |
| SITECORE_SOURCE_CLIENT_SECRET | Source automation client secret |
| SITECORE_DESTINATION_HOST | Destination CM environment hostname |
| SITECORE_DESTINATION_CLIENT_ID | Destination environment automation client ID |
| SITECORE_DESTINATION_CLIENT_SECRET | Destination automation client secret |

The hosting system must restrict access to secrets. Never use `NEXT_PUBLIC_`
for secrets. The application runs with `ENABLE_DEMO_MODE` disabled in
production. Vercel can host the UI and API, but is not responsible for
multi-hour migrations.

Deploy using the framework's standard Next.js build (`npm ci` and
`npm run build`). Visit `/transfer`, authenticate via GitHub,
create a draft for a source content path and run preflight.

## Transfer safety workflow

1. The authorized operator creates a job draft (starts in
   `pending_preflight`; no content moved).
2. The operator selects **Verify source and destination**. The server
   queries SitecoreAI Authoring GraphQL for the source item and parent
   hierarchy in both environments, requiring matching Sitecore item IDs.
3. The operator reviews the result and explicitly confirms the item path and
   destination host. Overwrite requires another confirmation.
4. The job moves to `queued` atomically only after fresh preflight.
5. The separately deployed worker must have
   `ENABLE_LIVE_TRANSFERS=true` to claim jobs. It independently rechecks
   parent IDs before executing the native transfer.
6. The worker uploads binary chunks, consumes the .raif on the target and
   polls terminal status. It reports **transfer succeeded**, not **published**.

### Long-running worker (never on Vercel)

Build:

```bash
docker build -f Dockerfile.worker -t sitecoreai-content-transfer-worker .
```

Deploy the image to a private container service with the same
SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, and source/destination
Sitecore credentials, plus `ENABLE_LIVE_TRANSFERS=true` **only after** a
reviewed staging demonstration. Do not expose the worker through a public port.

You can alternatively run:

```bash
npm ci
npm run build:worker
ENABLE_LIVE_TRANSFERS=true npm run worker:start
```

Use your hosting platform's secure secret injection rather than command-line
shell history or committing a .env file.

## Important recovery constraints

The worker's database reservation uses `FOR UPDATE SKIP LOCKED` to avoid
concurrent execution of the same queued job. **Interrupted jobs are not
automatically retried**. A running job can become orphaned if a container
terminates. Reconcile its source export and destination import state using
Sitecore's APIs before any manual retry to avoid duplicate/destructive imports.
This is a remaining production-hardening task.

The current worker does not yet perform cleanup of source transfer operations
or destination .raif blobs; follow Sitecore's cleanup requirements and
retention policy. Until cleanup, recovery, tracing, and staging verification
are completed, treat the application as pre-release.

## Deployment validation

- Run all CI tests and build both the Next.js app and worker.
- Verify unauthorized requests are rejected.
- Verify that failed preflight prevents queueing.
- Demonstrate a transfer in two disposable SitecoreAI environments.
- Test parent-ID mismatches, existing items, large media, multilingual items,
  network interruptions, incomplete imports and worker restart.
- Verify destination **master** content and its publishing lifecycle.
- Do not make the repository public until code ownership, historical secrets,
  a license, and GitHub branch protections are reviewed.
