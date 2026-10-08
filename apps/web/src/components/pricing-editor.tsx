"use client";
import { parseFormula } from "@openquotestack/engine";
import {
  isNumericField,
  type Estimator,
  type Formula,
  type PricingRule,
} from "@openquotestack/schema";
import { copy } from "@/lib/product-i18n";
import type { Locale } from "@/lib/i18n";
import { ConditionEditor } from "./condition-editor";
export function moneyMinor(value: string, digits: number): number {
  if (!/^\d+(\.\d*)?$/.test(value)) throw new Error("Invalid amount");
  const [whole, fraction = ""] = value.split(".");
  if (fraction.length > digits) throw new Error("Too many decimal places");
  const n =
    BigInt(whole!) * 10n ** BigInt(digits) +
    BigInt(fraction.padEnd(digits, "0") || "0");
  if (n > BigInt(Number.MAX_SAFE_INTEGER))
    throw new Error("Amount exceeds limits");
  return Number(n);
}
export function MoneyInput({
  value,
  onChange,
  digits,
  label,
  currency,
}: {
  value: number;
  onChange: (n: number) => void;
  digits: number;
  label: string;
  currency: string;
}) {
  return (
    <label>
      {label} <small>{currency}</small>
      <input
        key={`${value}-${digits}`}
        type="text"
        inputMode="decimal"
        defaultValue={(value / 10 ** digits).toFixed(digits)}
        onBlur={(e) => {
          try {
            onChange(moneyMinor(e.target.value.replace(",", "."), digits));
            e.target.setCustomValidity("");
          } catch {
            e.target.setCustomValidity(
              `${label}: ${digits} decimal places maximum`,
            );
            e.target.reportValidity();
          }
        }}
      />
    </label>
  );
}
const formulaText = (e: Formula): string =>
  "value" in e
    ? e.value
    : "variable" in e
      ? e.variable
      : `(${formulaText(e.left)} ${e.op} ${formulaText(e.right)})`;
