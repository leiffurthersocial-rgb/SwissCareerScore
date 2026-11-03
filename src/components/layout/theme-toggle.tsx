"use client";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

export function ThemeToggle() {
  const t = useTranslations("theme");
  const { theme, setTheme } = useTheme();
  const mounted = useSyncExternalStore(subscribe, () => true, () => false);
  const order = ["system", "light", "dark"] as const;
  const current = (mounted ? (theme as (typeof order)[number]) : "system") ?? "system";
  const next = order[(order.indexOf(current) + 1) % order.length];
  const Icon = current === "dark" ? Moon : current === "light" ? Sun : Monitor;
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      className="rounded-md p-2 hover:bg-muted"
      aria-label={`${t("toggle")} (${t(current)} → ${t(next)})`}
    >
      <Icon className="size-5" aria-hidden />
    </button>
  );
}
