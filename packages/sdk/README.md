# @openquotestack/sdk

Typed server-side REST client, local calculation facade and webhook verification.
The package is ESM and requires Node.js 20+ with Fetch, AbortSignal.timeout and Web
Crypto. The repository application uses Node.js 24. Keep API keys out of browser code.

```ts
import { OpenQuoteStack, OpenQuoteStackError } from "@openquotestack/sdk";

const oqs = new OpenQuoteStack({
  apiKey: process.env.OPENQUOTESTACK_API_KEY!,
  baseUrl: "https://quotes.example.com",
});
const page = await oqs.estimators.list({ limit: 25 });
const estimator = await oqs.estimators.get(page.data[0]!.id);
const estimate = await oqs.estimates.get("your-estimate-id");
```

Lists return `data` and `pagination.nextCursor`. Estimator and estimate lists use
compact summaries; detail calls include the definition or retained answers/result.
Methods include `estimators.list/get`, `estimates.list/get/create` and `leads.list/get`.
No browser cookies are sent. Redirects fail. The default timeout is 15 seconds;
`timeoutMs` and a custom Fetch implementation are configurable.

```ts
const quote = await oqs.estimates.create(
  { estimatorId: estimator.id, answers },
  { idempotencyKey: "persistent-application-request-id" },
);
```

Persist and reuse the key and original body when retrying. A missing key generates
a new UUID per call; automatic request retries are not performed. `OpenQuoteStackError`
exposes `status`, `code`, `requestId` and optional `retryAfter`. Transport errors use
status 0 and do not include credentials. The base URL must be the canonical origin,
without a path/query/fragment; HTTPS is required except for loopback development.

```ts
import { verifyWebhook, quoteFromDocument } from "@openquotestack/sdk";
const valid = await verifyWebhook(secret, signatureHeader, rawRequestBytes);
const localResult = quoteFromDocument(document, answers);
```

Webhook verification uses timestamped HMAC over unchanged raw bytes and a default
five-minute timestamp tolerance. Deduplicate event IDs in durable storage after
verification. Types and scope/event constants are also exported from
`@openquotestack/sdk/api-types` without loading the local engine facade.

See the [REST contract](https://github.com/ReVG08/OpenQuoteStack/blob/main/docs/api/rest.md),
[webhook guide](https://github.com/ReVG08/OpenQuoteStack/blob/main/docs/platform/webhooks.md)
and [Node example](https://github.com/ReVG08/OpenQuoteStack/tree/main/examples/sdk-node).
License: AGPL-3.0-only. Packages are prepared locally; external publication is separate.
