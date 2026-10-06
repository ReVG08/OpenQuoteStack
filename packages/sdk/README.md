# @openquotestack/sdk

A local facade over the Schema and Engine packages.

```ts
import { quoteFromDocument } from "@openquotestack/sdk";
const result = quoteFromDocument(document, answers);
```

The package re-exports document parsing and calculation APIs. It performs no
network requests and does not include an HTTP client, API authentication or remote
estimator management. Those interfaces will follow a versioned REST API.

License: AGPL-3.0-only.
