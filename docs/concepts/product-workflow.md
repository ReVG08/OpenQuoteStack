# Authoring and customer workflow

Register an account, name an organization, select its locale/currency and choose a
template or blank calculator. Optional branding can be skipped during setup and
configured under Branding. All template prices are examples; review rates, units,
terms and contact details before publication.

## Builder

Questions organizes steps and fields. Drag a field handle, or focus it and press
Space, use arrow keys, then Space to drop. Move controls provide another keyboard
option. Field keys are stable references; renaming updates pricing/condition
references. Visibility can use preceding fields with AND/OR groups.

Prices supports charges, per-unit rates, conditional rules, percentages, weekday
adjustments and graduated tiers. Minimum, maximum and ranges live with result
settings. Advanced formulas accept arithmetic and declared numeric variables;
unknown functions and JavaScript are rejected.

Save stores a validated draft with an optimistic version. A concurrent edit returns
a conflict instead of silently overwriting work. Preview uses the actual customer
renderer in desktop or mobile width and saves no quotes or analytics. Publish
captures a revision and updates the public link. History supports rollback. Draft
edits never alter a live revision. Unpublish or archive stops customer submissions.

## Customer result and contact

Published links need no customer account. Progress and validation guide customers
through the steps. The server pins each visit to its opened revision for 24 hours.
Publication during a visit does not change that visit's pricing. Results show the
engine's ordered explanation, total and optional range/disclaimer.

Contact capture can be required before the result, offered after it, optional or
disabled. Enabled forms require name/email; additional contact fields are optional.
A quote and pre-result contact commit together. Post-result contacts attach to the
same quote. Repeated submissions retain one estimate per visit.

Estimates shows recent quotes. Detail pages retain the original answers, revision
and calculation, support business statuses/internal notes, and download a branded
PDF. PDFs use retained pricing and current business branding/contact information;
optional expiry is a presentation date, not automatic quote invalidation. Leads
groups related contacts by email without replacing individual records.

## Analytics and portability

Dashboard and Analytics report the last 30 days of visits, starts, completions,
contacts and estimate values. Step reports separate revisions. Visits are sessions,
not unique people. Different currencies are never combined. Recent estimate/lead
lists are limited to 200 records; search and pagination are planned.

Export downloads a declarative `.oqs.json` definition. Import accepts up to 200 KB,
validates version, references and formulas, and always creates a new identity.
Existing calculators are preserved even when a portable ID or name collides.
Unsupported data fails without executing code. Definitions contain no customer
records. Imported text and currency are preserved; bilingual templates contain
translation metadata.
