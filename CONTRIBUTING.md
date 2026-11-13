# Contributing

This project is currently a **development preview**, not a live SitecoreAI transfer application.

## Local setup

1. Fork the repository and clone your fork.
2. Use Node.js 22 and run `npm ci`.
3. Copy `.env.example` to `.env.local` (development-only fixture data).
4. Run `npm run dev` and visit http://localhost:3000.
5. Before sending changes, run `npm run lint`, `npx tsc --noEmit`, and `npm run build`.
6. Open a pull request from your fork. Include a description and test evidence.

Commit to your own fork; do not expect direct push access to the upstream
repository. The maintainer should configure GitHub rules requiring PR and code
owner approval before merging.

Never commit client secrets, JWTs, real customer content, private internal URLs
or code without release authorization. Do not present simulated transfers as real.

Security reports: see [SECURITY.md](SECURITY.md).
