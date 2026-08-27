import {
  calculateLoadProfit,
  type LoadProfitInput,
  type LoadProfitResult,
} from "./loadProfit";

export type LoadDecisionRecommendation = "book" | "review" | "pass";

export type LoadMode = "full" | "partial";

export type LoadDecisionOptions = {
  targetMarginPercent?: number;
  enforceRevenuePerMilePolicy?: boolean;
  loadMode?: LoadMode;
};

export type LoadBidGuidanceOptions = LoadDecisionOptions;

export type PartialLoadOptions = {
  revenue: number;
  incrementalMiles: number;
  extraDriverPay: number;
  extraExpenses: number;
};

export type LoadDecisionFactorTone =
  | "positive"
  | "warning"
  | "danger"
  | "neutral";

export type LoadDecisionFactor = {
  label: string;
  value: string;
  detail: string;
  tone: LoadDecisionFactorTone;
};

export type LoadDecisionResult = {
  recommendation: LoadDecisionRecommendation;
  loadMode: LoadMode;
  targetMarginPercent: number;
  score: number;
  headline: string;
  summary: string;
  revenuePerLoadedMile: number;
  revenuePerTotalMile: number;
  netProfitPerTotalMile: number;
  deadheadPercent: number;
  profit: LoadProfitResult;
  factors: LoadDecisionFactor[];
};

export type DriverPayRule = {
  type: "CPM" | "Percentage" | "Flat" | "None";
  rate: number;
};

export type LoadBidGuidanceStatus =
  | "target-met"
  | "profitable"
  | "below-break-even";

export type LoadBidGuidance = {
  loadMode: LoadMode;
  currentOffer: number;
  breakEvenBid: number;
  targetMarginBid: number;
  policyBid: number;
  policyFloorApplied: boolean;
  suggestedBid: number;
  targetMarginPercent: number;
  currentProfit: number;
  suggestedProfit: number;
  roomAboveBreakEven: number;
  currentOfferPerLoadedMile: number;
  breakEvenPerLoadedMile: number;
  suggestedPerLoadedMile: number;
  costBreakdown: BidCostBreakdown;
  status: LoadBidGuidanceStatus;
};

export type BidCostBreakdown = {
  driverPay: number;
  fuelCost: number;
  insuranceCost: number;
  factoringCost: number;
  otherExpenses: number;
  totalExpenses: number;
};

export type LaneRateSource = "tracon-history" | "manual" | "provider" | "none";

export type LaneRateConfidence = "high" | "medium" | "low" | "none";

export type LaneRateEstimate = {
  source: LaneRateSource;
  ratePerMile: number | null;
  estimatedRevenue: number | null;
  sampleSize: number;
  confidence: LaneRateConfidence;
  newestLoadAgeDays: number | null;
  laneLabel: string;
};

export type RoundTripRecommendation =
  | "strong"
  | "acceptable"
  | "negotiate"
  | "decline";

export type RoundTripScenario = {
  id: "best" | "expected" | "empty";
  name: string;
  description: string;
  returnRevenue: number;
  totalMiles: number;
  netProfit: number;
  profitPerMile: number;
  profitPerDay: number;
};

export type RoundTripDecisionInput = {
  outbound: LoadProfitInput;
  returnLoadedMiles: number;
  returnDeadheadMiles: number;
  emptyReturnMiles: number;
  returnRatePerMile: number | null;
  reloadProbability: number;
  waitDays: number;
};

export type RoundTripDecisionResult = {
  outbound: LoadDecisionResult;
  recommendation: RoundTripRecommendation;
  headline: string;
  summary: string;
  minimumReturnRatePerMile: number | null;
  scenarios: RoundTripScenario[];
};

export const LOAD_DECISION_POLICY = {
  minBookMarginPercent: 15,
  minBookRevenuePerTotalMile: 2,
  maxBookDeadheadPercent: 25,
  minBookScore: 70,
  minReviewMarginPercent: 5,
  minReviewRevenuePerTotalMile: 1.5,
  minReviewScore: 40,
} as const;

