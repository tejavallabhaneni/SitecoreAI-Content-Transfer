# Content Transfer logo

This is a custom logo for the Content Transfer app. It is not the official SitecoreAI logo. Its purple palette follows the app's Sitecore Blok theme, while the document panels and directional arrow represent copying content between environments.

- SVG master: `public/brand/content-transfer.svg`.
- 512 × 512 PNG: `public/brand/content-transfer-512.png`, suitable for an app-listing upload.
- Shared interface component: `src/components/app-logo.tsx`, used in the desktop sidebar, mobile header and mobile navigation panel.
- Root metadata references the same SVG for the browser icon and the PNG for the touch icon.

Keep the SVG master and PNG in sync. The PNG was rendered from the SVG with the existing Next.js ImageResponse renderer. Neither asset contains customer data or environment details.

Public asset URLs after deployment:

- https://sitecoreai-ae-content-transfer-app.vercel.app/brand/content-transfer.svg
- https://sitecoreai-ae-content-transfer-app.vercel.app/brand/content-transfer-512.png
