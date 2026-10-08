# Portable templates and OQS files

A `.oqs.json` file is UTF-8 declarative JSON with `schemaVersion: "1"`, an estimator
and optional template metadata. It contains no JavaScript, credentials, leads or
tenant database identity. The schema package validates size/depth, identifiers,
defaults, formulas and references. Unsupported versions fail explicitly.

```json
{
  "schemaVersion": "1",
  "template": {
    "id": "residential-cleaning",
    "name": "Residential Cleaning",
    "category": "Home services",
    "version": "1.0.0",
    "description": "Bedrooms, bathrooms and optional cleaning services."
  },
  "estimator": {}
}
```

The empty estimator above illustrates the wrapper only; a complete working definition
is [residential-cleaning.oqs.json](../../templates/residential-cleaning.oqs.json).
Start from one of the three bundled templates. No database access is needed to author
or validate a template.

Use a stable unique metadata ID, a readable name, category, template version and a
concise description. Field, choice and rule keys are persistent references. Keep
price examples realistic but identify them as editable examples; avoid actual
customer contact details or copyrighted assets without permission. Include useful
English and Brazilian Portuguese translations when contributing bundled templates.

```sh
pnpm templates:validate
```

Add behavior tests for expected calculations, conditions and bounds. Run engine and
schema tests when changing pricing or field semantics. Template versions describe
template changes; they do not replace the document's schema version or package
compatibility. Strict older readers may reject newly added schema-v1 properties.
Use compatible package releases; no automatic schema migration is currently offered.

Import from the Estimators screen. A validated import always creates a new identity,
so a duplicate template name cannot overwrite a published calculator. Imported
currency and pricing are preserved. Gallery creation adapts example major-unit
prices to the organization's currency exponent without exchange-rate conversion.
Export downloads the current draft as `.oqs.json`; review it before sharing. Historical
estimates remain tied to their original published revision.