export function createPartialLoadInput(
  input: LoadProfitInput,
  options: PartialLoadOptions
): LoadProfitInput {
  return {
    ...input,
    revenue: positive(options.revenue),
    loadedMiles: positive(options.incrementalMiles),
    deadheadMiles: 0,
    driverPay: positive(options.extraDriverPay),
    manualFuelCost: null,
    otherExpenses: positive(options.extraExpenses),
  };
}

export function evaluateLoadDecision(
  input: LoadProfitInput,
  options: LoadDecisionOptions = {}
): LoadDecisionResult {
  const loadMode = options.loadMode ?? "full";
  const targetMarginPercent = clamp(
    options.targetMarginPercent ?? LOAD_DECISION_POLICY.minBookMarginPercent,
    0,
    80
  );
  const enforceRevenuePerMilePolicy =
    options.enforceRevenuePerMilePolicy ?? (loadMode === "full");
  const profit = calculateLoadProfit(input);
  const revenuePerLoadedMile = divide(input.revenue, input.loadedMiles);
  const revenuePerTotalMile = divide(input.revenue, profit.totalMiles);
  const netProfitPerTotalMile = divide(profit.netProfit, profit.totalMiles);
  const deadheadPercent =
    profit.totalMiles > 0
      ? (Math.max(0, input.deadheadMiles) / profit.totalMiles) * 100
      : 0;

  let score = 0;

  if (profit.profitMargin >= targetMarginPercent + 10) score += 35;
  else if (profit.profitMargin >= targetMarginPercent) score += 27;
  else if (profit.profitMargin >= Math.max(targetMarginPercent - 7, 0))
    score += 18;
  else if (profit.profitMargin >= 0) score += 7;
  else score -= 25;

  if (loadMode === "partial") {
    if (netProfitPerTotalMile >= 1) score += 30;
    else if (netProfitPerTotalMile >= 0.6) score += 24;
    else if (netProfitPerTotalMile >= 0.3) score += 14;
    else if (netProfitPerTotalMile > 0) score += 5;
    else score -= 15;

    score += profit.totalMiles > 0 ? 20 : -5;
  } else {
    if (revenuePerTotalMile >= 2.75) score += 30;
    else if (revenuePerTotalMile >= 2.25) score += 24;
    else if (revenuePerTotalMile >= 1.75) score += 14;
    else if (revenuePerTotalMile >= 1.5) score += 5;
    else score -= 15;

    if (deadheadPercent <= 10) score += 20;
    else if (deadheadPercent <= 20) score += 14;
    else if (deadheadPercent <= 35) score += 6;
    else score -= 5;
  }

  if (profit.netProfit >= 1_000) score += 15;
  else if (profit.netProfit >= 500) score += 12;
  else if (profit.netProfit > 0) score += 6;
  else score -= 25;

  score = Math.max(0, Math.min(100, Math.round(score)));

  const recommendation = getRecommendation({
    score,
    netProfit: profit.netProfit,
    profitMargin: profit.profitMargin,
    revenuePerTotalMile,
    deadheadPercent,
    targetMarginPercent,
    enforceRevenuePerMilePolicy,
    loadMode,
  });

  return {
    recommendation,
    loadMode,
    targetMarginPercent,
    score,
    headline: getHeadline(recommendation, loadMode),
    summary: getSummary(recommendation, profit, loadMode),
    revenuePerLoadedMile,
    revenuePerTotalMile,
    netProfitPerTotalMile,
    deadheadPercent,
    profit,
    factors:
      loadMode === "partial"
        ? [
            {
              label: "Incremental margin",
              value: formatPercent(profit.profitMargin),
              detail: `Target: ${formatPercent(targetMarginPercent)} or higher`,
              tone:
                profit.profitMargin >= targetMarginPercent
                  ? "positive"
                  : profit.netProfit > 0
                    ? "warning"
                    : "danger",
            },
            {
              label: "Profit / added mile",
              value: `${formatMoney(netProfitPerTotalMile)}/mi`,
              detail: "Uses only the miles added by this shipment",
              tone:
                netProfitPerTotalMile >= 0.6
                  ? "positive"
                  : netProfitPerTotalMile > 0
                    ? "warning"
                    : "danger",
            },
            {
              label: "Incremental miles",
              value: `${profit.totalMiles.toLocaleString("en-US", {
                maximumFractionDigits: 1,
              })} mi`,
              detail: "Extra route miles, not the truck's full trip",
              tone: profit.totalMiles > 0 ? "neutral" : "danger",
            },
            {
              label: "Incremental net profit",
              value: formatMoney(profit.netProfit),
              detail: "Additional revenue minus additional costs",
              tone:
                profit.netProfit >= 250
                  ? "positive"
                  : profit.netProfit > 0
                    ? "warning"
                    : "danger",
            },
          ]
        : [
            {
              label: "Net margin",
              value: formatPercent(profit.profitMargin),
              detail: `Target: ${formatPercent(targetMarginPercent)} or higher`,
              tone:
                profit.profitMargin >= targetMarginPercent
                  ? "positive"
                  : profit.profitMargin >=
                      Math.max(targetMarginPercent - 10, 0)
                    ? "warning"
                    : "danger",
            },
            {
              label: "Revenue / total mile",
              value: `${formatMoney(revenuePerTotalMile)}/mi`,
              detail: "Includes loaded and deadhead miles",
              tone:
                revenuePerTotalMile >=
                LOAD_DECISION_POLICY.minBookRevenuePerTotalMile
                  ? "positive"
                  : revenuePerTotalMile >=
                      LOAD_DECISION_POLICY.minReviewRevenuePerTotalMile
                    ? "warning"
                    : "danger",
            },
            {
              label: "Deadhead share",
              value: formatPercent(deadheadPercent),
              detail: "Target: 25% or lower",
              tone:
                deadheadPercent <= LOAD_DECISION_POLICY.maxBookDeadheadPercent
                  ? "positive"
                  : deadheadPercent <= 35
                    ? "warning"
                    : "danger",
            },
            {
              label: "Estimated net profit",
              value: formatMoney(profit.netProfit),
              detail: `${formatMoney(netProfitPerTotalMile)}/total mi after modeled costs`,
              tone:
                profit.netProfit >= 500
                  ? "positive"
                  : profit.netProfit > 0
                    ? "warning"
                    : "danger",
            },
          ],
  };
}

