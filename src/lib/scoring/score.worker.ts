/// <reference lib="webworker" />
/**
 * Full scoring pipeline (Monte-Carlo uncertainty + sensitivity) off the main thread.
 * The page shows instant point estimates first; this worker fills in bands and fragility.
 */
import { scorable } from "../dataset";
import { scoreEntities } from "./score";
import type { FlawPenaltyId, ScoringMode } from "./curves";
import type { Weights } from "./types";

interface Req {
  key: string;
  weights: Weights;
  mode: ScoringMode;
  flaw: FlawPenaltyId;
}

self.onmessage = (ev: MessageEvent<Req>) => {
  const { key, weights, mode, flaw } = ev.data;
  const results = scoreEntities(scorable, weights, { draws: 200, mode, flawPenalty: flaw });
  (self as unknown as Worker).postMessage({ key, results });
};
