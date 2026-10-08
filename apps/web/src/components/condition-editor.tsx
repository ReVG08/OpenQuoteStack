"use client";
import type { Condition, Field } from "@openquotestack/schema";
import { isNumericField } from "@openquotestack/schema";
import type { Locale } from "@/lib/i18n";
import { copy } from "@/lib/product-i18n";
const operators = [
  ["equals", "equals", "é igual a"],
  ["not_equals", "does not equal", "é diferente de"],
  ["gt", "greater than", "maior que"],
  ["lt", "less than", "menor que"],
  ["gte", "at least", "pelo menos"],
  ["lte", "at most", "no máximo"],
  ["contains", "contains", "contém"],
  ["not_contains", "does not contain", "não contém"],
  ["selected", "selected", "selecionado"],
  ["not_selected", "not selected", "não selecionado"],
  ["empty", "is empty", "está vazio"],
  ["not_empty", "is not empty", "não está vazio"],
] as const;
const leaf = (f: Field): Condition => ({
  field: f.id,
  op: "equals",
  value: ["boolean", "checkbox"].includes(f.type)
    ? true
    : isNumericField(f.type)
      ? 0
      : (f.choices?.[0]?.id ?? ""),
});
export function ConditionEditor({
  value,
  onChange,
  fields,
  locale,
  label,
  depth = 0,
}: {
  value?: Condition;
  onChange: (c: Condition | undefined) => void;
  fields: Field[];
  locale: Locale;
  label?: string;
  depth?: number;
}) {
  const t = copy(locale);
  if (!fields.length)
    return (
      <p className="field-help">
        {locale === "pt-BR"
          ? "Adicione uma pergunta anterior para usar condições."
          : "Add a preceding question to use conditions."}
      </p>
    );
  const render = () => {
    if (!value) return null;
    if ("all" in value || "any" in value) {
      const group = "all" in value ? "all" : "any",
        items = "all" in value ? value.all : value.any;
      return (
        <div className="condition-group">
          <label>
            {t("when")}
            <select
              value={group}
              onChange={(e) =>
                onChange(
                  e.target.value === "all" ? { all: items } : { any: items },
                )
              }
            >
              <option value="all">{t("all")}</option>
              <option value="any">{t("any")}</option>
            </select>
          </label>
          {items.map((c, i) => (
            <div className="condition-row" key={i}>
              <ConditionEditor
                value={c}
                onChange={(next) => {
                  const list = items.flatMap((x, j) =>
                    j === i ? (next ? [next] : []) : [x],
                  );
                  onChange(
                    list.length
                      ? group === "all"
                        ? { all: list }
                        : { any: list }
                      : undefined,
                  );
                }}
                fields={fields}
                locale={locale}
                depth={depth + 1}
              />
              <button
                type="button"
                className="icon-button"
                aria-label={t("remove")}
                onClick={() => {
                  const list = items.filter((_, j) => j !== i);
                  onChange(
                    list.length
                      ? group === "all"
                        ? { all: list }
                        : { any: list }
                      : undefined,
                  );
                }}
              >
                ×
              </button>
            </div>
          ))}
          <div className="actions">
            <button
              type="button"
              className="text-button"
              onClick={() =>
                onChange(
                  group === "all"
                    ? { all: [...items, leaf(fields[0]!)] }
                    : { any: [...items, leaf(fields[0]!)] },
                )
              }
            >
              + {t("addCondition")}
            </button>
            {depth < 4 && (
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  onChange(
                    group === "all"
                      ? { all: [...items, { any: [leaf(fields[0]!)] }] }
                      : { any: [...items, { all: [leaf(fields[0]!)] }] },
                  )
                }
              >
                {locale === "pt-BR" ? "+ Grupo" : "+ Group"}
              </button>
            )}
          </div>
        </div>
      );
    }
    const f = fields.find((x) => x.id === value.field) ?? fields[0]!;
    return (
      <div className="condition-leaf">
        <label>
          <span className="sr-only">{t("fields")}</span>
          <select
            value={value.field}
            onChange={(e) =>
              onChange(leaf(fields.find((x) => x.id === e.target.value)!))
            }
          >
            {fields.map((f) => (
              <option key={f.id} value={f.id}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">{t("when")}</span>
          <select
            value={value.op}
            onChange={(e) => {
              const op = e.target.value as typeof value.op;
              onChange({
                field: value.field,
                op,
                ...(["empty", "not_empty"].includes(op)
                  ? {}
                  : {
                      value: ["gt", "lt", "gte", "lte"].includes(op)
                        ? Number(value.value) || 0
                        : (value.value ?? ""),
                    }),
              });
            }}
          >
            {operators.map(([id, en, pt]) => (
              <option key={id} value={id}>
                {locale === "pt-BR" ? pt : en}
              </option>
            ))}
          </select>
        </label>
        {!["empty", "not_empty"].includes(value.op) && (
          <label>
            <span className="sr-only">{t("value")}</span>
            {["boolean", "checkbox"].includes(f.type) ? (
              <select
                value={String(value.value)}
                onChange={(e) =>
                  onChange({ ...value, value: e.target.value === "true" })
                }
              >
                <option value="true">{t("yes")}</option>
                <option value="false">{t("no")}</option>
              </select>
            ) : f.choices?.length ? (
              <select
                value={String(value.value ?? "")}
                onChange={(e) => onChange({ ...value, value: e.target.value })}
              >
                {f.choices.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type={
                  isNumericField(f.type) ||
                  ["gt", "lt", "gte", "lte"].includes(value.op)
                    ? "number"
                    : "text"
                }
                value={String(value.value ?? "")}
                onChange={(e) =>
                  onChange({
                    ...value,
                    value:
                      isNumericField(f.type) ||
                      ["gt", "lt", "gte", "lte"].includes(value.op)
                        ? Number(e.target.value)
                        : e.target.value,
                  })
                }
              />
            )}
          </label>
        )}
      </div>
    );
  };
  return (
    <div className="condition-editor">
      {depth === 0 && (
        <label>
          {label ?? t("when")}
          <select
            value={value ? "conditional" : "always"}
            onChange={(e) =>
              onChange(
                e.target.value === "always"
                  ? undefined
                  : { all: [leaf(fields[0]!)] },
              )
            }
          >
            <option value="always">{t("always")}</option>
            <option value="conditional">{t("conditional")}</option>
          </select>
        </label>
      )}
      {render()}
      {depth === 0 && value && !("all" in value) && !("any" in value) && (
        <button
          type="button"
          className="text-button"
          onClick={() => onChange({ all: [value, leaf(fields[0]!)] })}
        >
          + {t("addCondition")}
        </button>
      )}
    </div>
  );
}