export function evaluateLoadBidGuidance(
  input: LoadProfitInput,
  driverPayRule?: DriverPayRule,
  optionsOrTarget: LoadBidGuidanceOptions | number = {}
): LoadBidGuidance {
  const options =
    typeof optionsOrTarget === "number"
      ? { targetMarginPercent: optionsOrTarget }
      : optionsOrTarget;
  const loadMode = options.loadMode ?? "full";
  const enforceRevenuePerMilePolicy =
    options.enforceRevenuePerMilePolicy ?? (loadMode === "full");
  const currentOffer = positive(input.revenue);
  const targetMargin = clamp(
    options.targetMarginPercent ?? LOAD_DECISION_POLICY.minBookMarginPercent,
    0,
    80
  );
  const currentProfitResult = calculateProfitAtRevenue(
    input,
    currentOffer,
    driverPayRule
  );

  const breakEvenBid = findRevenueFloor(
    input,
    driverPayRule,
    (profit) => profit.netProfit >= 0
  );
  const targetMarginBid = findRevenueFloor(
    input,
    driverPayRule,
    (profit) => profit.profitMargin >= targetMargin
  );
  const policyBid = enforceRevenuePerMilePolicy
    ? currentProfitResult.totalMiles *
      LOAD_DECISION_POLICY.minBookRevenuePerTotalMile
    : 0;
  const suggestedBid = roundCurrencyUp(
    Math.max(breakEvenBid, targetMarginBid, policyBid)
  );
  const suggestedProfitResult = calculateProfitAtRevenue(
    input,
    suggestedBid,
    driverPayRule
  );

  return {
    loadMode,
    currentOffer,
    breakEvenBid,
    targetMarginBid,
    policyBid,
    policyFloorApplied:
      enforceRevenuePerMilePolicy &&
      policyBid >= breakEvenBid &&
      policyBid >= targetMarginBid,
    suggestedBid,
    targetMarginPercent: targetMargin,
    currentProfit: currentProfitResult.netProfit,
    suggestedProfit: suggestedProfitResult.netProfit,
    roomAboveBreakEven: currentOffer - breakEvenBid,
    currentOfferPerLoadedMile: divide(currentOffer, input.loadedMiles),
    breakEvenPerLoadedMile: divide(breakEvenBid, input.loadedMiles),
    suggestedPerLoadedMile: divide(suggestedBid, input.loadedMiles),
    costBreakdown: {
      driverPay: suggestedProfitResult.driverPay,
      fuelCost: suggestedProfitResult.fuelCost,
      insuranceCost: suggestedProfitResult.insuranceCost,
      factoringCost: suggestedProfitResult.factoringCost,
      otherExpenses: suggestedProfitResult.otherExpenses,
      totalExpenses: suggestedProfitResult.totalExpenses,
    },
    status:
      currentOffer < breakEvenBid
        ? "below-break-even"
        : currentOffer >= suggestedBid
          ? "target-met"
          : "profitable",
  };
}

