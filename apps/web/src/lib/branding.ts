import type { CSSProperties } from "react";
import { brandingSchema, type Branding } from "@openquotestack/core";
export function brandingOf(raw: unknown): Branding {
  const parsed = brandingSchema.safeParse(raw);
  return parsed.success ? parsed.data : {};
}
function luminance(hex: string) {
  const rgb = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * rgb[0]! + 0.7152 * rgb[1]! + 0.0722 * rgb[2]!;
}
export function brandStyle(b: Branding): CSSProperties {
  const color = b.primaryColor ?? "#176653",
    background = b.backgroundColor ?? "#f5f6f3";
  return {
    "--brand": color,
    "--brand-ink": luminance(color) > 0.179 ? "#000000" : "#ffffff",
    "--public-bg": background,
    "--public-ink": luminance(background) > 0.179 ? "#000000" : "#ffffff",
    "--secondary":
      b.secondaryColor && luminance(b.secondaryColor) < 0.183
        ? b.secondaryColor
        : "#344d47",
    "--radius": `${b.radius ?? 10}px`,
    fontFamily:
      b.font === "serif"
        ? "Georgia, serif"
        : b.font === "mono"
          ? "ui-monospace, monospace"
          : "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  } as CSSProperties;
}
