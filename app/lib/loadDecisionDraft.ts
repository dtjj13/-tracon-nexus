import type { LoadProfitInput } from "./loadProfit";
import type { DriverPayRule } from "./loadDecision";

export const LOAD_DECISION_DRAFT_KEY = "tracon-load-decision-draft-v1";

export type LoadDecisionDraft = {
  version: 1;
  pickup: string;
  dropoff: string;
  input: LoadProfitInput;
  driverPayRule?: DriverPayRule;
  savedAt: string;
};

export function isLoadDecisionDraft(
  value: unknown
): value is LoadDecisionDraft {
  if (!value || typeof value !== "object") return false;

  const draft = value as Partial<LoadDecisionDraft>;

  return (
    draft.version === 1 &&
    typeof draft.pickup === "string" &&
    typeof draft.dropoff === "string" &&
    typeof draft.savedAt === "string" &&
    Boolean(draft.input) &&
    typeof draft.input === "object"
  );
}
