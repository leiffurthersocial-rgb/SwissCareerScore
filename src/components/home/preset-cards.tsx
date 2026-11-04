"use client";
import { Brain, Coins, Rocket, Scale, ShieldCheck, Sofa } from "lucide-react";
import { useTranslations } from "next-intl";
import { PRESET_IDS, type PresetId } from "@/lib/presets";
import { cn } from "@/lib/utils";

const ICONS: Record<PresetId, typeof Coins> = {
  balanced: Scale,
  money: Coins,
  security: ShieldCheck,
  futureProof: Brain,
  lowStress: Sofa,
  fastStart: Rocket,
};

/** "What matters most to you?" — one click sets a weight preset. */
export function PresetCards({ active, onPick }: { active: string; onPick: (p: PresetId) => void }) {
  const t = useTranslations("home");
  const tw = useTranslations("weights");
  return (
    <section aria-labelledby="presets-h" className="space-y-3">
      <h2 id="presets-h" className="text-xl font-semibold">
        {t("presetsTitle")}
      </h2>
      <div role="group" aria-labelledby="presets-h" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {PRESET_IDS.map((p) => {
          const Icon = ICONS[p];
          const on = active === p;
          return (
            <button
              key={p}
              type="button"
              aria-pressed={on}
              onClick={() => onPick(p)}
              className={cn(
                "flex flex-col items-start gap-2 rounded-xl border p-3 text-left transition-colors",
                on ? "border-primary bg-accent" : "border-border bg-card hover:border-primary/50 hover:bg-muted",
              )}
            >
              <Icon className={cn("size-6", on ? "text-primary" : "text-muted-foreground")} aria-hidden />
              <span className="text-sm font-semibold">{tw(`preset.${p}`)}</span>
              <span className="text-xs text-muted-foreground">{t(`presetDesc.${p}`)}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
