# Contributing

This project is a standalone, stateless SitecoreAI Content Transfer web app.
Changes must preserve the original dashboard, item browser, environment panel
and transfer wizard layout unless an explicit design proposal is approved.

## Local setup

1. Fork and clone your fork.
2. Install Node.js 22+, then run `npm ci`.
3. Copy `.env.example` to `.env.local`. Use non-production secrets.
4. Run `npm run dev` and open http://localhost:3000.
5. Run `npm run lint`, `npx tsc --noEmit`, unit tests, and `npm run build`.
6. Submit a pull request to `main` and wait for maintainer review.

A developer may commit to their **own fork**; only authorized maintainers
may merge changes into the upstream repository. Never include customer data,
automation credentials, internal URLs or proprietary code.
