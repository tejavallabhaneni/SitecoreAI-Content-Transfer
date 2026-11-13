# Branding and licence review — 12 November 2026

## Changes made

- Replaced the official SitecoreAI wordmark/mark in the app header, favicon and touch icon with an original document-and-arrow design. Official references are archived outside `public/` in this private repo, preserving their bytes.
- Used plain-text “for SitecoreAI” to describe compatibility. Added a visible independent-app notice and an About & licences page; no endorsement, certification or official status is claimed.
- Kept the red/blue colour preference but used an independent page composition and generic SVG workflow icons.
- Retained Lucide's exact ISC and Feather-derived MIT notices in `public/licenses/lucide.txt`.
- Included the Inter and Geist Mono copyright/SIL OFL 1.1 notices for self-hosted fonts.
- Added `npm run notices` and a prebuild hook. They generate a sanitized inventory of installed production packages, available licence/copyright/NOTICE texts, and Next.js vendored component notices. No local filesystem paths or environment values are included. Optional server/build packages are included conservatively; this is not a precise browser bundle bill of materials.
- Credited Can I Use/Can I Use Lite and retained the package's CC BY 4.0 licence. The app does not modify its compressed data.

## Review findings and remaining limits

Sitecore's [Terms of Use](https://www.sitecore.com/legal/terms-of-use) reserve rights in its logos and prohibit copying/retransmission without express written permission. Additional contractual terms could apply; no partner permission was verified. The [trademark page](https://www.sitecore.com/legal/trademarks) identifies Sitecore's marks. Removing the official logo reduces a clear branding risk; it is not a legal opinion on the app name, domain, palette, API usage, or overall trade dress. The original app mark has not undergone a trademark clearance search.

The installed dependency scan includes permissive licences and exceptions: CC BY 4.0 data, Python 2.0 notices, and Sharp's optional native/WASM components with LGPL declarations. LGPL/GPL texts and upstream source/build links are included for those components. They are image tooling in the server/build dependency graph; the application does not intentionally deliver native libraries to browsers. This scan does not establish whether every binary-conveyance obligation is satisfied. Before distributing a self-hosted binary/container or modified library, review the exact platform libraries, corresponding sources, relinking and notice obligations with counsel. Do not describe all dependencies as permissively licensed.

`@next/env` and `@next/swc-*` missing standalone package texts receive the Next.js monorepo MIT text. The `client-only` React marker package receives the React project MIT text. Existing package notices and source links are preserved rather than inventing copyright statements. No licence for this project's own source has been selected or granted by this update.

Public deployment is not compliance certification. An appropriate legal review still needs the operator's jurisdiction, contracts, privacy/data-processing requirements, hosting/log retention, customer authorizations and any monetization plans. The app's current no-database design does not mean hosting providers have no logs or legal obligations. No private customer content or credentials should appear in screenshots, examples or published documentation.

## Primary references

- [Lucide licence](https://lucide.dev/license)
- [Inter OFL](https://github.com/google/fonts/blob/main/ofl/inter/OFL.txt)
- [Geist Mono OFL](https://github.com/google/fonts/blob/main/ofl/geistmono/OFL.txt)
- [caniuse-lite source and licence](https://github.com/browserslist/caniuse-lite)
- [Sharp installation and licensing](https://sharp.pixelplumbing.com/install/)
- [Sharp libvips source/build repository](https://github.com/lovell/sharp-libvips)

No Sitecore Cloud Portal registration, Marketplace app, permission grant or credential was created or changed for these UI/licensing changes.
