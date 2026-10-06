import type { Metadata } from "next";
import "@openquotestack/ui/styles.css";
export const metadata: Metadata = {
  title: { default: "OpenQuoteStack", template: "%s | OpenQuoteStack" },
  description:
    "The open-source stack for building branded instant quotes and pricing estimators.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
