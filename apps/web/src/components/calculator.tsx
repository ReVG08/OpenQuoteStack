"use client";
import { useState } from "react";
import { Button, Card } from "@openquotestack/ui";
import {
  calculateEstimate,
  evaluateCondition,
  AnswerValidationError,
  type EstimateResult,
} from "@openquotestack/engine";
import type { Estimator, Answers, Answer } from "@openquotestack/schema";
import { messages, formatMoney, type Locale } from "@/lib/i18n";
import { saveEstimate } from "@/app/actions";
export const movingAnswers: Answers = {
  origin: "Boston",
  destination: "Cambridge",
  bedrooms: 3,
  distance: 22,
  elevator: true,
  floors: 0,
  boxes: 0,
  piano: true,
  packing: false,
  moving_date: "2026-10-10",
};
export function Calculator({
  estimator,
  locale,
  persist,
}: {
  estimator: Estimator;
  locale: Locale;
  persist?: { organizationId: string; estimatorId: string };
}) {
  const t = messages(locale),
    fields = estimator.steps.flatMap((s) => s.fields);
  const [answers, setAnswers] = useState<Answers>(() =>
    Object.fromEntries(
      fields
        .filter(
          (f) =>
            f.type === "boolean" ||
            (Object.hasOwn(movingAnswers, f.id) &&
              estimator.id === "moving-company"),
        )
        .map((f) => [
          f.id,
          estimator.id === "moving-company" &&
          Object.hasOwn(movingAnswers, f.id)
            ? movingAnswers[f.id]!
            : false,
        ]),
    ),
  );
  const [result, setResult] = useState<EstimateResult | null>(null),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false),
    [saved, setSaved] = useState<string | null>(null);
  const visibleAnswers: Answers = {},
    visible = new Set<string>();
  for (const field of fields) {
    if (
      !field.visibleWhen ||
      evaluateCondition(field.visibleWhen, visibleAnswers)
    ) {
      visible.add(field.id);
      if (answers[field.id] !== undefined)
        visibleAnswers[field.id] = answers[field.id]!;
    }
  }
  const update = (id: string, value: Answer | undefined) => {
    setAnswers((old) => {
      const next = { ...old };
      if (value === undefined) delete next[id];
      else next[id] = value;
      return next;
    });
    setResult(null);
    setSaved(null);
    setError("");
  };
  const fieldLabel = (id: string, fallback: string) =>
    estimator.id === "moving-company" && Object.hasOwn(t, id)
      ? t[id as keyof typeof t]
      : fallback;
  const money = (value: number) =>
    formatMoney(
      value,
      result?.currency ?? estimator.currency.code,
      result?.minorUnits ?? estimator.currency.minorUnits,
      locale,
    );
  const ruleLabel = (id: string, fallback: string) =>
    locale === "pt-BR" && estimator.id === "moving-company"
      ? ((
          {
            base: "Serviço básico",
            bedrooms: "Quartos",
            distance: "Distância",
            stairs: "Escadas",
            boxes: "Caixas",
            piano: "Transporte de piano",
            packing: "Embalagem",
            weekend: "Adicional de fim de semana",
            $minimum: "Preço mínimo",
            $maximum: "Preço máximo",
          } as Record<string, string>
        )[id] ?? fallback)
      : fallback;
  return (
    <div className="grid-two">
      <Card>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (pending) return;
            setPending(true);
            setError("");
            setSaved(null);
            setResult(null);
            try {
              const calculated = calculateEstimate(estimator, answers);
              if (persist) {
                const state = await saveEstimate(
                  persist.organizationId,
                  persist.estimatorId,
                  answers,
                );
                if (state.error) {
                  setError(t.failure);
                  return;
                }
                setSaved(state.estimateId ?? null);
                setResult(state.result ?? null);
              } else setResult(calculated);
            } catch (err) {
              setError(
                err instanceof AnswerValidationError
                  ? `${t.error} ${err.issues.map((i) => fieldLabel(i.field, i.field)).join(", ")}`
                  : t.error,
              );
            } finally {
              setPending(false);
            }
          }}
        >
          {estimator.steps.map((step) => (
            <section key={step.id}>
              <h2>
                {estimator.id === "moving-company" ? t.inputs : step.title}
              </h2>
              <div className="form-grid">
                {step.fields
                  .filter((f) => visible.has(f.id))
                  .map((f) => {
                    const label = fieldLabel(f.id, f.label);
                    if (f.type === "boolean")
                      return (
                        <label className="check" key={f.id}>
                          <input
                            type="checkbox"
                            checked={answers[f.id] === true}
                            onChange={(e) => update(f.id, e.target.checked)}
                          />
                          {label}
                        </label>
                      );
                    return (
                      <label key={f.id}>
                        {label}
                        {f.type === "select" || f.type === "multiselect" ? (
                          <select
                            multiple={f.type === "multiselect"}
                            value={
                              (answers[f.id] as string | string[]) ??
                              (f.type === "multiselect" ? [] : "")
                            }
                            required={f.required}
                            onChange={(e) =>
                              update(
                                f.id,
                                f.type === "multiselect"
                                  ? [...e.target.selectedOptions].map(
                                      (o) => o.value,
                                    )
                                  : e.target.value,
                              )
                            }
                          >
                            {f.type === "select" && <option value="">—</option>}
                            {f.choices?.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={
                              f.type === "number"
                                ? "number"
                                : f.type === "date"
                                  ? "date"
                                  : "text"
                            }
                            value={(answers[f.id] as string | number) ?? ""}
                            required={f.required}
                            min={
                              f.type === "number"
                                ? (f.validation?.min ?? 0)
                                : undefined
                            }
                            max={
                              f.type === "number"
                                ? f.validation?.max
                                : undefined
                            }
                            step={f.validation?.integer ? 1 : "any"}
                            maxLength={f.validation?.maxLength}
                            onChange={(e) =>
                              update(
                                f.id,
                                f.type === "number"
                                  ? e.target.value === ""
                                    ? undefined
                                    : Number(e.target.value)
                                  : e.target.value,
                              )
                            }
                          />
                        )}
                        {f.help && <small>{f.help}</small>}
                      </label>
                    );
                  })}
              </div>
            </section>
          ))}
          {error && <p role="alert">{error}</p>}
          <Button disabled={pending}>
            {pending ? t.working : persist ? t.saveEstimate : t.calculate}
          </Button>
        </form>
      </Card>
      <Card>
        <p className="eyebrow">OpenQuoteStack Engine</p>
        <h2>{t.estimate}</h2>
        {result ? (
          <div aria-live="polite">
            <table className="breakdown">
              <caption className="sr-only">{t.estimate}</caption>
              <tbody>
                {[...result.lineItems, ...result.adjustments].map((item) => (
                  <tr key={item.ruleId}>
                    <td>
                      {ruleLabel(item.ruleId, item.label)}
                      {typeof item.input === "number" && (
                        <small>
                          {" "}
                          · {new Intl.NumberFormat(locale).format(item.input)}
                        </small>
                      )}
                    </td>
                    <td>{money(item.amountMinor)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="total">{money(result.totalMinor)}</p>
            {result.range && (
              <p>
                {t.range}: {money(result.range.minMinor)} –{" "}
                {money(result.range.maxMinor)}
              </p>
            )}
            {saved && (
              <p role="status">
                {t.saved} · <code>{saved}</code>
              </p>
            )}
            {result.cta && (
              <a className="button" href={result.cta.url}>
                {result.cta.label}
              </a>
            )}
          </div>
        ) : (
          <p>—</p>
        )}
        {estimator.id === "moving-company" ? (
          <p>{t.disclaimer}</p>
        ) : (
          (result?.messages ?? [estimator.output.message])
            .filter(Boolean)
            .map((message, index) => <p key={index}>{message}</p>)
        )}
      </Card>
    </div>
  );
}
