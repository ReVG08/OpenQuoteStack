# Webhooks and background delivery

Owners and admins configure endpoints under **Settings → Webhooks**; scoped API
keys can use the [webhook API](../api/rest.md). Subscriptions include
`estimate.created`, `estimate.completed`, `lead.created`, `lead.updated`,
`estimate.status_changed` and `estimator.published`.

Events contain `id`, `type`, `createdAt`, `organizationId` and a stable resource
representation in `data`. Payloads are captured at commit, not reconstructed from
later state. Lead events contain customer contact details; estimate events contain
answers and calculations. Choose destinations accordingly.

Run `pnpm worker` during local development. Compose starts a dedicated worker.
Requests commit an event to the outbox and return without waiting for delivery.
Jobs have expiring leases, deduplication keys and up to five attempts. Retry delays
are approximately 10 seconds, one minute, five minutes and fifteen minutes, with
small jitter. `408`, `429`, network failures and `5xx` retry; other `3xx/4xx` fail
without following redirects. Successful responses are `2xx`. Failed active
webhook deliveries can be retried manually. HTTP codes, duration and error
categories are visible; consumer response bodies are discarded.

## Verify deliveries

Headers are `OQS-Event-Id`, `OQS-Delivery-Id` and:

```text
OQS-Signature: t=UNIX_SECONDS,v1=LOWERCASE_HEX_HMAC
```

Compute HMAC-SHA256 over `timestamp + "." + rawRequestBody` using the signing
secret. Verify **before** parsing or modifying the JSON. Enforce a five-minute
clock tolerance and persist event IDs to prevent duplicate effects. Timestamp
verification limits replay age; it does not replace durable deduplication.
A retry keeps the event/delivery IDs and receives a fresh timestamp/signature.

```ts
import { verifyWebhook } from "@openquotestack/sdk";
if (!(await verifyWebhook(secret, signatureHeader, rawBody))) {
  // Reject the request before processing.
}
```

The [working receiver](../../examples/webhook-verification/index.ts) verifies raw
bytes and atomically stores event IDs in private local files. Replace that storage
with a transaction in your own application for production processing.

## Destination policy

Endpoints require HTTPS on port 443 and a public DNS hostname. Credentials,
fragments, literal IPs, private/reserved addresses and mixed DNS results are
rejected. Each attempt rechecks DNS and pins the accepted IP while verifying the
TLS hostname. DNS has a five-second deadline; HTTP delivery has a ten-second
deadline. Redirects are never followed. A private receiver needs a public HTTPS
ingress; there is no unsafe destination override.

Signing secrets are shown once and encrypted at rest. Preserve
`OQS_ENCRYPTION_KEY` with installation backups. A replacement encryption key cannot
decrypt existing endpoints; recreate them when intentionally rotating it.
Delivery is at least once. Worker crashes can cause duplicates, and events may
arrive out of order. Compare event timestamps and deduplicate IDs in your consumer.
