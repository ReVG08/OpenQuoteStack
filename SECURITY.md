# Security policy

## Supported versions

OpenQuoteStack is pre-1.0 software. Security fixes land on `main` and are included
in subsequent prereleases. Older prereleases have no guaranteed backports or support window.
Use the latest available version and review the changelog before upgrading.

## Reporting a vulnerability

Do not include exploit details, credentials or customer data in public issues,
discussions or pull requests.

Submit a
[private vulnerability report](https://github.com/ReVG08/OpenQuoteStack/security/advisories/new).
If that option is unavailable, open an issue asking the maintainer to establish a
private reporting channel. Include no vulnerability details in that request.

Include the following in a private report:

- Affected package or application version, or commit identifier.
- Relevant deployment configuration, with secrets removed.
- Expected behavior, observed behavior and potential impact.
- Minimal reproduction steps using synthetic data.

Tenant-isolation bypasses, authentication or authorization failures, unsafe webhook
destinations, and execution of imported or formula content are security-relevant.
Report suspected vulnerabilities even when their full impact is uncertain.

## Disclosure and updates

Allow time to investigate and coordinate public disclosure after a fix or
mitigation is available. Avoid accessing other tenants' data, disrupting services,
or testing installations without their operators' permission.

Confirmed fixes are documented in the changelog. Operators are responsible for
applying updates and reviewing deployment-specific mitigations. There is no
guaranteed response time or bug bounty.

See the [security model and limitations](docs/security/model.md),
[privacy documentation](docs/security/privacy.md), and
[deployment guide](docs/deployment/docker.md) before exposing an installation.
