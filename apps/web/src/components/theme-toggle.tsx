"use client";
import { useEffect } from "react";
import { Button } from "@openquotestack/ui";
export function ThemeToggle({ label }: { label: string }) {
  useEffect(() => {
    const saved = localStorage.getItem("oqs-theme");
    if (saved === "dark" || saved === "light")
      document.documentElement.dataset.theme = saved;
  }, []);
  return (
    <Button
      className="secondary"
      onClick={() => {
        const current =
          document.documentElement.dataset.theme ??
          (matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light");
        const next = current === "dark" ? "light" : "dark";
        document.documentElement.dataset.theme = next;
        localStorage.setItem("oqs-theme", next);
      }}
    >
      {label}
    </Button>
  );
}
