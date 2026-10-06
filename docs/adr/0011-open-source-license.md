# ADR-0011: Use AGPL-3.0-only

Status: Accepted
Date: 2026-10-06

## Context

White-label software can be modified and commercially hosted. Source availability for those modifications is a strategic concern.

## Decision

License the repository and public packages under the standard GNU Affero General Public License version 3 only. Keep the complete license text in LICENSE.

## Alternatives considered

MIT permits closed derivatives with minimal notice requirements. Apache-2.0 adds explicit patent grants and remains permissive. Neither requires network-served modifications to make corresponding source available.

## Consequences

Commercial hosting and white labeling remain possible under the license. Modified network-served versions have source-offer obligations; redistribution has additional copyleft requirements. Embedding public packages in proprietary software needs compatibility review. A permissive package split would require a deliberate future licensing decision.

References: [AGPL-3.0-only text](https://spdx.org/licenses/AGPL-3.0-only.html), [Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0), [MIT](https://opensource.org/license/mit).
