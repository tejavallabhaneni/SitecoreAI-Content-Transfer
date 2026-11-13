# Security policy

This revision is a developer preview and has not been validated against a live two-environment transfer. Validate with non-production content first.

## Public workflow boundaries

- Each user supplies authorization for their own two SitecoreAI authoring environments.
- Public API requests cannot use installation-owner Sitecore credentials.
- Sitecore client secrets are exchanged for tokens without entering the process-wide token cache. Tokens and draft plans remain in the current browser tab's memory; no browser persistent storage, cookies, filesystem or application database is used by the public workflow.
- Requests are bounded, same-origin JSON. API hosts must be HTTPS Sitecore cloud origins. Redirects, arbitrary proxy URLs, path traversal and delete/tree-replacement actions are unavailable.
- Explicit approval and repeated real parent-ID checks precede export creation.
- Failed writes are not retried automatically. Export packages and destination transfer files are not automatically deleted.
- Destination imports can continue inside Sitecore after the browser closes. Source export/chunk forwarding requires the tab to remain open.
- Legacy database-backed endpoints return 410. Legacy source modules remain for reference and are not the public app's runtime architecture.

Hosting operators must protect deployment administration, keep dependencies updated, avoid logging request bodies/tokens, and ensure their hosting limits suit the intended transfer sizes. An access token grants Sitecore access until expiry/revocation; clearing browser memory does not itself revoke it in Sitecore.

Please disclose vulnerabilities privately to the repository owner or through GitHub private vulnerability reporting when enabled. Do not include credentials, customer content or exploit secrets in public issues.
