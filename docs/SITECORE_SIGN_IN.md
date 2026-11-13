# Sitecore sign-in and environment selection

## Implemented flow

1. A visitor selects **Connect environments** on the overview, then **Sign in with Sitecore** when sign-in is configured. The interface follows Sitecore's public Blok theme with a three-step workflow: Connect, Choose content, Review & transfer.
2. The Auth0 React SDK redirects to `auth.sitecorecloud.io` using Authorization Code with PKCE. Sitecore can reuse an existing Cloud Portal SSO session; consent, MFA or expired sessions may still require interaction.
3. The SDK handles the callback at `/auth/callback`, validates its transaction, and obtains this application's access token. The app does not extract a token from another tab, browser storage, developer tools or the Cloud Portal client.
4. The environment list loads automatically after authentication. The backend calls the documented Deploy endpoint `GET /api/environments/v1?PageNumber=1&PageSize=50` with that user's token. **Refresh list** reloads the list; **Load more** handles additional pages.
5. The user chooses source and destination, then selects **Continue to content**. The server resolves both IDs through Deploy and performs read-only transfer API permission checks before enabling the connection and opening content selection.
6. Each subsequent Sitecore request obtains a current access token through the SDK. No shared installation credentials are substituted on failures.

## One-time registration needed

This integration is implemented but **not configured or live-validated**. It cannot authenticate with an invented client ID or reuse the Cloud Portal's own OAuth client registration.

When registration is missing, the Connections page explicitly shows **Setup required** and a working **View setup steps** panel instead of a disabled sign-in button. The panel shows the current deployment's callback URL and links to the official registration guide. Developer automation credentials are kept under **Other connection options**, with one environment entered at a time. Unconnected visitors see a connection guide before accessing content selection or browsing.

The application owner must register an appropriate Sitecore SPA/OAuth client, register its HTTPS deployment URLs, and obtain permission to call the required APIs. Sitecore App Studio supports SPA client registrations with a public client ID and no client secret. Its documented interactive Marketplace audience is `https://api-webapp.sitecorecloud.io`; those flows use platform proxies/context IDs. The standalone native transfer APIs document automation JWTs targeting `https://api.sitecorecloud.io`. Do not assume those authorization paths are interchangeable.

Configure the actual audience and API scopes approved for this application's registration:

- `NEXT_PUBLIC_SITECORE_AUTH_CLIENT_ID`: registered public SPA client ID.
- `NEXT_PUBLIC_SITECORE_AUTH_AUDIENCE`: approved API audience; only the two Sitecore API audiences above are accepted by this UI.
- `NEXT_PUBLIC_SITECORE_AUTH_SCOPE`: approved scopes; defaults to basic `openid profile email`, which alone is not proof of Deploy/transfer access.
- `NEXT_PUBLIC_SITECORE_ORGANIZATION_ID`: optional organization context where required by the registration.
- Allowed callback: `https://YOUR_DOMAIN/auth/callback`.
- Allowed web origin: `https://YOUR_DOMAIN`.
- Allowed logout URL: `https://YOUR_DOMAIN`.

The settings are build-time public client configuration, not secrets. Do not put a client secret in any `NEXT_PUBLIC_` variable. Configure development callback/origin URLs through Sitecore's supported local development setup.

## Required compatibility check

Use the registered client to authenticate a permitted test user. Confirm the issued access token can:

1. List that user's environments through Deploy.
2. Read native transfer state/history on both chosen authoring environments.
3. Read source and destination parent IDs through Authoring GraphQL.
4. Create a non-production export after explicit review, forward chunks, and complete a destination import.

If Sitecore denies a call because this interactive token is not supported for that API, the app reports the failure. Obtain a supported registration/API grant or adapt to Sitecore's documented proxy API; do not silently fall back to an owner's machine token or bypass permissions. Until verified, sign-in is an optional integration preview rather than a working claim of full transfer authorization.

## Storage

Auth0's access-token cache is in memory. OAuth transaction state/PKCE verifier may be stored temporarily by the SDK to validate the redirect; these are not saved customer content or transfer history. The application uses no customer database. App sign-out clears its local Auth0 cache without logging the visitor out of every Sitecore application. Reloading clears local transfer drafts and forwarding progress.

## References

- [Create client credentials](https://doc.sitecore.com/mp/en/developers/marketplace/create-client-credentials.html)
- [App architecture and authorization](https://doc.sitecore.com/mp/en/developers/marketplace/app-architecture-and-authorization-options.html)
- [Sitecore Marketplace SDK interactive authentication](https://github.com/Sitecore/marketplace-sdk/blob/main/docs/experimental-xmc.md)
- [Deploy API documentation](https://doc.sitecore.com/sai/en/developers/sitecoreai/deploying-sitecoreai/deploy-api.html)
- [Deploy OpenAPI](https://xmclouddeploy-api.sitecorecloud.io/swagger/v1/swagger.json)
- [Native transfer authorization](https://api-docs.sitecore.com/sai/content-transfer-api/section/authorization)
