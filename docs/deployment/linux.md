# Linux VPS and reverse proxies

Use a supported Linux release with Docker Engine and Compose installed through the
vendor's documentation. Keep system packages current, allow HTTPS at the firewall,
and restrict SSH and database access. Clone the repository, configure `.env` and
follow [Compose installation](docker.md). Reserve storage for PostgreSQL, assets,
backups and image build layers. Test restoration before accepting customer data.

The following proxy recipes assume the web port is available only at
`127.0.0.1:3000`. Set `BETTER_AUTH_URL=https://quotes.example.com`. Preserve the
requested host; do not replace every tenant domain with the canonical hostname.

## Caddy

```caddyfile
quotes.example.com, quote.customer.example.com {
    reverse_proxy 127.0.0.1:3000
}
```

Configure real DNS records first. Caddy obtains certificates for configured names.
Add each verified customer domain explicitly or implement your own restricted
certificate authorization policy. An unbounded on-demand TLS policy is unsafe.
OpenQuoteStack verifies tenant DNS ownership; it does not configure Caddy or issue
certificates. Use the [domain guide](../platform/domains.md).

## Nginx

Obtain and renew certificates separately. Replace certificate paths with your
actual deployment files. An HTTP listener may redirect configured hosts to HTTPS.

```nginx
server {
    listen 443 ssl;
    server_name quotes.example.com quote.customer.example.com;
    ssl_certificate /etc/ssl/oqs/fullchain.pem;
    ssl_certificate_key /etc/ssl/oqs/private.key;
    client_max_body_size 3m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_http_version 1.1;
    }
}
```

A certificate must cover every configured name. Add network rate limits according
to installation load. Do not log authorization headers, cookies, request bodies
or query strings containing credentials.

## Dokploy and Coolify

Use a Docker Compose deployment from this repository, retain all four services and
both named volumes, and supply the environment variables through the panel's secret
configuration. Route the public hostname to `web:3000`, not the migration or worker
service. Panel-managed proxies normally reach the internal service network; adjust
host port publication to that network model rather than exposing PostgreSQL.

Set the canonical HTTPS origin, enable TLS, preserve `Host`, and allow the migration
service to complete before web/worker startup. Configure asset persistence for both
web and worker, plus scheduled database/storage backups. Customer domains also need
panel routing and certificates after application verification.

These are manual deployment recipes. Panel UI versions, routing networks and backup
features vary. They have not been tested as one-click installations. Verify `/health`,
worker heartbeat, uploads, registration and a published estimate on your installation.
