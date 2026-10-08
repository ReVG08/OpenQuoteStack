"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  parseDocument,
  isNumericField,
  isChoiceField,
  type EstimatorDocument,
  type Field,
  type Estimator,
} from "@openquotestack/schema";
import { Button } from "@openquotestack/ui";
import {
  saveBuilder,
  publishBuilder,
  restoreRevision,
} from "@/app/product-actions";
import { copy, dateLabel } from "@/lib/product-i18n";
import type { Locale } from "@/lib/i18n";
import { brandStyle } from "@/lib/branding";
import type { Branding } from "@openquotestack/core";
import { Calculator } from "./calculator";
import { PricingEditor } from "./pricing-editor";
import { ConditionEditor } from "./condition-editor";
const typeNames: Record<Field["type"], [string, string]> = {
  text: ["Short text", "Texto curto"],
  textarea: ["Long text", "Texto longo"],
  number: ["Number", "Número"],
  currency: ["Currency", "Moeda"],
  email: ["Email", "E-mail"],
  phone: ["Phone", "Telefone"],
  address: ["Address", "Endereço"],
  date: ["Date", "Data"],
  time: ["Time", "Hora"],
  select: ["Dropdown", "Lista suspensa"],
  radio: ["Radio choices", "Escolha única"],
  checkbox: ["Checkbox", "Caixa de seleção"],
  multiselect: ["Multiple choices", "Múltipla escolha"],
  boolean: ["Yes / no", "Sim / não"],
  quantity: ["Quantity", "Quantidade"],
  slider: ["Slider", "Controle deslizante"],
  image_choice: ["Image choice", "Escolha por imagem"],
  info: ["Information", "Informação"],
  divider: ["Divider", "Divisor"],
  hidden: ["Hidden value", "Valor oculto"],
};
function SortableRow({
  id,
  label,
  selected,
  onSelect,
  onDuplicate,
  onRemove,
  canRemove,
  disabled,
  locale,
}: {
  id: string;
  label: string;
  selected: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onRemove: () => void;
  canRemove: boolean;
  disabled: boolean;
  locale: Locale;
}) {
  const {
      attributes,
      listeners,
      setNodeRef,
      transform,
      transition,
      isDragging,
    } = useSortable({ id }),
    t = copy(locale);
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      className={`field-row ${selected ? "selected" : ""}`}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="drag-handle"
        disabled={disabled}
        aria-label={`${locale === "pt-BR" ? "Reordenar" : "Reorder"} ${label}`}
      >
        ⠿
      </button>
      <button type="button" className="field-select" onClick={onSelect}>
        {label}
      </button>
      <button
        type="button"
        className="icon-button"
        onClick={onDuplicate}
        aria-label={`${t("duplicate")} ${label}`}
      >
        ⧉
      </button>
      <button
        type="button"
        className="icon-button"
        disabled={!canRemove}
        onClick={onRemove}
        aria-label={`${t("remove")} ${label}`}
      >
        ×
      </button>
    </div>
  );
}
function clearTranslation(
  e: Estimator,
  key: string,
  locale: Locale,
): Estimator {
  const translations = structuredClone(e.translations);
  if (translations[locale]) delete translations[locale]![key];
  return { ...e, translations };
}
export function EstimatorBuilder({
  initial,
  orgId,
  estimatorId,
  version: initialVersion,
  locale,
  brand,
  slug,
  publishedNumber,
  revisions,
  canEdit,
  canPublish,
  archived,
}: {
  initial: EstimatorDocument;
  orgId: string;
  estimatorId: string;
  version: number;
  locale: Locale;
  brand: Branding;
  slug: string;
  publishedNumber?: number;
  revisions: {
    id: string;
    number: number;
    createdAt: string;
    active: boolean;
  }[];
  canEdit: boolean;
  canPublish: boolean;
  archived: boolean;
}) {
  const [document, setDocument] = useState(initial),
    [version, setVersion] = useState(initialVersion),
    [dirty, setDirty] = useState(false),
    [selected, setSelected] = useState(
      initial.estimator.steps[0]?.fields[0]?.id ?? "",
    ),
    [tab, setTab] = useState<
      "fields" | "pricing" | "result" | "revisions" | "preview"
    >("fields"),
    [device, setDevice] = useState<"desktop" | "mobile">("desktop"),
    [message, setMessage] = useState(""),
    [isError, setIsError] = useState(false),
    [pending, startTransition] = useTransition();
  const router = useRouter(),
    t = copy(locale),
    e = document.estimator,
    all = e.steps.flatMap((s) => s.fields),
    field = all.find((f) => f.id === selected),
    currentStep =
      e.steps.find((s) => s.fields.some((f) => f.id === selected)) ??
      e.steps[0]!;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const change = (next: Estimator) => {
    setDocument((d) => ({ ...d, estimator: next }));
    setDirty(true);
    setMessage("");
  };
  const changeField = (next: Field) =>
    change({
      ...e,
      steps: e.steps.map((s) => ({
        ...s,
        fields: s.fields.map((f) => (f.id === selected ? next : f)),
      })),
    });
  function renameKey(id: string) {
    if (!field || !id || id === field.id) return;
    if (all.some((f) => f.id === id)) return;
    const old = field.id;
    const remap = (v: unknown): unknown =>
      Array.isArray(v)
        ? v.map(remap)
        : v && typeof v === "object"
          ? Object.fromEntries(
              Object.entries(v).map(([k, x]) => [
                k,
                (k === "field" || k === "variable") && x === old
                  ? id
                  : remap(x),
              ]),
            )
          : v;
    const next = remap(e) as Estimator;
    next.steps = next.steps.map((s) => ({
      ...s,
      fields: s.fields.map((f) => (f.id === old ? { ...f, id } : f)),
    }));
    setSelected(id);
    change(next);
  }
  function newField(type: Field["type"], stepId: string) {
    const id = `field_${crypto.randomUUID().replaceAll("-", "")}`,
      f: Field = {
        id,
        label: typeNames[type][locale === "pt-BR" ? 1 : 0],
        type,
        required: false,
      };
    if (isChoiceField(type))
      f.choices = [
        {
          id: "option_1",
          label: locale === "pt-BR" ? "Opção 1" : "Option 1",
          ...(type === "image_choice" ? { imageUrl: "" } : {}),
        },
      ];
    if (type === "slider") {
      f.validation = { min: 0, max: 100 };
      f.defaultValue = 0;
    }
    if (type === "hidden") f.defaultValue = 0;
    change({
      ...e,
      steps: e.steps.map((s) =>
        s.id === stepId ? { ...s, fields: [...s.fields, f] } : s,
      ),
    });
    setSelected(id);
  }
  function drop(event: DragEndEvent) {
    if (!canEdit || archived) return;
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = e.steps.find((s) => s.fields.some((f) => f.id === active.id)),
      to = e.steps.find((s) => s.fields.some((f) => f.id === over.id));
    if (!from || !to) return;
    const moving = from.fields.find((f) => f.id === active.id)!;
    if (from.id === to.id)
      change({
        ...e,
        steps: e.steps.map((s) =>
          s.id === from.id
            ? {
                ...s,
                fields: arrayMove(
                  s.fields,
                  s.fields.indexOf(moving),
                  s.fields.findIndex((f) => f.id === over.id),
                ),
              }
            : s,
        ),
      });
    else if (from.fields.length > 1)
      change({
        ...e,
        steps: e.steps.map((s) =>
          s.id === from.id
            ? { ...s, fields: s.fields.filter((f) => f.id !== moving.id) }
            : s.id === to.id
              ? {
                  ...s,
                  fields: [
                    ...s.fields.slice(
                      0,
                      s.fields.findIndex((f) => f.id === over.id),
                    ),
                    moving,
                    ...s.fields.slice(
                      s.fields.findIndex((f) => f.id === over.id),
                    ),
                  ],
                }
              : s,
        ),
      });
  }
  const validate = () => {
    try {
      return parseDocument(document);
    } catch (err) {
      setIsError(true);
      if (err && typeof err === "object" && "issues" in err) {
        const issues = err.issues as {
          path: (string | number)[];
          message: string;
        }[];
        setMessage(
          `${t("invalidError")} ${issues
            .slice(0, 3)
            .map((issue) => {
              const path = issue.path;
              if (path[1] === "steps") {
                const step = e.steps[Number(path[2])];
                return path[3] === "fields"
                  ? (step?.fields[Number(path[4])]?.label ?? t("fields"))
                  : (step?.title ?? t("step"));
              }
              if (path[1] === "rules")
                return e.rules[Number(path[2])]?.label ?? t("pricing");
              return t("result");
            })
            .join(
              ", ",
            )}. ${locale === "pt-BR" ? "Confira os limites, as opções e as referências. Condições de exibição devem usar perguntas anteriores." : "Check limits, choices and references. Visibility conditions must use preceding questions."}`,
        );
      } else setMessage(t("invalidError"));
      return undefined;
    }
  };
  async function save(publish = false) {
    const valid = validate();
    if (!valid) return;
    setMessage("");
    let latest = version;
    if (dirty) {
      const r = await saveBuilder(orgId, estimatorId, valid, version);
      if (!r.ok) {
        setIsError(true);
        setMessage(t(r.error === "conflict" ? "versionConflict" : "failure"));
        return;
      }
      latest = r.version!;
      setVersion(latest);
      setDirty(false);
    }
    if (publish) {
      const r = await publishBuilder(orgId, estimatorId, latest);
      if (!r.ok) {
        setIsError(true);
        setMessage(t(r.error === "conflict" ? "versionConflict" : "failure"));
        return;
      }
    }
    setIsError(false);
    setMessage(t(publish ? "published" : "saved"));
    router.refresh();
  }
  const previewDocument =
    tab === "preview"
      ? (() => {
          try {
            return parseDocument(document);
          } catch {
            return undefined;
          }
        })()
      : undefined;
  return (
    <div className="builder" lang={locale}>
      <div className="builder-top">
        <div>
          <Link className="breadcrumb" href={`/app/${orgId}/estimators`}>
            {t("estimators")}
          </Link>
          <h1>{e.name}</h1>
          <p className="fineprint">
            {publishedNumber
              ? `${t("published")} · ${t("revision")} ${publishedNumber}`
              : t("unpublished")}{" "}
            <span className="dot">·</span>{" "}
            <span>{dirty ? t("unsaved") : t("draft")}</span>
          </p>
        </div>
        <div className="actions">
          <Button
            className="secondary"
            onClick={() => {
              setTab("preview");
            }}
          >
            {t("preview")}
          </Button>
          {canEdit && !archived && (
            <Button
              className="secondary"
              disabled={pending}
              onClick={() => startTransition(() => save())}
            >
              {pending ? t("saving") : t("save")}
            </Button>
          )}
          {canPublish && !archived && (
            <Button
              disabled={pending}
              onClick={() => startTransition(() => save(true))}
            >
              {t("publish")} <span aria-hidden="true">↗</span>
            </Button>
          )}
        </div>
      </div>
      <p className="draft-notice">
        {t("draftHelp")}
        {publishedNumber && (
          <>
            {" "}
            <Link href={`/q/${slug}/${estimatorId}`} target="_blank">
              {t("publicLink")} ↗
            </Link>
          </>
        )}
      </p>
      {message && (
        <p
          className={isError ? "field-error" : "success-message"}
          role={isError ? "alert" : "status"}
        >
          {message}
        </p>
      )}
      <div className="tabs" role="tablist" aria-label={t("edit")}>
        {(["fields", "pricing", "result", "revisions", "preview"] as const).map(
          (key) => (
            <button
              type="button"
              role="tab"
              aria-selected={tab === key}
              id={`builder-tab-${key}`}
              aria-controls="builder-panel"
              tabIndex={tab === key ? 0 : -1}
              onKeyDown={(event) => {
                const keys = [
                  "fields",
                  "pricing",
                  "result",
                  "revisions",
                  "preview",
                ] as const;
                const index = keys.indexOf(key);
                const next =
                  event.key === "ArrowRight"
                    ? (index + 1) % keys.length
                    : event.key === "ArrowLeft"
                      ? (index + keys.length - 1) % keys.length
                      : event.key === "Home"
                        ? 0
                        : event.key === "End"
                          ? keys.length - 1
                          : undefined;
                if (next !== undefined) {
                  event.preventDefault();
                  setTab(keys[next]!);
                  event.currentTarget.parentElement
                    ?.querySelector<HTMLButtonElement>(
                      `#builder-tab-${keys[next]}`,
                    )
                    ?.focus();
                }
              }}
              key={key}
              onClick={() => setTab(key)}
            >
              {t(key)}
            </button>
          ),
        )}
      </div>
      <div
        id="builder-panel"
        role="tabpanel"
        aria-labelledby={`builder-tab-${tab}`}
      >
        {tab === "fields" && (
          <div className="builder-columns">
            <aside className="builder-outline">
              <DndContext
                id="builder-fields"
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={drop}
                accessibility={{
                  screenReaderInstructions: {
                    draggable:
                      locale === "pt-BR"
                        ? "Pressione espaço para iniciar o movimento. Use as setas para reordenar. Pressione espaço para concluir ou Escape para cancelar."
                        : "Press space to start dragging. Use arrow keys to reorder. Press space to finish or Escape to cancel.",
                  },
                }}
              >
                <SortableContext
                  items={all.map((f) => f.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {e.steps.map((s, stepIndex) => (
                    <section key={s.id} className="outline-step">
                      <div className="step-heading">
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => setSelected(s.fields[0]?.id ?? "")}
                        >
                          {stepIndex + 1}. {s.title}
                        </button>
                        {canEdit && !archived && (
                          <div className="actions">
                            <button
                              type="button"
                              className="icon-button"
                              aria-label={`${t("moveUp")} ${s.title}`}
                              disabled={!stepIndex}
                              onClick={() =>
                                change({
                                  ...e,
                                  steps: arrayMove(
                                    e.steps,
                                    stepIndex,
                                    stepIndex - 1,
                                  ),
                                })
                              }
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              className="icon-button"
                              aria-label={`${t("moveDown")} ${s.title}`}
                              disabled={stepIndex === e.steps.length - 1}
                              onClick={() =>
                                change({
                                  ...e,
                                  steps: arrayMove(
                                    e.steps,
                                    stepIndex,
                                    stepIndex + 1,
                                  ),
                                })
                              }
                            >
                              ↓
                            </button>
                          </div>
                        )}
                      </div>
                      {s.fields.map((f) => (
                        <SortableRow
                          key={f.id}
                          id={f.id}
                          label={f.label}
                          selected={selected === f.id}
                          locale={locale}
                          disabled={!canEdit || archived}
                          canRemove={
                            canEdit && !archived && s.fields.length > 1
                          }
                          onSelect={() => setSelected(f.id)}
                          onDuplicate={() => {
                            if (!canEdit || archived) return;
                            const next = {
                              ...structuredClone(f),
                              id: `field_${crypto.randomUUID().replaceAll("-", "")}`,
                              label: `${f.label} (${locale === "pt-BR" ? "cópia" : "copy"})`,
                            };
                            change({
                              ...e,
                              steps: e.steps.map((step) =>
                                step.id === s.id
                                  ? { ...step, fields: [...step.fields, next] }
                                  : step,
                              ),
                            });
                            setSelected(next.id);
                          }}
                          onRemove={() => {
                            change({
                              ...e,
                              steps: e.steps.map((step) =>
                                step.id === s.id
                                  ? {
                                      ...step,
                                      fields: step.fields.filter(
                                        (x) => x.id !== f.id,
                                      ),
                                    }
                                  : step,
                              ),
                            });
                            if (selected === f.id)
                              setSelected(
                                s.fields.find((x) => x.id !== f.id)!.id,
                              );
                          }}
                        />
                      ))}
                      {canEdit && !archived && (
                        <label className="add-select">
                          <span className="sr-only">
                            {t("addField")} · {s.title}
                          </span>
                          <select
                            value=""
                            onChange={(event) =>
                              event.target.value &&
                              newField(
                                event.target.value as Field["type"],
                                s.id,
                              )
                            }
                          >
                            <option value="">+ {t("addField")}</option>
                            {Object.entries(typeNames).map(([type, names]) => (
                              <option key={type} value={type}>
                                {names[locale === "pt-BR" ? 1 : 0]}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                    </section>
                  ))}
                </SortableContext>
              </DndContext>
              {canEdit && !archived && (
                <Button
                  className="secondary"
                  onClick={() => {
                    const id = `step_${crypto.randomUUID().replaceAll("-", "")}`,
                      f: Field = {
                        id: `field_${crypto.randomUUID().replaceAll("-", "")}`,
                        label: t("label"),
                        type: "text",
                        required: false,
                      };
                    change({
                      ...e,
                      steps: [
                        ...e.steps,
                        {
                          id,
                          title: `${t("step")} ${e.steps.length + 1}`,
                          fields: [f],
                        },
                      ],
                    });
                    setSelected(f.id);
                  }}
                >
                  + {t("addStep")}
                </Button>
              )}
            </aside>
            <section className="builder-editor">
              <fieldset
                disabled={!canEdit || archived}
                className="editor-fieldset"
              >
                <div className="section-intro">
                  <h2>{field?.label ?? t("fields")}</h2>
                  <p>{t("selectQuestion")}</p>
                </div>
                <div className="form-grid">
                  <label>
                    {t("name")}
                    <input
                      value={e.name}
                      maxLength={200}
                      onChange={(event) =>
                        change({
                          ...clearTranslation(e, "name", locale),
                          name: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label>
                    {t("step")}
                    <input
                      value={currentStep.title}
                      onChange={(event) =>
                        change({
                          ...clearTranslation(
                            e,
                            `step:${currentStep.id}`,
                            locale,
                          ),
                          steps: e.steps.map((s) =>
                            s.id === currentStep.id
                              ? { ...s, title: event.target.value }
                              : s,
                          ),
                        })
                      }
                    />
                  </label>
                </div>
                {field && (
                  <>
                    <div className="form-grid">
                      <label>
                        {t("label")}
                        <input
                          value={field.label}
                          maxLength={200}
                          onChange={(event) => {
                            const next = clearTranslation(
                              e,
                              `field:${field.id}`,
                              locale,
                            );
                            change({
                              ...next,
                              steps: next.steps.map((s) => ({
                                ...s,
                                fields: s.fields.map((f) =>
                                  f.id === field.id
                                    ? { ...f, label: event.target.value }
                                    : f,
                                ),
                              })),
                            });
                          }}
                        />
                      </label>
                      <label>
                        {t("key")}
                        <input
                          key={field.id}
                          className="mono"
                          defaultValue={field.id}
                          pattern="[a-zA-Z][a-zA-Z0-9_-]*"
                          onBlur={(event) => renameKey(event.target.value)}
                        />
                      </label>
                    </div>
                    <label>
                      {t("type")}
                      <select
                        value={field.type}
                        onChange={(event) => {
                          const type = event.target.value as Field["type"],
                            next: Field = { ...field, type };
                          delete next.defaultValue;
                          delete next.validation;
                          if (!isChoiceField(type)) delete next.choices;
                          else
                            next.choices = field.choices?.length
                              ? field.choices
                              : [{ id: "option_1", label: "Option 1" }];
                          if (type === "slider")
                            next.validation = { min: 0, max: 100 };
                          if (type === "hidden") next.defaultValue = 0;
                          changeField(next);
                        }}
                      >
                        {Object.entries(typeNames).map(([type, names]) => (
                          <option key={type} value={type}>
                            {names[locale === "pt-BR" ? 1 : 0]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      {t("description")}
                      <textarea
                        value={field.help ?? ""}
                        maxLength={500}
                        onChange={(event) =>
                          changeField({ ...field, help: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      {t("placeholder")}
                      <input
                        value={field.placeholder ?? ""}
                        maxLength={200}
                        onChange={(event) =>
                          changeField({
                            ...field,
                            placeholder: event.target.value,
                          })
                        }
                      />
                    </label>
                    {!["info", "divider", "hidden"].includes(field.type) && (
                      <label className="check">
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={(event) =>
                            changeField({
                              ...field,
                              required: event.target.checked,
                            })
                          }
                        />
                        {t("required")}
                      </label>
                    )}
                    <label>
                      {t("default")}
                      {["boolean", "checkbox"].includes(field.type) ? (
                        <select
                          value={
                            field.defaultValue === undefined
                              ? ""
                              : String(field.defaultValue)
                          }
                          onChange={(event) => {
                            const next = { ...field };
                            if (event.target.value === "")
                              delete next.defaultValue;
                            else
                              next.defaultValue = event.target.value === "true";
                            changeField(next);
                          }}
                        >
                          <option value="">—</option>
                          <option value="true">{t("yes")}</option>
                          <option value="false">{t("no")}</option>
                        </select>
                      ) : (
                        <input
                          type={isNumericField(field.type) ? "number" : "text"}
                          value={
                            Array.isArray(field.defaultValue)
                              ? field.defaultValue.join(",")
                              : String(field.defaultValue ?? "")
                          }
                          onChange={(event) => {
                            const next = { ...field };
                            if (event.target.value === "")
                              delete next.defaultValue;
                            else
                              next.defaultValue = isNumericField(field.type)
                                ? Number(event.target.value)
                                : field.type === "multiselect"
                                  ? event.target.value.split(",")
                                  : event.target.value;
                            changeField(next);
                          }}
                        />
                      )}
                    </label>
                    {isNumericField(field.type) ? (
                      <>
                        <h3>{t("validation")}</h3>
                        <div className="form-grid">
                          {(["min", "max"] as const).map((key) => (
                            <label key={key}>
                              {t(key)}
                              <input
                                type="number"
                                value={field.validation?.[key] ?? ""}
                                onChange={(event) => {
                                  const validation = { ...field.validation };
                                  if (event.target.value === "")
                                    delete validation[key];
                                  else
                                    validation[key] = Number(
                                      event.target.value,
                                    );
                                  changeField({ ...field, validation });
                                }}
                              />
                            </label>
                          ))}
                        </div>
                        <label className="check">
                          <input
                            type="checkbox"
                            checked={field.validation?.integer ?? false}
                            onChange={(event) =>
                              changeField({
                                ...field,
                                validation: {
                                  ...field.validation,
                                  integer: event.target.checked,
                                },
                              })
                            }
                          />
                          {t("integer")}
                        </label>
                      </>
                    ) : (
                      <label>
                        {t("maxLength")}
                        <input
                          type="number"
                          min={1}
                          max={2000}
                          value={field.validation?.maxLength ?? ""}
                          onChange={(event) =>
                            changeField({
                              ...field,
                              validation: {
                                ...field.validation,
                                maxLength: event.target.value
                                  ? Number(event.target.value)
                                  : undefined,
                              },
                            })
                          }
                        />
                      </label>
                    )}
                    {isChoiceField(field.type) && (
                      <section>
                        <h3>{t("choices")}</h3>
                        {field.choices?.map((c, i) => (
                          <div className="choice-editor" key={i}>
                            <label>
                              {t("label")}
                              <input
                                value={c.label}
                                onChange={(event) =>
                                  changeField({
                                    ...field,
                                    choices: field.choices!.map((x, j) =>
                                      j === i
                                        ? { ...x, label: event.target.value }
                                        : x,
                                    ),
                                  })
                                }
                              />
                            </label>
                            <label>
                              {t("key")}
                              <input
                                value={c.id}
                                onChange={(event) =>
                                  changeField({
                                    ...field,
                                    choices: field.choices!.map((x, j) =>
                                      j === i
                                        ? { ...x, id: event.target.value }
                                        : x,
                                    ),
                                  })
                                }
                              />
                            </label>
                            {field.type === "image_choice" && (
                              <label>
                                {locale === "pt-BR"
                                  ? "URL da imagem"
                                  : "Image URL"}
                                <input
                                  type="url"
                                  value={c.imageUrl ?? ""}
                                  onChange={(event) =>
                                    changeField({
                                      ...field,
                                      choices: field.choices!.map((x, j) =>
                                        j === i
                                          ? {
                                              ...x,
                                              imageUrl: event.target.value,
                                            }
                                          : x,
                                      ),
                                    })
                                  }
                                />
                              </label>
                            )}
                            <button
                              type="button"
                              className="icon-button"
                              aria-label={t("remove")}
                              disabled={field.choices!.length < 2}
                              onClick={() =>
                                changeField({
                                  ...field,
                                  choices: field.choices!.filter(
                                    (_, j) => j !== i,
                                  ),
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
                            changeField({
                              ...field,
                              choices: [
                                ...(field.choices ?? []),
                                {
                                  id: `option_${crypto.randomUUID().replaceAll("-", "")}`,
                                  label: t("label"),
                                },
                              ],
                            })
                          }
                        >
                          + {t("addChoice")}
                        </button>
                      </section>
                    )}
                    <ConditionEditor
                      value={field.visibleWhen}
                      fields={all
                        .slice(0, all.indexOf(field))
                        .filter((f) => !["info", "divider"].includes(f.type))}
                      label={t("visibility")}
                      locale={locale}
                      onChange={(visibleWhen) => {
                        const next = { ...field };
                        delete next.visibleWhen;
                        if (visibleWhen) next.visibleWhen = visibleWhen;
                        changeField(next);
                      }}
                    />
                    <label>
                      {t("moveStep")}
                      <select
                        value={currentStep.id}
                        disabled={currentStep.fields.length === 1}
                        onChange={(event) =>
                          change({
                            ...e,
                            steps: e.steps.map((s) =>
                              s.id === currentStep.id
                                ? {
                                    ...s,
                                    fields: s.fields.filter(
                                      (f) => f.id !== field.id,
                                    ),
                                  }
                                : s.id === event.target.value
                                  ? { ...s, fields: [...s.fields, field] }
                                  : s,
                            ),
                          })
                        }
                      >
                        {e.steps.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.title}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="actions">
                      <Button
                        className="secondary"
                        disabled={
                          all.indexOf(field) === 0 ||
                          currentStep.fields.indexOf(field) === 0
                        }
                        onClick={() =>
                          change({
                            ...e,
                            steps: e.steps.map((s) =>
                              s.id === currentStep.id
                                ? {
                                    ...s,
                                    fields: arrayMove(
                                      s.fields,
                                      s.fields.indexOf(field),
                                      s.fields.indexOf(field) - 1,
                                    ),
                                  }
                                : s,
                            ),
                          })
                        }
                      >
                        {t("moveUp")}
                      </Button>
                      <Button
                        className="secondary"
                        disabled={
                          currentStep.fields.indexOf(field) ===
                          currentStep.fields.length - 1
                        }
                        onClick={() =>
                          change({
                            ...e,
                            steps: e.steps.map((s) =>
                              s.id === currentStep.id
                                ? {
                                    ...s,
                                    fields: arrayMove(
                                      s.fields,
                                      s.fields.indexOf(field),
                                      s.fields.indexOf(field) + 1,
                                    ),
                                  }
                                : s,
                            ),
                          })
                        }
                      >
                        {t("moveDown")}
                      </Button>
                      {e.steps.length > 1 && (
                        <Button
                          className="secondary danger"
                          onClick={() => {
                            const remaining = e.steps.filter(
                              (s) => s.id !== currentStep.id,
                            );
                            setSelected(remaining[0]!.fields[0]!.id);
                            change({ ...e, steps: remaining });
                          }}
                        >
                          {t("remove")} {t("step")}
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </fieldset>
            </section>
          </div>
        )}
        {tab === "pricing" && (
          <div className="builder-centered">
            <fieldset
              className="editor-fieldset"
              disabled={!canEdit || archived}
            >
              <PricingEditor estimator={e} onChange={change} locale={locale} />
            </fieldset>
          </div>
        )}
        {tab === "result" && (
          <div className="builder-centered">
            <fieldset
              className="editor-fieldset"
              disabled={!canEdit || archived}
            >
              <h2>{t("result")}</h2>
              <label>
                {t("description")}
                <textarea
                  value={e.description ?? ""}
                  onChange={(event) =>
                    change({
                      ...clearTranslation(e, "description", locale),
                      description: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                {t("disclaimer")}
                <textarea
                  value={e.output.message ?? ""}
                  onChange={(event) =>
                    change({
                      ...clearTranslation(e, "message", locale),
                      output: { ...e.output, message: event.target.value },
                    })
                  }
                />
              </label>
              <label>
                {t("terms")}
                <textarea
                  value={e.output.terms ?? ""}
                  onChange={(event) =>
                    change({
                      ...clearTranslation(e, "terms", locale),
                      output: { ...e.output, terms: event.target.value },
                    })
                  }
                />
              </label>
              <label>
                {t("expires")}
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={e.output.expiresAfterDays ?? ""}
                  onChange={(event) => {
                    const output = { ...e.output };
                    if (event.target.value)
                      output.expiresAfterDays = Number(event.target.value);
                    else delete output.expiresAfterDays;
                    change({ ...e, output });
                  }}
                />
              </label>
              <label>
                {t("contactMode")}
                <select
                  value={e.leadCapture.mode}
                  onChange={(event) =>
                    change({
                      ...e,
                      leadCapture: {
                        ...e.leadCapture,
                        mode: event.target
                          .value as Estimator["leadCapture"]["mode"],
                      },
                    })
                  }
                >
                  {(["before", "after", "optional", "disabled"] as const).map(
                    (mode) => (
                      <option key={mode} value={mode}>
                        {t(mode)}
                      </option>
                    ),
                  )}
                </select>
              </label>
              <div className="form-grid">
                {(
                  [
                    "name",
                    "email",
                    "phone",
                    "company",
                    "address",
                    "notes",
                  ] as const
                ).map((key) => (
                  <label className="check" key={key}>
                    <input
                      type="checkbox"
                      checked={e.leadCapture.fields.includes(key)}
                      disabled={["name", "email"].includes(key)}
                      onChange={(event) =>
                        change({
                          ...e,
                          leadCapture: {
                            ...e.leadCapture,
                            fields: event.target.checked
                              ? [...e.leadCapture.fields, key]
                              : e.leadCapture.fields.filter((f) => f !== key),
                          },
                        })
                      }
                    />
                    {t(key)}
                  </label>
                ))}
              </div>
              <label>
                {t("consent")}
                <textarea
                  value={e.leadCapture.consentText ?? ""}
                  onChange={(event) =>
                    change({
                      ...clearTranslation(e, "consent", locale),
                      leadCapture: {
                        ...e.leadCapture,
                        consentText: event.target.value,
                      },
                    })
                  }
                />
              </label>
              <label>
                {t("ctaLabel")}
                <input
                  value={e.output.cta?.label ?? ""}
                  onChange={(event) => {
                    const output = { ...e.output };
                    if (event.target.value)
                      output.cta = {
                        ...output.cta,
                        label: event.target.value,
                        url: output.cta?.url ?? "",
                      };
                    else delete output.cta;
                    change({ ...e, output });
                  }}
                />
              </label>
              {e.output.cta && (
                <>
                  <label>
                    {t("ctaUrl")}
                    <input
                      type="url"
                      value={e.output.cta.url}
                      onChange={(event) =>
                        change({
                          ...e,
                          output: {
                            ...e.output,
                            cta: { ...e.output.cta!, url: event.target.value },
                          },
                        })
                      }
                    />
                  </label>
                  <ConditionEditor
                    value={e.output.cta.when}
                    fields={all}
                    locale={locale}
                    onChange={(when) => {
                      const cta = { ...e.output.cta! };
                      delete cta.when;
                      if (when) cta.when = when;
                      change({ ...e, output: { ...e.output, cta } });
                    }}
                  />
                </>
              )}
            </fieldset>
          </div>
        )}
        {tab === "preview" && (
          <section className="preview-panel">
            <div className="preview-tools">
              <p>{t("previewHelp")}</p>
              <div className="segmented">
                {(["desktop", "mobile"] as const).map((size) => (
                  <button
                    type="button"
                    aria-pressed={device === size}
                    key={size}
                    onClick={() => setDevice(size)}
                  >
                    {t(size)}
                  </button>
                ))}
              </div>
            </div>
            {previewDocument ? (
              <div
                className={`preview-frame ${device}`}
                style={brandStyle(brand)}
              >
                <div className="preview-brand">
                  {brand.logo ? (
                    <Image
                      unoptimized
                      src={brand.logo}
                      width={170}
                      height={48}
                      alt={brand.displayName ?? e.name}
                    />
                  ) : (
                    (brand.displayName ?? e.name)
                  )}
                </div>
                <div className="runtime-card">
                  <Calculator
                    key={JSON.stringify(previewDocument)}
                    estimator={previewDocument.estimator}
                    locale={locale}
                  />
                </div>
              </div>
            ) : (
              <p role="alert">{t("invalidError")}</p>
            )}
          </section>
        )}
        {tab === "revisions" && (
          <section className="builder-centered">
            <h2>{t("revisions")}</h2>
            {revisions.map((r) => (
              <div className="revision-row" key={r.id}>
                <div>
                  <strong>
                    {t("revision")} {r.number}
                  </strong>
                  <p>
                    {dateLabel(r.createdAt, locale)}{" "}
                    {r.active && <span className="badge">{t("live")}</span>}
                  </p>
                </div>
                {canPublish && (
                  <Button
                    className="secondary"
                    disabled={pending || r.active}
                    onClick={() =>
                      startTransition(async () => {
                        const saved = await restoreRevision(
                          orgId,
                          estimatorId,
                          r.id,
                        );
                        setIsError(!saved.ok);
                        setMessage(t(saved.ok ? "published" : "failure"));
                        router.refresh();
                      })
                    }
                  >
                    {t("restore")}
                  </Button>
                )}
              </div>
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
