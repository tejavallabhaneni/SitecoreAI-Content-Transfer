# Security policy

This application is a self-hosted, stateless pre-release project. Do not use
production content or credentials until a staging test and security review.

## Data handling

The app does **not** use an application database or store customer Sitecore
content/history. SitecoreAI APIs provide the content and import history. Each
installation's operator configures two SitecoreAI automation clients as
server-side secrets. GitHub OAuth is used to authorize access to the deployed
app; sessions use signed HttpOnly cookies.

Never commit credentials, real content exports, access tokens or internal
repositories. SitecoreAI retains transfers and history according to its own
retention policies; this tool doesn't control their retention.

## Reporting

Use GitHub's private vulnerability reporting feature where enabled or contact
the repository owner privately. Do not file public issues containing secrets.

## Open release requirements

Check permissions, OAuth flow, CSRF protection, hostile input handling,
server timeouts, Git history for secrets, third-party dependencies, and
the license/ownership rights before making the repository public.
