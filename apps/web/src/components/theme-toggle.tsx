"use client";
import { useEffect, useState } from "react";
export function ThemeToggle({ label }: { label: string }) {
  const [mode, setMode] = useState("system");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("oqs-theme");
      if (saved === "dark" || saved === "light") {
        document.documentElement.dataset.theme = saved;
        requestAnimationFrame(() => setMode(saved));
      }
    } catch {
      /* Theme selection still works when browser storage is unavailable. */
    }
  }, []);
  return (
    <label className="theme-control">
      <span>{label}</span>
      <select
        aria-label={label}
        value={mode}
        onChange={(event) => {
          const value = event.target.value;
          setMode(value);
          if (value === "system") delete document.documentElement.dataset.theme;
          else document.documentElement.dataset.theme = value;
          try {
            localStorage.setItem("oqs-theme", value);
          } catch {
            /* Theme selection still works when browser storage is unavailable. */
          }
        }}
      >
        <option value="system">
          {label === "Tema" ? "Sistema" : "System"}
        </option>
        <option value="light">{label === "Tema" ? "Claro" : "Light"}</option>
        <option value="dark">{label === "Tema" ? "Escuro" : "Dark"}</option>
      </select>
    </label>
  );
}