export function findBidForNetProfit(
  input: LoadProfitInput,
  targetNetProfit: number,
  driverPayRule?: DriverPayRule
): number {
  return findRevenueFloor(
    input,
    driverPayRule,
    (profit) => profit.netProfit >= positive(targetNetProfit)
  );
}

export function evaluateRoundTripDecision(
  input: RoundTripDecisionInput
): RoundTripDecisionResult {
  const outbound = evaluateLoadDecision(input.outbound);
  const returnLoadedMiles = positive(input.returnLoadedMiles);
  const returnDeadheadMiles = positive(input.returnDeadheadMiles);
  const emptyReturnMiles = positive(input.emptyReturnMiles);
  const reloadProbability = clamp(input.reloadProbability, 0, 1);
  const waitDays = positive(input.waitDays);
  const returnRatePerMile =
    input.returnRatePerMile !== null && input.returnRatePerMile > 0
      ? input.returnRatePerMile
      : null;
  const driverCostPerMile = divide(
    outbound.profit.driverPay,
    positive(input.outbound.loadedMiles)
  );

  const estimatedReturn = calculateReturnProfit(
    input,
    returnRatePerMile,
    driverCostPerMile
  );
  const bestReturn = calculateReturnProfit(
    input,
    returnRatePerMile === null ? null : returnRatePerMile * 1.1,
    driverCostPerMile
  );
  const emptyReturn = calculateLoadProfit({
    revenue: 0,
    loadedMiles: 0,
    deadheadMiles: emptyReturnMiles,
    driverPay: driverCostPerMile * emptyReturnMiles,
    manualFuelCost: null,
    otherExpenses: 0,
    truckMpg: input.outbound.truckMpg,
    estimatedFuelPrice: input.outbound.estimatedFuelPrice,
    settings: input.outbound.settings,
  });

  const outboundMiles = outbound.profit.totalMiles;
  const expectedReturnProfit =
    estimatedReturn === null
      ? emptyReturn.netProfit
      : estimatedReturn.netProfit * reloadProbability +
        emptyReturn.netProfit * (1 - reloadProbability);
  const expectedReturnRevenue =
    estimatedReturn === null
      ? 0
      : (estimatedReturn.netProfit + estimatedReturn.totalExpenses) *
        reloadProbability;
  const expectedReturnMiles =
    estimatedReturn === null
      ? emptyReturn.totalMiles
      : estimatedReturn.totalMiles * reloadProbability +
        emptyReturn.totalMiles * (1 - reloadProbability);

  const scenarios: RoundTripScenario[] = [
    makeScenario(
      "best",
      "Good backhaul",
      returnRatePerMile === null
        ? "No return-lane rate yet; this currently uses the empty-return result."
        : "Return load pays 10% above the estimated lane rate.",
      bestReturn
        ? bestReturn.netProfit + bestReturn.totalExpenses
        : 0,
      outboundMiles + (bestReturn?.totalMiles ?? emptyReturn.totalMiles),
      outbound.profit.netProfit +
        (bestReturn?.netProfit ?? emptyReturn.netProfit),
      waitDays
    ),
    makeScenario(
      "expected",
      "Expected round trip",
      estimatedReturn === null
        ? "No reliable backhaul rate is available, so the conservative empty-return case is shown."
        : `${Math.round(
            reloadProbability * 100
          )}% chance of securing the estimated return load.`,
      expectedReturnRevenue,
      outboundMiles + expectedReturnMiles,
      outbound.profit.netProfit + expectedReturnProfit,
      waitDays
    ),
    makeScenario(
      "empty",
      "Empty return",
      "No backhaul is secured and the truck returns empty.",
      0,
      outboundMiles + emptyReturn.totalMiles,
      outbound.profit.netProfit + emptyReturn.netProfit,
      waitDays
    ),
  ];

  const expected = scenarios[1];
  const minimumReturnRatePerMile = findMinimumReturnRate(input, driverCostPerMile);
  const recommendation = getRoundTripRecommendation(
    expected.profitPerMile,
    returnRatePerMile
  );

  return {
    outbound,
    recommendation,
    headline: getRoundTripHeadline(recommendation),
    summary: getRoundTripSummary(
      recommendation,
      expected.profitPerMile,
      returnRatePerMile
    ),
    minimumReturnRatePerMile,
    scenarios,
  };
}

