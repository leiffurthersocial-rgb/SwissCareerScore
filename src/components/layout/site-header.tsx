"use client";
import { BarChart3 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link, usePathname } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { LocaleSwitcher } from "./locale-switcher";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader() {
  const t = useTranslations();
  const pathname = usePathname();
  const params = useSearchParams();
  const qs = params.toString();
  const withQs = (p: string) => `${p}${qs ? `?${qs}` : ""}`;
  const links = [
    { href: "/", label: t("nav.ranking") },
    { href: "/compare", label: t("nav.compare") },
    { href: "/methodology", label: t("nav.methodology") },
  ];
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-2">
        <Link href={withQs("/")} className="flex items-center gap-2 font-bold">
          <BarChart3 className="size-5 text-primary" aria-hidden />
          <span>{t("app.title")}</span>
        </Link>
        <nav aria-label={t("nav.menu")} className="flex items-center gap-1 text-sm">
          {links.map((l) => (
            <Link
              key={l.href}
              href={withQs(l.href)}
              aria-current={pathname === l.href ? "page" : undefined}
              className={cn("hidden rounded-md px-2 py-1.5 hover:bg-muted sm:inline-block", pathname === l.href && "font-semibold text-primary")}
            >
              {l.label}
            </Link>
          ))}
          <LocaleSwitcher />
          <ThemeToggle />
        </nav>
      </div>
      <nav aria-label={t("nav.menu")} className="flex justify-around border-t border-border text-sm sm:hidden">
        {links.map((l) => (
          <Link
            key={l.href}
            href={withQs(l.href)}
            aria-current={pathname === l.href ? "page" : undefined}
            className={cn("flex-1 py-2 text-center", pathname === l.href && "font-semibold text-primary")}
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
