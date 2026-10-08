import type { Estimator } from "@openquotestack/schema";
/** Renaming a stable choice key keeps its authored conditions and defaults connected. */
export function renameChoice(
  estimator: Estimator,
  fieldId: string,
  oldId: string,
  newId: string,
): Estimator {
  const next = structuredClone(estimator);
  const replace = (value: unknown): unknown =>
    Array.isArray(value) ? value.map(replace) : value === oldId ? newId : value;
  const visit = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    if (!Array.isArray(value)) {
      const node = value as Record<string, unknown>;
      if (node.field === fieldId && "value" in node)
        node.value = replace(node.value);
    }
    Object.values(value).forEach(visit);
  };
  visit(next);
  for (const field of next.steps.flatMap((step) => step.fields)) {
    if (field.id !== fieldId) continue;
    field.choices = field.choices?.map((choice) =>
      choice.id === oldId ? { ...choice, id: newId } : choice,
    );
    if (field.defaultValue !== undefined)
      field.defaultValue = replace(
        field.defaultValue,
      ) as typeof field.defaultValue;
  }
  for (const translations of Object.values(next.translations)) {
    const key = `choice:${fieldId}.${oldId}`;
    if (translations && key in translations) {
      translations[`choice:${fieldId}.${newId}`] = translations[key]!;
      delete translations[key];
    }
  }
  return next;
}