function calculateReturnProfit(
  input: RoundTripDecisionInput,
  ratePerMile: number | null,
  driverCostPerMile: number
): LoadProfitResult | null {
  if (ratePerMile === null || input.returnLoadedMiles <= 0) return null;

  return calculateLoadProfit({
    revenue: ratePerMile * positive(input.returnLoadedMiles),
    loadedMiles: positive(input.returnLoadedMiles),
    deadheadMiles: positive(input.returnDeadheadMiles),
    driverPay: driverCostPerMile * positive(input.returnLoadedMiles),
    manualFuelCost: null,
    otherExpenses: 0,
    truckMpg: input.outbound.truckMpg,
    estimatedFuelPrice: input.outbound.estimatedFuelPrice,
    settings: input.outbound.settings,
  });
}

function makeScenario(
  id: RoundTripScenario["id"],
  name: string,
  description: string,
  returnRevenue: number,
  totalMiles: number,
  netProfit: number,
  waitDays: number
): RoundTripScenario {
  const estimatedDays = Math.max(totalMiles / 500 + waitDays, 1);

  return {
    id,
    name,
    description,
    returnRevenue,
    totalMiles,
    netProfit,
    profitPerMile: divide(netProfit, totalMiles),
    profitPerDay: divide(netProfit, estimatedDays),
  };
}

