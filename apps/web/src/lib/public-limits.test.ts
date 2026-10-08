import { it, expect } from "vitest";
import { WindowLimiter } from "./public-limits";
it("limits repeated requests while keeping unrelated sessions independent", () => {
  let now = 0;
  const limit = new WindowLimiter(() => now);
  expect(limit.consume("one", 2)).toBe(true);
  expect(limit.consume("one", 2)).toBe(true);
  expect(limit.consume("one", 2)).toBe(false);
  expect(limit.consume("two", 2)).toBe(true);
  now = 60001;
  expect(limit.consume("one", 2)).toBe(true);
});
