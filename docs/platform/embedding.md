# Embedding

Publish an estimator, then open **Settings → Integrations**. Register the exact
HTTPS origin of each website allowed to frame it, including scheme and port.
Paths and wildcards are not allowed. The canonical installation origin is also
allowed. Preview and administration routes cannot be framed.

## JavaScript-assisted embed

```html
<script src="https://quotes.example.com/embed.js" defer></script>
<div
  data-oqs-organization="acme-moving"
  data-oqs-estimator="your-estimator-id"
  data-oqs-title="Moving cost calculator"
></div>
```

The script mounts one iframe per element, displays loading/error text and adjusts
height. Optional `data-oqs-loading`, `data-oqs-error` and `data-oqs-open` override
its English status/link text. It works without third-party cookies or customer
accounts. Multiple calculators can appear on one page.

## Plain iframe

```html
<iframe
  src="https://quotes.example.com/embed/acme-moving/your-estimator-id"
  title="Moving cost calculator"
  style="width:100%;height:850px;border:0"
></iframe>
```

Plain iframes use the same allowlist but have a fixed caller-controlled height.
They do not opt into messaging. Customer submissions stay in the installation.

## Resize protocol v1

An assisted iframe includes `parentOrigin` and a per-frame opaque `channel` query
parameter. The renderer validates the origin against the organization's allowlist.
It sends `{type:"oqs:resize/v1",channel,height}` with an explicit target origin.
The host accepts messages only when origin, source window and channel match and
height is an integer from 80 to 10,000 pixels. Messages contain no answers,
customer details or calculation data. CSP `frame-ancestors` independently enforces
the allowed origins; messaging is not the framing authorization mechanism.
