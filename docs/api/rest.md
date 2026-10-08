# REST API v1

Requests use the installation's canonical origin and `Authorization: Bearer
<API_KEY>`. Create keys under **Settings → API keys** as an owner or admin. Secrets
are shown once; revoked keys return `401`. Keep keys on servers, not in browser code.

| Method | Path                     | Scope             | Behavior                                          |
| ------ | ------------------------ | ----------------- | ------------------------------------------------- |
| GET    | `/api/v1/estimators`     | `estimators:read` | Organization's non-deleted estimators             |
| GET    | `/api/v1/estimators/:id` | `estimators:read` | Identity and current published definition         |
| GET    | `/api/v1/estimates`      | `estimates:read`  | Retained calculations                             |
| GET    | `/api/v1/estimates/:id`  | `estimates:read`  | Answers, result and revision                      |
| POST   | `/api/v1/estimates`      | `estimates:write` | Calculate and retain a published estimate         |
| GET    | `/api/v1/leads`          | `leads:read`      | Customer contact records                          |
| GET    | `/api/v1/leads/:id`      | `leads:read`      | One contact record                                |
| GET    | `/api/v1/webhooks`       | `webhooks:manage` | At most 100 endpoint configurations               |
| POST   | `/api/v1/webhooks`       | `webhooks:manage` | Register a destination; signing secret shown once |
| DELETE | `/api/v1/webhooks/:id`   | `webhooks:manage` | Disable delivery to an endpoint                   |

## Representation and pagination

IDs are opaque, case-sensitive strings. Timestamps are UTC ISO 8601 strings.
Single resources return `{ "data": ... }`. Lists of estimators, estimates and leads
accept `limit` (1–100, default 25) and `cursor` and return:

```json
{ "data": [], "pagination": { "limit": 25, "nextCursor": null } }
```

Pass `nextCursor` on the next request. Results sort by descending ID. Pagination
is not a frozen snapshot; concurrent inserts can appear on a fresh first page.
Webhook configuration listing is bounded and does not use cursor pagination.

Estimator lists contain identity, status, update time and the published revision ID
and number. Detail responses additionally include its portable definition; drafts
are not exposed. Estimate lists contain identity, status, revision, lead ID, currency,
minor-unit exponent, total and optional range. Answers and full results are omitted
from lists to keep pagination bounded. Estimate detail responses include
`id`, `estimatorId`, `revision`, `status`, `createdAt`, `answers`, `result` and
`leadId`. Contact details require the separate `leads:read` scope. Internal notes,
audit records, session capabilities and integration secrets are excluded.

## Create an estimate

Send JSON under 250 KB and a unique `Idempotency-Key` of 16–100 letters, digits,
underscores or hyphens:

```sh
curl "$OPENQUOTESTACK_BASE_URL/api/v1/estimates" \
  -H "Authorization: Bearer $OPENQUOTESTACK_API_KEY" \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: order-reference-20261008' \
  --data '{"estimatorId":"your-id","answers":{"bedrooms":3}}'
```

The answers must satisfy the estimator's fields and required inputs. Add
`revisionId` to require the expected currently published revision; a mismatch
returns `409`. Optional `contact` accepts `name`, `email`, `phone`, `company`,
`address` and `notes`. Name and email are required when contact is supplied.
Before-result capture requires contact; disabled capture discards contact.

The server calculates the result; caller-supplied totals are rejected. A new
submission returns `201`. Repeating the same key and body returns the original
estimate with `200` and `Idempotency-Replayed: true`, including after publication
changes. Changing the body under an existing key returns `409`. The key is scoped
to the API credential and retained with the estimate. JSON property order can
change the request hash; retain the original request body when retrying.
API-created estimates do not simulate public views or step analytics.

## Errors and limits

```json
{
  "error": {
    "code": "forbidden",
    "message": "The API key does not grant this scope.",
    "requestId": "opaque-trace-id"
  }
}
```

`X-Request-Id` appears on all API responses. Errors use `400` for malformed requests,
`401` for invalid credentials, `403` for missing scope, `404` for absent or foreign
resources, `409` for conflicts, `422` for invalid fields, `429` for request limits
and `500` for unexpected failures. Responses do not contain raw exceptions.
Keys allow 120 requests per minute; the installation also has a 2,000/minute API
limit. `429` includes `Retry-After: 60`. Limits are shared through PostgreSQL.
The API does not enable browser CORS. TLS is required outside loopback development.
