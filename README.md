# SitecoreAI Content Transfer

[Open the app](https://sitecoreai-ae-content-transfer-app.vercel.app) · [Deployment](docs/DEPLOYMENT.md)

A simple SitecoreAI Marketplace app for copying pages and media from one SitecoreAI environment to another. It shows both environments' content trees side by side, checks every item before anything is written, and uses Sitecore's own Content Transfer API, so item IDs stay the same.

## How to use it

1. **Install the app in every environment.** In the Sitecore Cloud Portal, open App Studio and install Content Transfer. Give it access to each environment you want to copy between.
2. **Open it and pick From and To.** Open Content Transfer from SitecoreAI. It lists the environments it's installed in.
3. **Tick what to copy.** Open folders in the From tree and tick pages or media. Badges show what's **New** in To, what already **Exists**, and what has a **different ID**. The To tree shows what's there now.
4. **Review and start.** The check shows what will happen to each item: Create, Update, Skip or Conflict, with how to fix a conflict. Approve, start, and follow the progress. Then publish in the destination through your normal workflow.

Opened outside SitecoreAI, the app shows these steps and an offline demo with three sample environments. The demo never contacts Sitecore.

## How it works

- SitecoreAI tells the app which environments it's installed in (`application.context` → `resourceAccess`). Every call goes through the Marketplace SDK, addressed by the environment's context ID. There are no credentials, sign-in pages or OAuth callbacks.
- Trees and checks use the Authoring GraphQL API (`xmc.authoring.graphql`). Transfers use the Content Transfer API (`xmc.contentTransfer.*`): the source packages the items, each chunk is copied to the destination, and the destination imports the file into **master**. Media and content travel in separate transfers, and the source transfer is always removed afterwards.
- A transfer is blocked when an item has a different ID at the same path, or a parent folder is missing or has a different ID, because those would orphan imported items. The check runs again right before the transfer starts.
- Nothing is stored outside SitecoreAI. Plans and progress live in the current tab and clear on reload. Publishing, deleting and replacing whole trees are not available.

## Local development

Node.js 22+ and npm:

```sh
npm ci
npm run dev
```

Outside SitecoreAI the app runs in demo mode. To use real environments, register it as a custom app in App Studio with SitecoreAI APIs enabled, point it at your deployment, and open it from SitecoreAI.

```sh
npm run lint
npx tsc --noEmit
npm run build:worker
node --experimental-strip-types --test tests/*.test.mjs
node --test tests/*.test.cjs
npm run build
```

`build:worker` compiles the legacy worker modules for their contract tests. The app itself doesn't run that worker.

## Validation limits

Automated tests cover the review outcomes, approvals, the Content Transfer call order, media/content separation, clean-up after failures and failed imports, using the offline demo and a recording fake. A real transfer between two SitecoreAI environments through the Marketplace SDK has not been validated yet. Start with a small item in non-production environments.

Keep the tab open while chunks are copied; an import already accepted by Sitecore continues on its own. Failed writes aren't retried automatically, because their outcome may be uncertain.

## Contributions

See [CONTRIBUTING.md](CONTRIBUTING.md) and [SECURITY.md](SECURITY.md). No open-source license has been selected; public repository visibility alone does not grant additional reuse rights.
