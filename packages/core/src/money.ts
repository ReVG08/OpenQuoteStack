export function formatMoney(
  amountMinor: number | bigint,
  currency: string,
  minorUnits: number,
  locale: string,
) {
  const amount = BigInt(amountMinor),
    scale = 10n ** BigInt(minorUnits);
  const whole = amount / scale,
    fraction = (amount < 0n ? -amount : amount) % scale;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: minorUnits,
    maximumFractionDigits: minorUnits,
  })
    .formatToParts(whole === 0n && amount < 0n ? -0 : whole)
    .map((part) =>
      part.type === "fraction"
        ? fraction.toString().padStart(minorUnits, "0")
        : part.value,
    )
    .join("");
}
