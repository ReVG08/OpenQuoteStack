import type { Answers, Condition } from "@openquotestack/schema";
export function evaluateCondition(
  condition: Condition,
  answers: Answers,
): boolean {
  if ("all" in condition)
    return condition.all.every((c) => evaluateCondition(c, answers));
  if ("any" in condition)
    return condition.any.some((c) => evaluateCondition(c, answers));
  const value = Object.hasOwn(answers, condition.field)
    ? answers[condition.field]
    : undefined;
  const empty =
    value === undefined ||
    value === "" ||
    (Array.isArray(value) && value.length === 0);
  if (condition.op === "empty") return empty;
  if (condition.op === "not_empty") return !empty;
  if (value === undefined) return false;
  const target = condition.value;
  const equal =
    Array.isArray(value) && Array.isArray(target)
      ? value.length === target.length && value.every((v, i) => v === target[i])
      : value === target;
  const contains =
    (typeof value === "string" &&
      typeof target === "string" &&
      value.includes(target)) ||
    (Array.isArray(value) &&
      typeof target === "string" &&
      value.includes(target));
  switch (condition.op) {
    case "equals":
      return equal;
    case "not_equals":
      return !equal;
    case "gt":
      return (
        typeof value === "number" &&
        typeof target === "number" &&
        value > target
      );
    case "lt":
      return (
        typeof value === "number" &&
        typeof target === "number" &&
        value < target
      );
    case "gte":
      return (
        typeof value === "number" &&
        typeof target === "number" &&
        value >= target
      );
    case "lte":
      return (
        typeof value === "number" &&
        typeof target === "number" &&
        value <= target
      );
    case "contains":
    case "selected":
      return contains || value === target;
    case "not_contains":
    case "not_selected":
      return !(contains || value === target);
  }
}
