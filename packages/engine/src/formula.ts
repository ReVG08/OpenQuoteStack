import {
  assertDataBudget,
  formulaSchema,
  type Formula,
} from "@openquotestack/schema";
import { add, sub, mul, div, decimal, type Rational } from "./money.js";

/** Parse arithmetic into portable data; calls, properties and implicit coercions are forbidden. */
export function parseFormula(source: string): Formula {
  if (source.length > 512) throw new Error("Formula is too long");
  const tokens =
    source.match(/\d+(?:\.\d+)?|[a-zA-Z][a-zA-Z0-9_]*|[()+*/-]|\S/g) ?? [];
  let cursor = 0;
  const primary = (): Formula => {
    const token = tokens[cursor++];
    if (token === "(") {
      const node = expression();
      if (tokens[cursor++] !== ")") throw new Error("Unclosed formula group");
      return node;
    }
    if (token === "-")
      return { op: "-", left: { value: "0" }, right: primary() };
    if (token && /^\d+(\.\d+)?$/.test(token)) return { value: token };
    if (token && /^[a-zA-Z][a-zA-Z0-9_]*$/.test(token))
      return { variable: token };
    throw new Error("Invalid formula token");
  };
  const product = (): Formula => {
    let node = primary();
    while (["*", "/"].includes(tokens[cursor] ?? "")) {
      const op = tokens[cursor++] as "*" | "/";
      node = { op, left: node, right: primary() };
    }
    return node;
  };
  const expression = (): Formula => {
    let node = product();
    while (["+", "-"].includes(tokens[cursor] ?? "")) {
      const op = tokens[cursor++] as "+" | "-";
      node = { op, left: node, right: product() };
    }
    return node;
  };
  const node = expression();
  if (cursor !== tokens.length) throw new Error("Unexpected formula token");
  assertDataBudget(node);
  return formulaSchema.parse(node);
}
export function evaluateFormula(
  node: Formula,
  variables: Record<string, Rational>,
): Rational {
  if ("value" in node) return decimal(node.value);
  if ("variable" in node) {
    const value = Object.hasOwn(variables, node.variable)
      ? variables[node.variable]
      : undefined;
    if (!value) throw new Error(`Missing formula variable: ${node.variable}`);
    return value;
  }
  const a = evaluateFormula(node.left, variables),
    b = evaluateFormula(node.right, variables);
  return { "+": add, "-": sub, "*": mul, "/": div }[node.op](a, b);
}
