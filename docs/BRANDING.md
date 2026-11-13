# SitecoreAI branding for Content Transfer

The shared header uses the original SitecoreAI wordmark with a separate Content Transfer caption. The logo artwork has not been recoloured or redrawn. The interface uses the Cloud Portal blue and red tokens, observed from its visible page styles: blue 500 `#4A65E8`, blue 600 `#344BC3`, red 500 `#D92739`, and red 600 `#B30426`.

## Current assets

- `public/brand/sitecoreai-logo.svg`: original SitecoreAI wordmark.
- `public/brand/sitecoreai-mark.svg`: original SitecoreAI mark, used for the browser icon.
- `public/brand/sitecoreai-mark-512.png`: scaled PNG rendering of the mark for the touch/app icon.
- `src/app/favicon.ico`: the same mark rendered at 16, 32, 48 and 256px.
- `src/components/app-logo.tsx`: shared by the desktop sidebar, mobile header and mobile navigation panel.

The earlier custom Content Transfer SVG and PNG are retained. The app continues to be named Content Transfer for SitecoreAI; using the requested logo does not represent an authentication configuration change.

## Official asset sources

- [Sitecore Blok logo library](https://blok.sitecore.com/graphics/logos)
- [Original SitecoreAI wordmark](https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/logo-sitecoreai)
- [Original SitecoreAI mark](https://delivery-sitecore.sitecorecontenthub.cloud/api/public/content/mark-sitecoreai)

The original SVG files are preserved byte-for-byte. PNG and ICO versions were rendered from the original mark with the existing Next.js ImageResponse renderer.