export function PricingEditor({
  estimator,
  onChange,
  locale,
}: {
  estimator: Estimator;
  onChange: (e: Estimator) => void;
  locale: Locale;
}) {
  const t = copy(locale),
    fields = estimator.steps
      .flatMap((s) => s.fields)
      .filter((f) => !["info", "divider"].includes(f.type)),
    numeric = fields.filter((f) => isNumericField(f.type)),
    dates = fields.filter((f) => f.type === "date"),
    digits = estimator.currency.minorUnits;
  const update = (id: string, rule: PricingRule) =>
    onChange({
      ...estimator,
      rules: estimator.rules.map((r) => (r.id === id ? rule : r)),
    });
  const names = {
    fixed: t("base"),
    per_unit: t("perUnit"),
    percentage: t("percentage"),
    tiered: t("tiers"),
    date_weekday: t("weekend"),
    formula: t("formula"),
  };
  function newRule(type: PricingRule["type"]) {
    const id = `rule_${crypto.randomUUID().replaceAll("-", "")}`,
      common = { id, label: names[type] };
    let r: PricingRule;
    if (type === "fixed") r = { ...common, type, amountMinor: 0 };
    else if (type === "per_unit")
      r = { ...common, type, field: numeric[0]!.id, rateMinor: 0 };
    else if (type === "percentage")
      r = { ...common, type, percent: "10", basis: "running_total" };
    else if (type === "tiered")
      r = {
        ...common,
        type,
        field: numeric[0]!.id,
        tiers: [
          { upTo: 10, rateMinor: 100 },
          { upTo: null, rateMinor: 80 },
        ],
      };
    else if (type === "date_weekday")
      r = {
        ...common,
        type,
        field: dates[0]!.id,
        days: [0, 6],
        percent: "15",
        basis: "running_total",
      };
    else r = { ...common, type, expression: { value: "0" } };
    onChange({ ...estimator, rules: [...estimator.rules, r] });
  }
  return (
    <section>
      <div className="section-intro">
        <h2>{t("pricing")}</h2>
        <p>
          {locale === "pt-BR"
            ? "As regras são aplicadas na ordem abaixo. Valores e percentuais mantêm um detalhamento auditável."
            : "Rules run in the order below. Every charge and adjustment keeps a calculation trace."}
        </p>
      </div>
      {estimator.rules.map((r, index) => (
        <section className="rule-card" key={r.id}>
          <div className="section-heading">
            <span className="badge">{names[r.type]}</span>
            <div className="actions">
              <button
                type="button"
                className="icon-button"
                disabled={index === 0}
                aria-label={t("moveUp")}
                onClick={() => {
                  const rules = [...estimator.rules];
                  [rules[index - 1], rules[index]] = [
                    rules[index]!,
                    rules[index - 1]!,
                  ];
                  onChange({ ...estimator, rules });
                }}
              >
                ↑
              </button>
              <button
                type="button"
                className="icon-button"
                disabled={index === estimator.rules.length - 1}
                aria-label={t("moveDown")}
                onClick={() => {
                  const rules = [...estimator.rules];
                  [rules[index + 1], rules[index]] = [
                    rules[index]!,
                    rules[index + 1]!,
                  ];
                  onChange({ ...estimator, rules });
                }}
              >
                ↓
              </button>
              <button
                className="icon-button"
                type="button"
                disabled={estimator.rules.length === 1}
                aria-label={t("remove")}
                onClick={() =>
                  onChange({
                    ...estimator,
                    rules: estimator.rules.filter((x) => x.id !== r.id),
                  })
                }
              >
                ×
              </button>
            </div>
          </div>
          <label>
            {t("label")}
            <input
              value={r.label}
              maxLength={200}
              onChange={(e) => update(r.id, { ...r, label: e.target.value })}
            />
          </label>
          {"field" in r && (
            <label>
              {t("fields")}
              <select
                value={r.field}
                onChange={(e) => update(r.id, { ...r, field: e.target.value })}
              >
                {(r.type === "date_weekday" ? dates : numeric).map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.label}
                  </option>
                ))}
              </select>
            </label>
          )}
          {r.type === "fixed" && (
            <MoneyInput
              value={r.amountMinor}
              onChange={(amountMinor) => update(r.id, { ...r, amountMinor })}
              digits={digits}
              currency={estimator.currency.code}
              label={t("amount")}
            />
          )}
          {r.type === "per_unit" && (
            <MoneyInput
              value={r.rateMinor}
              onChange={(rateMinor) => update(r.id, { ...r, rateMinor })}
              digits={digits}
              currency={estimator.currency.code}
              label={t("rate")}
            />
          )}
          {(r.type === "percentage" || r.type === "date_weekday") && (
            <div className="form-grid">
              <label>
                {t("percent")}
                <input
                  type="number"
                  min={-100}
                  step="any"
                  value={r.percent}
                  onChange={(e) =>
                    update(r.id, { ...r, percent: e.target.value })
                  }
                />
              </label>
              <label>
                {t("basis")}
                <select
                  value={r.basis}
                  onChange={(e) =>
                    update(r.id, {
                      ...r,
                      basis: e.target.value as "subtotal" | "running_total",
                    })
                  }
                >
                  <option value="subtotal">{t("subtotal")}</option>
                  <option value="running_total">{t("running")}</option>
                </select>
              </label>
            </div>
          )}
          {r.type === "date_weekday" && (
            <label>
              {t("days")}
              <input
                defaultValue={r.days.join(", ")}
                onBlur={(e) =>
                  update(r.id, {
                    ...r,
                    days: e.target.value
                      .split(",")
                      .map((x) => Number(x.trim())),
                  })
                }
              />
            </label>
          )}
          {r.type === "tiered" && (
            <>
              <p className="field-help">{t("openTier")}</p>
              {r.tiers.map((tier, i) => (
                <div className="tier-row" key={i}>
                  <label>
                    {t("upTo")}
                    <input
                      type="number"
                      min={0}
                      value={tier.upTo ?? ""}
                      onChange={(e) =>
                        update(r.id, {
                          ...r,
                          tiers: r.tiers.map((x, j) =>
                            j === i
                              ? {
                                  ...x,
                                  upTo:
                                    e.target.value === ""
                                      ? null
                                      : Number(e.target.value),
                                }
                              : x,
                          ),
                        })
                      }
                    />
                  </label>
                  <MoneyInput
                    value={tier.rateMinor}
                    digits={digits}
                    currency={estimator.currency.code}
                    label={t("rate")}
                    onChange={(rateMinor) =>
                      update(r.id, {
                        ...r,
                        tiers: r.tiers.map((x, j) =>
                          j === i ? { ...x, rateMinor } : x,
                        ),
                      })
                    }
                  />
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={t("remove")}
                    onClick={() =>
                      update(r.id, {
                        ...r,
                        tiers: r.tiers.filter((_, j) => j !== i),
                      })
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  update(r.id, {
                    ...r,
                    tiers: [
                      ...r.tiers.slice(0, -1),
                      {
                        upTo: (r.tiers.at(-2)?.upTo ?? 0) + 10,
                        rateMinor: 100,
                      },
                      r.tiers.at(-1)!,
                    ],
                  })
                }
              >
                + {t("addTier")}
              </button>
            </>
          )}
          {r.type === "formula" && (
            <label>
              {t("formula")}
              <input
                className="mono"
                key={JSON.stringify(r.expression)}
                defaultValue={formulaText(r.expression)}
                onBlur={(e) => {
                  try {
                    update(r.id, {
                      ...r,
                      expression: parseFormula(e.target.value),
                    });
                    e.target.setCustomValidity("");
                  } catch {
                    e.target.setCustomValidity(t("invalidError"));
                    e.target.reportValidity();
                  }
                }}
              />
              <small>{t("formulaHelp")}</small>
              <small>
                {[
                  ...numeric.map((f) => f.id),
                  ...Object.keys(estimator.constants),
                ].join(", ")}
              </small>
            </label>
          )}
          <ConditionEditor
            value={r.when}
            onChange={(when) => {
              const next = { ...r };
              delete next.when;
              if (when) next.when = when;
              update(r.id, next);
            }}
            fields={fields}
            locale={locale}
          />
        </section>
      ))}
      <label>
        {t("addRule")}
        <select
          value=""
          onChange={(e) => {
            if (e.target.value) newRule(e.target.value as PricingRule["type"]);
          }}
        >
          <option value="">+ {t("addRule")}</option>
          {Object.entries(names).map(([type, label]) => (
            <option
              key={type}
              value={type}
              disabled={
                (["per_unit", "tiered"].includes(type) && !numeric.length) ||
                (type === "date_weekday" && !dates.length)
              }
            >
              {label}
            </option>
          ))}
        </select>
      </label>
      <section className="rule-card">
        <h3>{t("priceRange")}</h3>
        {(["minimumMinor", "maximumMinor"] as const).map((key, i) => (
          <div className="optional-money" key={key}>
            <label className="check">
              <input
                type="checkbox"
                checked={estimator.output[key] !== undefined}
                onChange={(e) => {
                  const output = { ...estimator.output };
                  if (e.target.checked) output[key] = 0;
                  else delete output[key];
                  onChange({ ...estimator, output });
                }}
              />
              {t(i === 0 ? "min" : "max")}
            </label>
            {estimator.output[key] !== undefined && (
              <MoneyInput
                value={estimator.output[key]!}
                digits={digits}
                currency={estimator.currency.code}
                label={t("amount")}
                onChange={(value) =>
                  onChange({
                    ...estimator,
                    output: { ...estimator.output, [key]: value },
                  })
                }
              />
            )}
          </div>
        ))}
        <label className="check">
          <input
            type="checkbox"
            checked={!!estimator.output.range}
            onChange={(e) => {
              const output = { ...estimator.output };
              if (e.target.checked)
                output.range = { belowPercent: "5", abovePercent: "5" };
              else delete output.range;
              onChange({ ...estimator, output });
            }}
          />
          {t("priceRange")}
        </label>
        {estimator.output.range && (
          <div className="form-grid">
            {(["belowPercent", "abovePercent"] as const).map((key, i) => (
              <label key={key}>
                {t(i === 0 ? "below" : "above")}
                <input
                  type="number"
                  min={0}
                  max={i === 0 ? 100 : undefined}
                  step="any"
                  value={estimator.output.range![key]}
                  onChange={(e) =>
                    onChange({
                      ...estimator,
                      output: {
                        ...estimator.output,
                        range: {
                          ...estimator.output.range!,
                          [key]: e.target.value,
                        },
                      },
                    })
                  }
                />
              </label>
            ))}
          </div>
        )}
      </section>
    </section>
  );
}