function findMinimumReturnRate(
  input: RoundTripDecisionInput,
  driverCostPerMile: number
): number | null {
  if (input.returnLoadedMiles <= 0) return null;

  const targetProfitPerMile = 0.35;
  let low = 0;
  let high = 10;

  for (let attempt = 0; attempt < 40; attempt += 1) {
    const rate = (low + high) / 2;
    const returnProfit = calculateReturnProfit(input, rate, driverCostPerMile);
    if (!returnProfit) return null;

    const totalMiles =
      evaluateLoadDecision(input.outbound).profit.totalMiles +
      returnProfit.totalMiles;
    const combinedProfit =
      evaluateLoadDecision(input.outbound).profit.netProfit +
      returnProfit.netProfit;

    if (divide(combinedProfit, totalMiles) >= targetProfitPerMile) {
      high = rate;
    } else {
      low = rate;
    }
  }

  return Number(high.toFixed(2));
}

function getRoundTripRecommendation(
  expectedProfitPerMile: number,
  returnRatePerMile: number | null
): RoundTripRecommendation {
  if (returnRatePerMile === null) return "negotiate";
  if (expectedProfitPerMile >= 0.75) return "strong";
  if (expectedProfitPerMile >= 0.35) return "acceptable";
  if (expectedProfitPerMile >= 0) return "negotiate";
  return "decline";
}

function getRoundTripHeadline(
  recommendation: RoundTripRecommendation
): string {
  if (recommendation === "strong") return "Strong round-trip opportunity";
  if (recommendation === "acceptable") return "Round trip can work";
  if (recommendation === "negotiate") return "Protect the return trip";
  return "Round-trip risk is too high";
}

function getRoundTripSummary(
  recommendation: RoundTripRecommendation,
  expectedProfitPerMile: number,
  returnRatePerMile: number | null
): string {
  if (returnRatePerMile === null) {
    return "Add a return-lane rate or connect a market-rate provider before committing to this load.";
  }

  if (recommendation === "strong") {
    return `Expected round-trip profit is ${formatMoney(
      expectedProfitPerMile
    )} per mile after operating costs.`;
  }
  if (recommendation === "acceptable") {
    return `The expected round trip remains profitable at ${formatMoney(
      expectedProfitPerMile
    )} per mile.`;
  }
  if (recommendation === "negotiate") {
    return "Negotiate the outbound rate or secure the backhaul before accepting.";
  }
  return "The expected round trip loses money after the return risk is included.";
}

function calculateProfitAtRevenue(
  input: LoadProfitInput,
  revenue: number,
  driverPayRule?: DriverPayRule
): LoadProfitResult {
  return calculateLoadProfit({
    ...input,
    revenue: positive(revenue),
    driverPay: driverPayForRevenue(input, revenue, driverPayRule),
  });
}

function driverPayForRevenue(
  input: LoadProfitInput,
  revenue: number,
  rule?: DriverPayRule
): number {
  if (!rule) return positive(input.driverPay);
  if (rule.type === "CPM") {
    return positive(input.loadedMiles) * positive(rule.rate);
  }
  if (rule.type === "Percentage") {
    return positive(revenue) * (positive(rule.rate) / 100);
  }
  if (rule.type === "Flat") return positive(rule.rate);
  return 0;
}

function findRevenueFloor(
  input: LoadProfitInput,
  driverPayRule: DriverPayRule | undefined,
  predicate: (profit: LoadProfitResult) => boolean
): number {
  let low = 0;
  let high = Math.max(
    1,
    positive(input.revenue),
    calculateProfitAtRevenue(input, input.revenue, driverPayRule).totalExpenses
  );

  while (
    !predicate(calculateProfitAtRevenue(input, high, driverPayRule)) &&
    high < 10_000_000
  ) {
    high *= 2;
  }

  if (!predicate(calculateProfitAtRevenue(input, high, driverPayRule))) {
    return roundCurrencyUp(high);
  }

  for (let attempt = 0; attempt < 70; attempt += 1) {
    const candidate = (low + high) / 2;
    if (predicate(calculateProfitAtRevenue(input, candidate, driverPayRule))) {
      high = candidate;
    } else {
      low = candidate;
    }
  }

  return roundCurrencyUp(high);
}

