# Custom domains

Custom domains require DNS access and an HTTPS reverse proxy managed by the
installation operator. OpenQuoteStack does not provision DNS or certificates.

1. Add a hostname under **Settings → Domains**.
2. Point its A/AAAA records to the public server. All returned addresses must be public.
3. Add the displayed TXT record at `_oqs.HOSTNAME`:
   `v=OQS1;token=oqs_domain_...`.
4. Configure an explicit HTTPS virtual host that preserves the original Host header.
5. Select **Verify DNS**. Successful verification activates the host.

The host root lists that organization's published estimators. Public links and
embed routes resolve only that tenant. Login, administration and REST API remain
on `BETTER_AUTH_URL`; unregistered hosts return `404`. Forwarded-host values are
not used to choose organizations. Canonical-origin brand images remain available.

The worker rechecks ownership after twelve hours. A failed check disables routing,
and a check older than 24 hours also stops serving. Restore DNS and verify again
from Settings. Removing a domain disconnects it immediately. DNS success does not
prove your reverse proxy or certificate works: open the HTTPS address after setup.

See [reverse proxies](../deployment/linux.md). Declare explicit domains;
do not enable unrestricted on-demand certificate issuance for arbitrary hosts.
