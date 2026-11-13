# Contributing

This project is a developer preview. The public UI uses each visitor's own SitecoreAI connection and native import history; no database is required.

1. Use Node.js 22+ and run `npm ci`.
2. Run `npm run dev`.
3. Connect only non-production SitecoreAI environments that you are authorized to manage.
4. Run `npm run lint`, `npx tsc --noEmit`, `npm run build:worker`, `node --experimental-strip-types --test tests/*.test.mjs`, `node --test tests/*.test.cjs`, and `npm run build` before submitting changes.
5. Open a pull request with a concrete behavior description and test evidence. Distinguish mocked API checks from real tenant testing.

Never commit credentials, JWTs, real customer content, or private internal URLs. Do not add application persistence or enable destructive tree replacement/publishing as part of an unrelated change. No open-source license has been selected.

Security reports: see [SECURITY.md](SECURITY.md).
