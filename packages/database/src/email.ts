import nodemailer from "nodemailer";
import { notificationsInput } from "./platform-validation";
import type { PrismaClient } from "./index";
import { brandingSchema, formatMoney } from "@openquotestack/core";
import { parseDocument } from "@openquotestack/schema";
import type { EstimateResult } from "@openquotestack/engine";
export const smtpConfigured = () =>
  Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
export function smtpTransport() {
  if (!smtpConfigured()) throw new Error("smtp_unconfigured");
  const port = Number(process.env.SMTP_PORT ?? 587),
    secure = process.env.SMTP_SECURE === "true";
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("smtp_invalid_config");
  const insecure = process.env.SMTP_ALLOW_INSECURE === "true";
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    requireTLS: !secure && !insecure,
    ignoreTLS: insecure,
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD }
      : undefined,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
}
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export async function estimateEmail(
  db: PrismaClient,
  orgId: string,
  estimateId: string,
  recipient: string,
  kind: string,
) {
  const quote = await db.estimate.findFirstOrThrow({
    where: { id: estimateId, organizationId: orgId },
    include: { lead: true, organization: true, revision: true },
  });
  const result = quote.result as unknown as EstimateResult,
    org = quote.organization,
    brand = brandingSchema.parse(org.branding),
    settings = notificationsInput.parse(org.notifications),
    locale = org.locale === "pt-BR" ? "pt-BR" : "en";
  const ref = `OQS-${quote.id.slice(-8).toUpperCase()}`,
    business = brand.displayName ?? org.name;
  const money = (minor: number) =>
    formatMoney(minor, result.currency, result.minorUnits, locale);
  const heading =
    locale === "pt-BR"
      ? kind === "notification"
        ? "Novo contato"
        : "Seu orçamento"
      : kind === "notification"
        ? "New lead"
        : "Your estimate";
  const lines = [...result.lineItems, ...result.adjustments],
    byId = new Map(lines.map((l) => [l.ruleId, l]));
  const ordered = result.appliedRules.flatMap((id) =>
    byId.has(id) ? [byId.get(id)!] : [],
  );
  const contact = [brand.email, brand.phone, brand.businessAddress]
    .filter(Boolean)
    .join(" · ");
  const definition = parseDocument(quote.revision.definition).estimator;
  const terms = definition.output.terms ?? "";
  const logo = brand.logo?.startsWith(`/assets/${orgId}/`)
    ? new URL(
        brand.logo,
        process.env.BETTER_AUTH_URL ?? "http://localhost:3000",
      ).href
    : undefined;
  const leadContact =
    kind === "notification"
      ? [quote.lead?.email, quote.lead?.phone].filter(Boolean).join(" · ")
      : "";
  const summary = result.range
    ? `${money(result.range.minMinor)} – ${money(result.range.maxMinor)}`
    : money(result.totalMinor);
  const text = [
    business,
    heading,
    ref,
    quote.lead?.name ?? "",
    leadContact,
    summary,
    ...ordered.map((l) => `${l.label}: ${money(l.amountMinor)}`),
    `${locale === "pt-BR" ? "Total" : "Total"}: ${money(result.totalMinor)}`,
    terms,
    settings.footer,
    contact,
  ]
    .filter(Boolean)
    .join("\n");
  const html = `<!doctype html><html lang="${locale}"><body style="margin:0;background:#f6f8f6;color:#202b25;font-family:Arial,sans-serif"><main style="max-width:560px;margin:32px auto;padding:32px;background:#fff;border-top:4px solid ${brand.primaryColor ?? "#176653"}">${logo ? `<img src="${escape(logo)}" alt="${escape(business)}" width="170" style="max-width:170px;height:auto"/>` : ""}<h2>${escape(business)}</h2><p>${escape(heading)} · ${escape(ref)}</p><p>${escape(quote.lead?.name ?? "")}</p><p>${escape(leadContact)}</p><h1>${escape(summary)}</h1><table style="width:100%">${ordered.map((l) => `<tr><td style="padding:8px 0">${escape(l.label)}</td><td style="text-align:right">${escape(money(l.amountMinor))}</td></tr>`).join("")}</table><p><strong>Total: ${escape(money(result.totalMinor))}</strong></p><p>${escape(terms)}</p><p>${escape(settings.footer)}</p><p style="color:#607068">${escape(contact)}</p></main></body></html>`;
  return {
    from: process.env.SMTP_FROM!,
    to: recipient,
    subject: `${heading} · ${ref} · ${business}`,
    text,
    html,
  };
}
