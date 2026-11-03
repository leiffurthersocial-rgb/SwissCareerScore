"use client";
import { Scale } from "lucide-react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import type { DimensionId } from "@/lib/dimensions";
import { ahpWeights, allPairs, buildMatrix } from "@/lib/scoring";

/** Dimensions are grouped into 5 clusters → 10 questions instead of 66. */
export const AHP_GROUPS: { id: string; dims: DimensionId[] }[] = [
  { id: "money", dims: ["pay", "careerGrowth"] },
  { id: "security", dims: ["stability", "demand", "aiResilience"] },
  { id: "effort", dims: ["trainingEase", "entryAccess", "timeToQualify"] },
  { id: "lifestyle", dims: ["workLifeBalance", "flexibility"] },
  { id: "place", dims: ["mobility", "regional"] },
];

// Saaty scale positions: index 0..8 → value for "left more important" … "right more important"
const SCALE = [9, 7, 5, 3, 1, 1 / 3, 1 / 5, 1 / 7, 1 / 9];
const LABELS = ["extremely", "strongly", "moderately", "slightly", "equal", "slightly", "moderately", "strongly", "extremely"] as const;

/** Turn group weights into dimension weights (split equally within a group). */
export function groupToDimensionWeights(groupWeights: number[]): Partial<Record<DimensionId, number>> {
  const out: Partial<Record<DimensionId, number>> = {};
  AHP_GROUPS.forEach((g, i) => g.dims.forEach((d) => (out[d] = (groupWeights[i] * 100) / g.dims.length)));
  return out;
}

export function AhpWizard({ onApply }: { onApply: (w: Partial<Record<DimensionId, number>>) => void }) {
  const t = useTranslations("ahp");
  const tw = useTranslations("weights");
  const tc = useTranslations("common");
  const pairs = useMemo(() => allPairs(AHP_GROUPS.length), []);
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState<number[]>(() => pairs.map(() => 4));
  const [step, setStep] = useState(0);
  const done = step >= pairs.length;
  const result = useMemo(
    () => ahpWeights(buildMatrix(AHP_GROUPS.length, pairs.map(([a, b], i) => ({ a, b, value: SCALE[answers[i]] })))),
    [answers, pairs],
  );

  const reset = () => {
    setStep(0);
    setAnswers(pairs.map(() => 4));
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="subtle" size="sm" className="w-full">
          <Scale aria-hidden /> {tw("wizard")}
        </Button>
      </DialogTrigger>
      <DialogContent title={t("title")} description={t("desc")} closeLabel={tc("close")}>
        {!done ? (
          <fieldset>
            <legend className="mb-1 text-sm text-muted-foreground">{t("progress", { n: step + 1, total: pairs.length })}</legend>
            <p className="mb-4 font-medium">{t("question")}</p>
            <div className="mb-2 grid grid-cols-2 gap-2 text-sm font-semibold">
              <span>{t(`groups.${AHP_GROUPS[pairs[step][0]].id}`)}</span>
              <span className="text-right">{t(`groups.${AHP_GROUPS[pairs[step][1]].id}`)}</span>
            </div>
            <div className="grid grid-cols-9 gap-1" role="radiogroup" aria-label={t("question")}>
              {SCALE.map((_, i) => (
                <label key={i} className="flex cursor-pointer flex-col items-center gap-1 text-center">
                  <input
                    type="radio"
                    name={`ahp-${step}`}
                    className="size-5 accent-[var(--primary)]"
                    checked={answers[step] === i}
                    onChange={() => setAnswers((a) => a.map((x, k) => (k === step ? i : x)))}
                  />
                  <span className="text-[10px] leading-tight text-muted-foreground sm:text-xs">{t(LABELS[i])}</span>
                </label>
              ))}
            </div>
            <div className="mt-6 flex justify-between">
              <Button variant="outline" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
                {t("back")}
              </Button>
              <Button onClick={() => setStep((s) => s + 1)}>{t("next")}</Button>
            </div>
          </fieldset>
        ) : (
          <div>
            <h3 className="mb-3 font-semibold">{t("result")}</h3>
            <ul className="mb-4 space-y-2">
              {AHP_GROUPS.map((g, i) => (
                <li key={g.id} className="text-sm">
                  <div className="flex justify-between">
                    <span>{t(`groups.${g.id}`)}</span>
                    <span className="tabular-nums">{(result.weights[i] * 100).toFixed(0)} %</span>
                  </div>
                  <div className="mt-1 h-2 rounded bg-muted">
                    <div className="h-2 rounded bg-primary" style={{ width: `${result.weights[i] * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
            <p className={result.consistent ? "text-sm text-success" : "text-sm text-warning"} role="status">
              {t("consistency", { cr: result.consistencyRatio.toFixed(2) })} — {result.consistent ? t("consistent") : t("inconsistent")}
            </p>
            <div className="mt-6 flex justify-between">
              <Button variant="outline" onClick={() => setStep(pairs.length - 1)}>
                {t("back")}
              </Button>
              <Button
                onClick={() => {
                  onApply(groupToDimensionWeights(result.weights));
                  setOpen(false);
                }}
              >
                {t("apply")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
