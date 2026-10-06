# Security policy

OpenQuoteStack is pre-1.0 software. Security fixes target the current default branch;
there is no published support window for older versions.

Do not publish credentials, customer data or exploit details in a public issue.
Report suspected vulnerabilities through GitHub private vulnerability reporting if
it is enabled for the repository. Otherwise contact the repository owner privately
through their profile before sharing details. No dedicated security email or response
SLA is currently established.

Include the affected revision, configuration, impact and minimal reproduction.
Use synthetic data. Tenant-isolation bypasses, session issues and executable formula
behavior are security-relevant. Coordinate disclosure after a fix is available.

See [security architecture and limitations](docs/security/model.md) and the
[deployment guide](docs/deployment/docker.md) before exposing an installation.
