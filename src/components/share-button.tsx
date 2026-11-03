"use client";
import { Check, Link2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ShareButton() {
  const t = useTranslations("share");
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      title={t("help")}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(window.location.href);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          /* clipboard unavailable: the URL bar still holds the state */
        }
      }}
    >
      {copied ? <Check aria-hidden /> : <Link2 aria-hidden />}
      <span aria-live="polite">{copied ? t("copied") : t("copy")}</span>
    </Button>
  );
}
