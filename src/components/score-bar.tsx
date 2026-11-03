/** Horizontal 0–100 bar with point estimate and P10–P90 band. Decorative; values are given as text too. */
export function ScoreBar({ value, lo, hi }: { value: number; lo?: number; hi?: number }) {
  return (
    <div className="relative h-2.5 w-full rounded-full bg-muted" aria-hidden>
      {lo !== undefined && hi !== undefined ? (
        <div className="absolute inset-y-0 rounded-full bg-band" style={{ left: `${lo}%`, width: `${Math.max(1, hi - lo)}%` }} />
      ) : null}
      <div className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-primary" style={{ left: `${value}%` }} />
    </div>
  );
}
