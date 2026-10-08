import { pricingTraces } from "./pricing-traces";
import PDFDocument from "pdfkit";
import sharp from "sharp";
import type { Branding } from "@openquotestack/core";
import type { Estimator } from "@openquotestack/schema";
import type { EstimateResult } from "@openquotestack/engine";
import { formatMoney, type Locale } from "./i18n";
import { copy, dateLabel, localized, reference } from "./product-i18n";
import { assetKey, getAssetStorage } from "./assets";
type PdfInput = {
  id: string;
  revisionNumber: number;
  organizationId: string;
  businessName: string;
  branding: Branding;
  createdAt: Date;
  timezone: string;
  locale: Locale;
  estimator: Estimator;
  result: EstimateResult;
  customer: {
    name: string;
    email: string;
    phone?: string | null;
    company?: string | null;
    address?: string | null;
  } | null;
};
/** Render the retained calculation; PDF presentation never runs pricing rules. */
export async function estimatePdf(input: PdfInput): Promise<Buffer> {
  const t = copy(input.locale),
    b = input.branding,
    e = input.estimator,
    r = input.result,
    money = (n: number) =>
      formatMoney(n, r.currency, r.minorUnits, input.locale).replace(
        /[\u00a0\u202f]/g,
        " ",
      ),
    ink = "#202b25",
    muted = "#607068",
    line = "#e1e7e2";
  const doc = new PDFDocument({
      size: "A4",
      margin: 48,
      bufferPages: true,
      info: {
        Title: reference(input.id),
        Author: b.displayName ?? input.businessName,
        CreationDate: input.createdAt,
        ModDate: input.createdAt,
      },
    }),
    chunks: Buffer[] = [];
  const complete = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk) => chunks.push(chunk as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  const width = doc.page.width - 96;
  const ensure = (height: number) => {
    if (doc.y + height > doc.page.height - 72) doc.addPage();
  };
  if (b.logo) {
    const match = b.logo.match(/^\/assets\/([^/]+)\/([^/]+)$/);
    if (match?.[1] === input.organizationId && match[2]) {
      try {
        const png = await sharp(
          await getAssetStorage().get(assetKey(match[1], match[2])),
        )
          .png()
          .toBuffer();
        doc.image(png, doc.page.width - 188, 48, { fit: [140, 38] });
      } catch {
        /* Business name remains visible when an optional image is unavailable. */
      }
    }
  }
  doc
    .fillColor(ink)
    .font("Helvetica-Bold")
    .fontSize(20)
    .text(b.displayName ?? input.businessName);
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(muted)
    .text(
      [b.businessAddress, b.email, b.phone, b.website]
        .filter(Boolean)
        .join("\n"),
      { width: width * 0.65 },
    );
  doc.moveDown(2);
  doc
    .fillColor(ink)
    .font("Helvetica-Bold")
    .fontSize(30)
    .text(t("yourEstimate"));
  doc.moveDown(0.2);
  doc
    .fillColor(muted)
    .font("Helvetica")
    .fontSize(10)
    .text(
      `${reference(input.id)}  |  ${dateLabel(input.createdAt, input.locale, input.timezone)}`,
    );
  if (e.output.expiresAfterDays)
    doc
      .fontSize(9)
      .text(
        `${input.locale === "pt-BR" ? "Válido até" : "Valid until"} ${dateLabel(new Date(input.createdAt.getTime() + e.output.expiresAfterDays * 86400000), input.locale, input.timezone)}`,
      );
  doc.moveDown(1.8);
  doc
    .fontSize(10)
    .text(
      `${localized(e, input.locale, "name", e.name)}  |  ${t("revision")} ${input.revisionNumber}`,
    );
  doc.moveDown(1.5);
  if (input.customer) {
    const c = input.customer;
    doc.fillColor(muted).fontSize(8).text(t("customer").toUpperCase());
    doc.moveDown(0.5);
    doc.fillColor(ink).font("Helvetica-Bold").fontSize(12).text(c.name);
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor(muted)
      .text(
        [c.company, c.email, c.phone, c.address].filter(Boolean).join("\n"),
      );
    doc.moveDown(1.5);
  }
  const tableHead = () => {
    const y = doc.y;
    doc.fillColor("#f0f4f1").rect(48, y, width, 30).fill();
    doc
      .fillColor(muted)
      .font("Helvetica-Bold")
      .fontSize(9)
      .text(t("breakdown"), 60, y + 10, { width: width - 180 });
    doc.text(t("amount"), doc.page.width - 190, y + 10, {
      width: 130,
      align: "right",
    });
    doc.y = y + 42;
  };
  ensure(70);
  tableHead();
  for (const trace of pricingTraces(r)) {
    const label = localized(
      e,
      input.locale,
      `rule:${trace.ruleId}`,
      trace.operation === "minimum"
        ? t("min")
        : trace.operation === "maximum"
          ? t("max")
          : trace.label,
    );
    const detail =
      trace.operation === "per_unit"
        ? `${trace.input} x ${money(Number(trace.parameters.rateMinor))}`
        : trace.parameters.percent !== undefined
          ? `${trace.parameters.percent}%`
          : trace.input !== undefined
            ? String(trace.input)
            : "";
    doc.font("Helvetica").fontSize(10);
    const height = Math.max(
      30,
      doc.heightOfString(label, { width: width - 175 }) +
        (detail ? 12 : 0) +
        12,
    );
    if (doc.y + height > doc.page.height - 72) {
      doc.addPage();
      tableHead();
    }
    const y = doc.y;
    doc.fillColor(ink).text(label, 60, y, { width: width - 175 });
    if (detail)
      doc
        .fontSize(8)
        .fillColor(muted)
        .text(detail, 60, doc.y + 3, { width: width - 175 });
    doc
      .fillColor(ink)
      .fontSize(10)
      .text(money(trace.amountMinor), doc.page.width - 198, y, {
        width: 138,
        align: "right",
      });
    doc
      .strokeColor(line)
      .lineWidth(0.5)
      .moveTo(48, y + height - 5)
      .lineTo(doc.page.width - 48, y + height - 5)
      .stroke();
    doc.y = y + height + 5;
  }
  ensure(130);
  doc.moveDown(0.5);
  const totalY = doc.y;
  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor(ink)
    .text(t("yourEstimate"), 60, totalY);
  doc.fontSize(20).text(money(r.totalMinor), doc.page.width - 270, totalY - 4, {
    width: 210,
    align: "right",
  });
  doc.y = totalY + 34;
  if (r.range) {
    doc
      .font("Helvetica")
      .fontSize(10)
      .fillColor(muted)
      .text(
        `${t("priceRange")}: ${money(r.range.minMinor)} - ${money(r.range.maxMinor)}`,
        { align: "right" },
      );
    doc.moveDown(1);
  }
  for (const [i, message] of r.messages.entries()) {
    ensure(50);
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(muted)
      .text(
        localized(
          e,
          input.locale,
          i === 0 ? "message" : `message:${i}`,
          message,
        ),
        48,
        doc.y,
        { width },
      );
    doc.moveDown(1);
  }
  if (e.output.terms) {
    ensure(75);
    doc.fillColor(ink).font("Helvetica-Bold").fontSize(10).text(t("terms"));
    doc.moveDown(0.5);
    doc
      .font("Helvetica")
      .fontSize(9)
      .fillColor(muted)
      .text(localized(e, input.locale, "terms", e.output.terms), {
        width,
        lineGap: 3,
      });
  }
  const pages = doc.bufferedPageRange();
  for (let i = pages.start; i < pages.start + pages.count; i++) {
    doc.switchToPage(i);
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(muted)
      .text(
        `${reference(input.id)}  |  ${i + 1} / ${pages.count}`,
        48,
        doc.page.height - 64,
        { width, align: "right" },
      );
  }
  doc.end();
  return complete;
}
