import data from "../../data/derived/programmes.json";
import type { ProgrammeCatalogue } from "./dataset-types";

/** Higher-education catalogue: programmes after the Matura, institutions, blended outcomes. */
export const catalogue = data as unknown as ProgrammeCatalogue;
export const INSTITUTION_TYPES = ["ETH", "UH", "FH", "PH"] as const;
