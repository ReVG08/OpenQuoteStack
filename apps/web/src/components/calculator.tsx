"use client";
import { DocumentLanguage } from "./document-language";
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  calculateEstimate,
  validateAnswers,
  evaluateCondition,
  AnswerValidationError,
  type EstimateResult,
} from "@openquotestack/engine";
import {
  isNumericField,
  type Answers,
  type Field,
  type Estimator,
  type Answer,
} from "@openquotestack/schema";
import { Button } from "@openquotestack/ui";
import { copy, localized, reference } from "@/lib/product-i18n";
import type { Locale } from "@/lib/i18n";
import {
  beginQuote,
  quoteProgress,
  submitQuote,
  captureContact,
} from "@/app/product-actions";
import { saveEstimate } from "@/app/actions";
import { EstimateResultView } from "./estimate-result";
function initialAnswers(e: Estimator): Answers {
  return Object.fromEntries(
    e.steps
      .flatMap((s) => s.fields)
      .filter(
        (f) =>
          f.defaultValue !== undefined ||
          f.type === "checkbox" ||
          f.type === "slider",
      )
      .map((f) => [
        f.id,
        f.defaultValue ??
          (f.type === "slider" ? (f.validation?.min ?? 0) : false),
      ]),
  );
}
export function Calculator({
  estimator,
  locale,
  publicQuote,
  persist,
}: {
  estimator: Estimator;
  locale: Locale;
  publicQuote?: { slug: string; id: string; revisionId: string };
  persist?: { organizationId: string; estimatorId: string };
}) {
  const t = copy(locale),
    [answers, setAnswers] = useState<Answers>(() => initialAnswers(estimator)),
    [step, setStep] = useState(0),
    [result, setResult] = useState<EstimateResult>(),
    [errors, setErrors] = useState<Record<string, string>>({}),
    [error, setError] = useState(""),
    [pending, setPending] = useState(false),
    [token, setToken] = useState(""),
    [quoteId, setQuoteId] = useState(""),
    [contactStage, setContactStage] = useState(false),
    [contactSent, setContactSent] = useState(false),
    [sessionError, setSessionError] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null),
    started = useRef(false),
    trackedSteps = useRef(new Set<number>()),
    sessionRequest = useRef<Promise<void> | null>(null);
  const begin = useCallback(() => {
    if (!publicQuote) return Promise.resolve();
    if (!sessionRequest.current)
      sessionRequest.current = beginQuote(
        publicQuote.slug,
        publicQuote.id,
        publicQuote.revisionId,
      )
        .then((r) => {
          if (r.id) {
            setToken(r.id);
            setSessionError(false);
          } else {
            setSessionError(true);
            sessionRequest.current = null;
          }
        })
        .catch(() => {
          setSessionError(true);
          sessionRequest.current = null;
        });
    return sessionRequest.current;
  }, [publicQuote]);
  useEffect(() => {
    if (publicQuote && !started.current) {
      started.current = true;
      void begin();
    }
  }, [publicQuote, begin]); // A session belongs to this mounted revision, not to subsequent draft edits.
  const effective: Answers = {};
  const visible = new Set<string>();
  for (const field of estimator.steps.flatMap((s) => s.fields)) {
    if (field.visibleWhen && !evaluateCondition(field.visibleWhen, effective))
      continue;
    visible.add(field.id);
    const value =
      field.type === "hidden"
        ? field.defaultValue
        : (answers[field.id] ?? field.defaultValue);
    if (value !== undefined && value !== "") effective[field.id] = value;
  }
  const current = estimator.steps[step]!;
  const answer = (field: Field, value: Answer) => {
    setAnswers((a) => ({ ...a, [field.id]: value }));
    setErrors((e) => ({ ...e, [field.id]: "" }));
    if (publicQuote && token && !trackedSteps.current.has(step)) {
      trackedSteps.current.add(step);
      void quoteProgress(token, step);
    }
  };
  const focusHeading = () =>
    requestAnimationFrame(() => heading.current?.focus());
  async function finish(contact?: unknown) {
    setPending(true);
    setError("");
    try {
      let calculated: EstimateResult;
      if (publicQuote) {
        if (!token) throw new Error();
        const saved = await submitQuote(token, answers, contact);
        if (!saved.result) throw new Error();
        calculated = saved.result;
        setQuoteId(saved.id ?? "");
        if (contact) setContactSent(true);
      } else if (persist) {
        const saved = await saveEstimate(
          persist.organizationId,
          persist.estimatorId,
          answers,
        );
        if (!saved.result) throw new Error();
        calculated = saved.result;
        setQuoteId(saved.estimateId ?? "");
      } else calculated = calculateEstimate(estimator, answers);
      setResult(calculated);
      setContactStage(false);
      focusHeading();
    } catch (e) {
      if (e instanceof AnswerValidationError)
        setErrors(
          Object.fromEntries(e.issues.map((x) => [x.field, t("invalidError")])),
        );
      else setError(t("failure"));
    } finally {
      setPending(false);
    }
  }
  function goNext() {
    const issues: Record<string, string> = {};
    try {
      validateAnswers(estimator, answers);
    } catch (e) {
      if (e instanceof AnswerValidationError) {
        for (const issue of e.issues) {
          if (current.fields.some((f) => f.id === issue.field))
            issues[issue.field] = t(
              issue.message === "Required answer"
                ? "requiredError"
                : "invalidError",
            );
        }
      } else {
        setError(t("failure"));
        return;
      }
    }
    setError("");
    setErrors(issues);
    if (Object.keys(issues).length) {
      document.getElementById(`answer-${Object.keys(issues)[0]}`)?.focus();
      return;
    }
    if (step < estimator.steps.length - 1) {
      setStep((s) => s + 1);
      if (token) void quoteProgress(token, step + 1);
      focusHeading();
    } else if (estimator.leadCapture.mode === "before") {
      setContactStage(true);
      focusHeading();
    } else void finish();
  }
  function renderField(f: Field) {
    const name = localized(estimator, locale, `field:${f.id}`, f.label),
      help = localized(estimator, locale, `help:${f.id}`, f.help ?? ""),
      value = answers[f.id] ?? f.defaultValue;
    if (f.type === "hidden") return null;
    if (f.type === "divider") return <hr key={f.id} />;
    if (f.type === "info")
      return (
        <div className="information" key={f.id}>
          <h3>{name}</h3>
          <p>{help}</p>
        </div>
      );
    const control = {
      id: `answer-${f.id}`,
      "aria-invalid": !!errors[f.id],
      "aria-describedby":
        [help ? `help-${f.id}` : "", errors[f.id] ? `error-${f.id}` : ""]
          .filter(Boolean)
          .join(" ") || undefined,
      required: f.required,
    };
    const choiceLabel = (id: string, label: string) =>
      localized(estimator, locale, `choice:${f.id}.${id}`, label);
    return (
      <div className={`question question-${f.type}`} key={f.id}>
        {["radio", "image_choice", "multiselect", "boolean"].includes(
          f.type,
        ) ? (
          <fieldset id={`answer-${f.id}`} tabIndex={-1}>
            <legend>
              {name}
              {f.required && <span aria-hidden="true"> *</span>}
            </legend>
            <div
              className={`choice-grid ${f.type === "image_choice" ? "image-grid" : ""}`}
            >
              {(f.type === "boolean"
                ? [
                    { id: "true", label: t("yes") },
                    { id: "false", label: t("no") },
                  ]
                : (f.choices ?? [])
              ).map((choice) => (
                <label
                  className={`choice ${value === choice.id || (Array.isArray(value) && value.includes(choice.id)) || (f.type === "boolean" && value === (choice.id === "true")) ? "selected" : ""}`}
                  key={choice.id}
                >
                  <input
                    {...control}
                    id={`answer-${f.id}-${choice.id}`}
                    name={f.id}
                    type={f.type === "multiselect" ? "checkbox" : "radio"}
                    required={f.type === "multiselect" ? false : f.required}
                    checked={
                      f.type === "multiselect"
                        ? Array.isArray(value) && value.includes(choice.id)
                        : f.type === "boolean"
                          ? value === (choice.id === "true")
                          : value === choice.id
                    }
                    onChange={() =>
                      answer(
                        f,
                        f.type === "boolean"
                          ? choice.id === "true"
                          : f.type === "multiselect"
                            ? Array.isArray(value) && value.includes(choice.id)
                              ? value.filter((x) => x !== choice.id)
                              : [
                                  ...(Array.isArray(value) ? value : []),
                                  choice.id,
                                ]
                            : choice.id,
                      )
                    }
                  />
                  {"imageUrl" in choice && choice.imageUrl && (
                    <Image
                      unoptimized
                      src={choice.imageUrl as string}
                      alt=""
                      width={200}
                      height={120}
                    />
                  )}
                  <span>{choiceLabel(choice.id, choice.label)}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ) : f.type === "checkbox" ? (
          <label className="check">
            <input
              {...control}
              type="checkbox"
              checked={value === true}
              onChange={(e) => answer(f, e.target.checked)}
            />
            <span>{name}</span>
          </label>
        ) : (
          <>
            <label htmlFor={control.id}>
              {name}
              {f.required && <span aria-hidden="true"> *</span>}
            </label>
            {f.type === "select" ? (
              <select
                {...control}
                value={typeof value === "string" ? value : ""}
                onChange={(e) => answer(f, e.target.value)}
              >
                <option value="">
                  {locale === "pt-BR"
                    ? "Selecione uma opção"
                    : "Choose an option"}
                </option>
                {f.choices?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {choiceLabel(c.id, c.label)}
                  </option>
                ))}
              </select>
            ) : f.type === "textarea" ? (
              <textarea
                {...control}
                value={typeof value === "string" ? value : ""}
                maxLength={f.validation?.maxLength ?? 2000}
                placeholder={localized(
                  estimator,
                  locale,
                  `placeholder:${f.id}`,
                  f.placeholder ?? "",
                )}
                onChange={(e) => answer(f, e.target.value)}
              />
            ) : (
              <>
                <input
                  {...control}
                  type={
                    f.type === "slider"
                      ? "range"
                      : isNumericField(f.type)
                        ? "number"
                        : ["email", "date", "time"].includes(f.type)
                          ? f.type
                          : f.type === "phone"
                            ? "tel"
                            : "text"
                  }
                  inputMode={
                    isNumericField(f.type)
                      ? "decimal"
                      : f.type === "email"
                        ? "email"
                        : f.type === "phone"
                          ? "tel"
                          : undefined
                  }
                  autoComplete={
                    f.type === "email"
                      ? "email"
                      : f.type === "address"
                        ? "street-address"
                        : f.type === "phone"
                          ? "tel"
                          : undefined
                  }
                  min={
                    f.validation?.min ??
                    (isNumericField(f.type) ? 0 : undefined)
                  }
                  max={f.validation?.max}
                  maxLength={f.validation?.maxLength ?? 2000}
                  step={f.validation?.integer ? 1 : "any"}
                  value={
                    typeof value === "string" || typeof value === "number"
                      ? value
                      : ""
                  }
                  placeholder={localized(
                    estimator,
                    locale,
                    `placeholder:${f.id}`,
                    f.placeholder ?? "",
                  )}
                  onChange={(e) =>
                    answer(
                      f,
                      isNumericField(f.type) && e.target.value !== ""
                        ? Number(e.target.value)
                        : e.target.value,
                    )
                  }
                />
                {f.type === "slider" && (
                  <output htmlFor={control.id}>
                    {value ?? f.validation?.min}
                  </output>
                )}
              </>
            )}
          </>
        )}
        {help && (
          <p className="field-help" id={`help-${f.id}`}>
            {help}
          </p>
        )}
        {errors[f.id] && (
          <p className="field-error" id={`error-${f.id}`} role="alert">
            {errors[f.id]}
          </p>
        )}
      </div>
    );
  }
  async function contactSubmit(form: FormData) {
    const details = Object.fromEntries(
      estimator.leadCapture.fields.map((k) => [k, String(form.get(k) ?? "")]),
    );
    if (!result) {
      await finish(details);
      return;
    }
    setPending(true);
    setError("");
    try {
      if (publicQuote) {
        const r = await captureContact(token, details);
        if (!r.ok) throw new Error();
      }
      setContactSent(true);
      focusHeading();
    } catch {
      setError(t("failure"));
    } finally {
      setPending(false);
    }
  }
  const contactForm = (
    <section className="contact-card">
      <h2 ref={heading} tabIndex={-1}>
        {t("contactTitle")}
      </h2>
      <p>{t("contactHelp")}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void contactSubmit(new FormData(e.currentTarget));
        }}
      >
        {estimator.leadCapture.fields.map((k) => (
          <label key={k}>
            {t(k)}
            {!["name", "email"].includes(k) && (
              <small>{t("optionalLabel")}</small>
            )}
            {k === "notes" ? (
              <textarea name={k} maxLength={2000} />
            ) : (
              <input
                name={k}
                type={k === "email" ? "email" : k === "phone" ? "tel" : "text"}
                autoComplete={
                  k === "name"
                    ? "name"
                    : k === "email"
                      ? "email"
                      : k === "phone"
                        ? "tel"
                        : k === "address"
                          ? "street-address"
                          : undefined
                }
                required={["name", "email"].includes(k)}
                maxLength={k === "address" ? 500 : 200}
              />
            )}
          </label>
        ))}
        {estimator.leadCapture.consentText && (
          <p className="fineprint">
            {localized(
              estimator,
              locale,
              "consent",
              estimator.leadCapture.consentText,
            )}
          </p>
        )}
        <Button disabled={pending}>
          {pending ? t("working") : result ? t("request") : t("getEstimate")}
        </Button>
      </form>
    </section>
  );
  return (
    <div className="runtime" lang={locale}>
      <DocumentLanguage locale={locale} />
      {sessionError && (
        <div role="alert">
          <p>{t("failure")}</p>
          <Button className="secondary" onClick={() => void begin()}>
            {t("continue")}
          </Button>
        </div>
      )}
      {error && <p role="alert">{error}</p>}
      {result ? (
        <>
          <h1 ref={heading} tabIndex={-1} className="sr-only">
            {t("yourEstimate")}
          </h1>
          <EstimateResultView
            result={result}
            estimator={estimator}
            locale={locale}
          />
          {quoteId && <p className="fineprint mono">{reference(quoteId)}</p>}
          {contactSent ? (
            <section className="success-state" role="status">
              <span className="success-icon" aria-hidden="true">
                ✓
              </span>
              <h2 ref={heading} tabIndex={-1}>
                {t("requestSent")}
              </h2>
              <p>{t("requestSentHelp")}</p>
            </section>
          ) : estimator.leadCapture.mode !== "disabled" ? (
            contactForm
          ) : null}
          <Button
            className="secondary"
            onClick={() => {
              setResult(undefined);
              setAnswers(initialAnswers(estimator));
              setStep(0);
              setContactSent(false);
              setQuoteId("");
              setErrors({});
              sessionRequest.current = null;
              trackedSteps.current.clear();
              setToken("");
              void begin();
              focusHeading();
            }}
          >
            {t("startAgain")}
          </Button>
        </>
      ) : contactStage ? (
        <>
          {contactForm}
          <Button className="secondary" onClick={() => setContactStage(false)}>
            {t("back")}
          </Button>
        </>
      ) : (
        <>
          <div className="runtime-progress">
            <span>
              {t("step")} {step + 1} / {estimator.steps.length}
            </span>
            <span>{Math.round((step / estimator.steps.length) * 100)}%</span>
          </div>
          <progress
            max={estimator.steps.length}
            value={step}
            aria-label={t("step")}
          />
          <h1 ref={heading} tabIndex={-1}>
            {localized(estimator, locale, `step:${current.id}`, current.title)}
          </h1>
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              goNext();
            }}
          >
            <div className="questions">
              {current.fields.filter((f) => visible.has(f.id)).map(renderField)}
            </div>
            <div className="runtime-controls">
              {step > 0 && (
                <Button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setStep((s) => s - 1);
                    focusHeading();
                  }}
                >
                  {t("back")}
                </Button>
              )}
              <Button disabled={pending || (!!publicQuote && !token)}>
                {pending
                  ? t("working")
                  : step === estimator.steps.length - 1
                    ? t("getEstimate")
                    : t("continue")}{" "}
                <span aria-hidden="true">→</span>
              </Button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}