function roundCurrencyUp(value: number): number {
  const safeValue = positive(value);
  return safeValue === 0 ? 0 : Math.ceil(safeValue * 100) / 100;
}

function positive(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function getRecommendation({
  score,
  netProfit,
  profitMargin,
  revenuePerTotalMile,
  deadheadPercent,
  targetMarginPercent,
  enforceRevenuePerMilePolicy,
  loadMode,
}: {
  score: number;
  netProfit: number;
  profitMargin: number;
  revenuePerTotalMile: number;
  deadheadPercent: number;
  targetMarginPercent: number;
  enforceRevenuePerMilePolicy: boolean;
  loadMode: LoadMode;
}): LoadDecisionRecommendation {
  if (loadMode === "partial") {
    if (
      score >= LOAD_DECISION_POLICY.minBookScore &&
      netProfit > 0 &&
      profitMargin >= targetMarginPercent
    ) {
      return "book";
    }

    return netProfit > 0 ? "review" : "pass";
  }

  if (
    score >= LOAD_DECISION_POLICY.minBookScore &&
    netProfit > 0 &&
    profitMargin >= targetMarginPercent &&
    (!enforceRevenuePerMilePolicy ||
      revenuePerTotalMile >=
        LOAD_DECISION_POLICY.minBookRevenuePerTotalMile) &&
    deadheadPercent <= LOAD_DECISION_POLICY.maxBookDeadheadPercent
  ) {
    return "book";
  }

  if (
    netProfit <= 0 ||
    profitMargin < Math.max(targetMarginPercent - 10, 0) ||
    (enforceRevenuePerMilePolicy &&
      revenuePerTotalMile <
        LOAD_DECISION_POLICY.minReviewRevenuePerTotalMile) ||
    score < LOAD_DECISION_POLICY.minReviewScore
  ) {
    return "pass";
  }

  return "review";
}

function getHeadline(
  recommendation: LoadDecisionRecommendation,
  loadMode: LoadMode
): string {
  if (loadMode === "partial") {
    if (recommendation === "book") {
      return "Profitable add-on — ready to consider";
    }
    if (recommendation === "review") {
      return "Positive add-on — review the tradeoff";
    }
    return "Add-on loses money — pass or raise the bid";
  }

  if (recommendation === "book") return "Strong load — ready to book";
  if (recommendation === "review") {
    return "Promising load — review the weak spots";
  }
  return "Weak load — renegotiate or pass";
}

function getSummary(
  recommendation: LoadDecisionRecommendation,
  profit: LoadProfitResult,
  loadMode: LoadMode
): string {
  if (loadMode === "partial") {
    if (recommendation === "book") {
      return `${formatMoney(profit.netProfit)} incremental profit at ${formatPercent(profit.profitMargin)} margin. The add-on meets the current target using only its added miles and costs.`;
    }

    if (recommendation === "review") {
      return `The add-on produces ${formatMoney(profit.netProfit)} in incremental profit, but misses the current margin target. Review capacity and operational impact before accepting.`;
    }

    return `The add-on loses ${formatMoney(Math.abs(profit.netProfit))} on incremental costs. Raise the offer or pass.`;
  }

  const projection = `${formatMoney(profit.netProfit)} projected profit at ${formatPercent(profit.profitMargin)} margin.`;

  if (recommendation === "book") {
    return `${projection} The load meets the current booking targets.`;
  }

  if (recommendation === "review") {
    return `${projection} Review rate, deadhead, and operating assumptions before approving it.`;
  }

  return `${projection} Improve the rate or reduce the cost exposure before accepting it.`;
}

function divide(value: number, divisor: number) {
  if (!Number.isFinite(value) || !Number.isFinite(divisor) || divisor <= 0) {
    return 0;
  }

  return value / divisor;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatPercent(value: number) {
  return `${(Number.isFinite(value) ? value : 0).toFixed(1)}%`;
}
