import type { LaneRateEstimate } from "./loadDecision";

export type HistoricalLaneLoad = {
  pickup?: string | null;
  dropoff?: string | null;
  rate?: number | string | null;
  loaded_miles?: number | string | null;
  status?: string | null;
  updated_at?: string | null;
};

type WeightedRate = {
  ratePerMile: number;
  weight: number;
  ageDays: number | null;
};

const STATE_NAMES: Record<string, string> = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
};

const STATE_CODES = new Set(Object.values(STATE_NAMES));

export function estimateReturnLaneRate(
  loads: HistoricalLaneLoad[],
  outboundPickup: string,
  outboundDropoff: string,
  returnLoadedMiles: number
): LaneRateEstimate {
  const originState = extractState(outboundDropoff);
  const destinationState = extractState(outboundPickup);
  const laneLabel =
    originState && destinationState
      ? `${originState} → ${destinationState}`
      : "Return lane";

  if (!originState || !destinationState) {
    return emptyEstimate(laneLabel);
  }

  const matchingRates = loads
    .filter((load) => {
      const status = String(load.status ?? "").trim().toLowerCase();
      const isCompleted =
        !status || status === "delivered" || status === "complete";

      return (
        isCompleted &&
        extractState(load.pickup ?? "") === originState &&
        extractState(load.dropoff ?? "") === destinationState
      );
    })
    .map(toWeightedRate)
    .filter((rate): rate is WeightedRate => rate !== null);

  if (matchingRates.length === 0) {
    return emptyEstimate(laneLabel);
  }

  const sortedRates = matchingRates
    .map((item) => item.ratePerMile)
    .sort((a, b) => a - b);
  const median = sortedRates[Math.floor(sortedRates.length / 2)];
  const usableRates = matchingRates.filter(
    (item) =>
      item.ratePerMile >= median * 0.5 && item.ratePerMile <= median * 2
  );
  const totalWeight = usableRates.reduce((sum, item) => sum + item.weight, 0);
  const ratePerMile =
    totalWeight > 0
      ? usableRates.reduce(
          (sum, item) => sum + item.ratePerMile * item.weight,
          0
        ) / totalWeight
      : null;
  const knownAges = usableRates
    .map((item) => item.ageDays)
    .filter((age): age is number => age !== null);
  const newestLoadAgeDays = knownAges.length > 0 ? Math.min(...knownAges) : null;
  const confidence = getConfidence(usableRates.length, newestLoadAgeDays);

  return {
    source: "tracon-history",
    ratePerMile: ratePerMile === null ? null : round(ratePerMile, 2),
    estimatedRevenue:
      ratePerMile !== null && returnLoadedMiles > 0
        ? round(ratePerMile * returnLoadedMiles, 2)
        : null,
    sampleSize: usableRates.length,
    confidence,
    newestLoadAgeDays,
    laneLabel,
  };
}

function toWeightedRate(load: HistoricalLaneLoad): WeightedRate | null {
  const revenue = Number(load.rate);
  const miles = Number(load.loaded_miles);
  const ratePerMile = revenue / miles;

  if (
    !Number.isFinite(revenue) ||
    !Number.isFinite(miles) ||
    miles <= 0 ||
    !Number.isFinite(ratePerMile) ||
    ratePerMile < 0.75 ||
    ratePerMile > 10
  ) {
    return null;
  }

  const ageDays = getAgeDays(load.updated_at);

  return {
    ratePerMile,
    ageDays,
    weight: getAgeWeight(ageDays),
  };
}

function extractState(address: string): string | null {
  const normalized = address.trim();
  if (!normalized) return null;

  const stateBeforeZip = normalized.match(/(?:,|\s)\s*([A-Z]{2})\s+\d{5}(?:-\d{4})?\b/i);
  if (stateBeforeZip) {
    const code = stateBeforeZip[1].toUpperCase();
    if (STATE_CODES.has(code)) return code;
  }

  const commaParts = normalized.split(",").map((part) => part.trim());
  for (let index = commaParts.length - 1; index >= 0; index -= 1) {
    const codeMatch = commaParts[index].match(/^([A-Z]{2})(?:\s+\d{5}(?:-\d{4})?)?$/i);
    if (codeMatch) {
      const code = codeMatch[1].toUpperCase();
      if (STATE_CODES.has(code)) return code;
    }
  }

  const lowerAddress = normalized.toLowerCase();
  for (const [name, code] of Object.entries(STATE_NAMES)) {
    if (new RegExp(`\\b${name.replace(" ", "\\s+")}\\b`, "i").test(lowerAddress)) {
      return code;
    }
  }

  return null;
}

function getAgeDays(value?: string | null): number | null {
  if (!value) return null;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, Math.floor((Date.now() - timestamp) / 86_400_000));
}

function getAgeWeight(ageDays: number | null): number {
  if (ageDays === null) return 0.35;
  if (ageDays <= 90) return 3;
  if (ageDays <= 180) return 2;
  if (ageDays <= 365) return 1.5;
  if (ageDays <= 730) return 1;
  return 0.35;
}

function getConfidence(
  sampleSize: number,
  newestLoadAgeDays: number | null
): LaneRateEstimate["confidence"] {
  if (sampleSize >= 8 && newestLoadAgeDays !== null && newestLoadAgeDays <= 90) {
    return "high";
  }
  if (
    sampleSize >= 3 &&
    newestLoadAgeDays !== null &&
    newestLoadAgeDays <= 365
  ) {
    return "medium";
  }
  return "low";
}

function emptyEstimate(laneLabel: string): LaneRateEstimate {
  return {
    source: "none",
    ratePerMile: null,
    estimatedRevenue: null,
    sampleSize: 0,
    confidence: "none",
    newestLoadAgeDays: null,
    laneLabel,
  };
}

function round(value: number, decimals: number): number {
  const multiplier = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * multiplier) / multiplier;
}
