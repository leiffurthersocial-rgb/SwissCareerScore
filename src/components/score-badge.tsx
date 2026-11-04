import { cn } from "@/lib/utils";

/** Colour band for a 0–100 score (text stays dark/light for AA contrast in both themes). */
export function scoreTone(score: number | null | undefined): string {
  if (score === null || score === undefined) return "bg-muted text-muted-foreground";
  if (score >= 70) return "bg-[var(--good-bg)] text-[var(--good-fg)]";
  if (score >= 55) return "bg-[var(--ok-bg)] text-[var(--ok-fg)]";
  if (score >= 40) return "bg-[var(--mid-bg)] text-[var(--mid-fg)]";
  return "bg-[var(--low-bg)] text-[var(--low-fg)]";
}

export function ScoreBadge({ score, size = "md", label }: { score: number | null | undefined; size?: "sm" | "md" | "lg"; label?: string }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-xl font-bold tabular-nums",
        size === "lg" ? "size-16 text-2xl" : size === "sm" ? "size-8 text-sm" : "size-11 text-lg",
        scoreTone(score),
      )}
      aria-label={label}
    >
      {score === null || score === undefined ? "–" : Math.round(score)}
    </span>
  );
}
