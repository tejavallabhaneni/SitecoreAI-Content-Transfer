# Single-operator standalone deployment

**Not production-ready for real transfers.** This phase implements secure
login and persistent *draft* transfer requests; execution is intentionally
disabled until preflight, worker durability and live integration testing.

## 1. Provision PostgreSQL

Use a dedicated Supabase project. Open its SQL Editor and apply
[db/schema.sql](../db/schema.sql). Never put the service-role key in a public
environment variable, client bundle, build log, or GitHub repository.

Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to your hosting platform's
**server-side secrets**.

## 2. Configure GitHub sign-in

Create a GitHub OAuth App with **Homepage URL** matching APP_BASE_URL and
**Authorization callback URL**
`https://your-domain.example/api/auth/github/callback`.

Configure GITHUB_OAUTH_CLIENT_ID, GITHUB_OAUTH_CLIENT_SECRET, a random
SESSION_SECRET of at least 32 characters, and ALLOWED_GITHUB_USERS containing
only the GitHub logins authorized to run this installation.

This is an owner-allowlisted, **single-organization/self-hosted** application,
not a multi-tenant SaaS login. Never share a deployment configured with
privileged automation credentials with untrusted users.

## 3. Configure SitecoreAI environments

In SitecoreAI Deploy > Credentials > Environment > Create credentials >
Automation, create dedicated credentials separately for source and target.
Provide the hostnames ending in `.sitecorecloud.io` and both clients'
ID/secret in server-side secrets. The credentials require permitted organization
roles to use Content Transfer and Item Transfer APIs.

## 4. Deploy frontend

Import the repository into Vercel (Next.js preset, `npm run build`).
Set production environment variables **before** deploying. Do not enable demo
mode in production. Run `npm ci`, `npm run lint`, `npx tsc --noEmit`
and `npm run build` in CI.

Visit `/transfer`, sign in with the allowlisted GitHub account, and verify
that a draft can be created, listed, and retrieved from PostgreSQL.

## 5. Release gate

Drafts remain in `pending_preflight`; no transfer executes yet.
Deploying or exposing credentials is not permission to run destructive
migrations. Finish a verified preflight and durable worker before enabling
live operation. `GET /api/health` deliberately returns HTTP 503.
