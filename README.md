# SitecoreAI Content Transfer

Web app for transferring Sitecore-style content items between XM Cloud environments (source → target) with AI-assisted field mapping.

This is a **working demo** added because the Origin repository `sitecoreai-content-transfer` (`https://origin.cursor.com/americaneagle-com/sitecoreai-content-transfer.git`) could not be cloned from the Cloud Agent session (HTTP 403 — the agent token is not scoped to that Origin repo). It is **not** a byte-for-byte clone of the internal Origin project.

## What you can do

- Browse transfer jobs on the dashboard (queued, running, success, error)
- Pick source and target environments
- Select content items and create a job
- Review, accept, or reject SitecoreAI field mappings
- Run a transfer and watch status/progress update

The catalog, environments, and job runner are simulated in-process (JSON store under `data/runtime.json`). No live Sitecore credentials are required.

## Run locally

Requires Node.js 20+.

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

To bind all interfaces on a custom port:

```bash
npx next dev --hostname 0.0.0.0 --port 3847
```

```bash
npm run build
npm start
```

## Production

- GitHub: https://github.com/tejavallabhaneni/SitecoreAI-Content-Transfer
- Vercel: https://sitecoreai-content-transfer-seven.vercel.app

The project is linked to the GitHub repo. Hobby Deployment Protection on `*.vercel.app` may require a Vercel login. The hostname `sitecoreai-content-transfer.vercel.app` is already assigned to another Vercel team (`Americaneaglecom`) and cannot be claimed with this project.

## Stack

Next.js App Router, TypeScript, Tailwind CSS, and shadcn/ui.
