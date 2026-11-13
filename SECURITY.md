# Security policy

No production version is supported yet. Do not use the demo to migrate
production SitecoreAI content or place credentials in this repository.

Please privately disclose security findings through GitHub's private
vulnerability reporting (when enabled) or by contacting the repository
owner privately. Do not post credentials or exploit details in public issues.

Before release, this project requires authenticated sessions, authorization on
every route, encrypted credential storage, durable jobs/workers, validated
environment scopes, idempotency, audit logging, secret/history scanning,
negative security tests, and staging validation.
