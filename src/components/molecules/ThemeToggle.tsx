"use client";

import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/atoms/Button";

export function ThemeToggle() {
  const toggle = () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("finpilot-theme", next);
    } catch {
      // Sem armazenamento, o tema vale apenas para esta página.
    }
  };
  return (
    <Button variant="ghost" className="w-11 px-0" aria-label="Alternar tema claro ou escuro" onClick={toggle}>
      <Sun aria-hidden className="hidden size-5 [[data-theme=dark]_&]:block" />
      <Moon aria-hidden className="size-5 [[data-theme=dark]_&]:hidden" />
    </Button>
  );
}
