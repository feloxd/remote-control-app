# Security policy

Do not report vulnerabilities by opening a public issue containing secrets,
credentials, private user data, or exploit details. Repository maintainers
should configure a private security contact or GitHub private vulnerability
reporting before publication.

## Deployment requirements

- HTTPS/WSS is required for public deployments.
- `JWT_SECRET`, `OPERATOR_USERNAME`, `OPERATOR_PASSWORD_HASH`, `CORS_ORIGINS`,
  and `SOURCE_CODE_URL` must be configured through environment variables.
- Production database files and client configuration files must remain outside
  version control.
- Default or shared credentials are not supported.

If a credential enters source control, rotate it immediately; removing the file
from the latest commit does not remove it from repository history.
