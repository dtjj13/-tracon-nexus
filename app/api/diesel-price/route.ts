import { NextResponse } from "next/server";

export const runtime = "nodejs";

const EIA_SERIES_URL = "https://api.eia.gov/v2/seriesid";

const REGION_CONFIG = {
  new_england: {
    label: "New England",
    series: "PET.EMD_EPD2D_PTE_R1X_DPG.W",
  },
  central_atlantic: {
    label: "Central Atlantic",
    series: "PET.EMD_EPD2D_PTE_R1Y_DPG.W",
  },
  lower_atlantic: {
    label: "Lower Atlantic",
    series: "PET.EMD_EPD2D_PTE_R1Z_DPG.W",
  },
  midwest: {
    label: "Midwest",
    series: "PET.EMD_EPD2D_PTE_R20_DPG.W",
  },
  gulf_coast: {
    label: "Gulf Coast",
    series: "PET.EMD_EPD2D_PTE_R30_DPG.W",
  },
  rocky_mountain: {
    label: "Rocky Mountain",
    series: "PET.EMD_EPD2D_PTE_R40_DPG.W",
  },
  west_coast_excluding_california: {
    label: "West Coast excluding California",
    series: "PET.EMD_EPD2D_PTE_R5XCA_DPG.W",
  },
  california: {
    label: "California",
    series: "PET.EMD_EPD2D_PTE_SCA_DPG.W",
  },
  united_states: {
    label: "United States",
    series: "PET.EMD_EPD2D_PTE_NUS_DPG.W",
  },
} as const;

type RegionKey = keyof typeof REGION_CONFIG;

const STATE_TO_REGION: Record<string, RegionKey> = {
  CT: "new_england",
  ME: "new_england",
  MA: "new_england",
  NH: "new_england",
  RI: "new_england",
  VT: "new_england",

  DE: "central_atlantic",
  DC: "central_atlantic",
  MD: "central_atlantic",
  NJ: "central_atlantic",
  NY: "central_atlantic",
  PA: "central_atlantic",

  FL: "lower_atlantic",
  GA: "lower_atlantic",
  NC: "lower_atlantic",
  SC: "lower_atlantic",
  VA: "lower_atlantic",
  WV: "lower_atlantic",

  IL: "midwest",
  IN: "midwest",
  IA: "midwest",
  KS: "midwest",
  KY: "midwest",
  MI: "midwest",
  MN: "midwest",
  MO: "midwest",
  NE: "midwest",
  ND: "midwest",
  OH: "midwest",
  OK: "midwest",
  SD: "midwest",
  TN: "midwest",
  WI: "midwest",

  AL: "gulf_coast",
  AR: "gulf_coast",
  LA: "gulf_coast",
  MS: "gulf_coast",
  NM: "gulf_coast",
  TX: "gulf_coast",

  CO: "rocky_mountain",
  ID: "rocky_mountain",
  MT: "rocky_mountain",
  UT: "rocky_mountain",
  WY: "rocky_mountain",

  AK: "west_coast_excluding_california",
  AZ: "west_coast_excluding_california",
  HI: "west_coast_excluding_california",
  NV: "west_coast_excluding_california",
  OR: "west_coast_excluding_california",
  WA: "west_coast_excluding_california",

  CA: "california",
};

class DieselPriceError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

type StateMileage = {
  state: string;
  miles: number;
};

type LatestPrice = {
  price: number;
  period: string;
};

export async function POST(request: Request) {
  try {
    const apiKey = process.env.EIA_API_KEY?.trim();

    if (!apiKey) {
      throw new DieselPriceError(
        "Regional diesel pricing is not configured yet.",
        503
      );
    }

    const body = (await request.json()) as {
      state_miles?: unknown;
    };

    const stateMiles = readStateMiles(body.state_miles);
    const milesByRegion = groupMilesByRegion(stateMiles);

    const regions = await Promise.all(
      Array.from(milesByRegion.entries()).map(
        async ([region, miles]) => {
          const config = REGION_CONFIG[region];
          const latest = await fetchLatestPrice(
            config.series,
            apiKey
          );

          return {
            region,
            region_name: config.label,
            miles: round(miles, 1),
            price_per_gallon: round(latest.price, 3),
            as_of: latest.period,
          };
        }
      )
    );

    const totalMiles = regions.reduce(
      (total, region) => total + region.miles,
      0
    );

    const weightedPrice =
      totalMiles > 0
        ? regions.reduce(
            (total, region) =>
              total +
              region.miles * region.price_per_gallon,
            0
          ) / totalMiles
        : 0;

    return NextResponse.json({
      price_per_gallon: round(weightedPrice, 3),
      source:
        "U.S. EIA weekly regional retail diesel prices",
      as_of: regions
        .map((region) => region.as_of)
        .sort()
        .at(-1),
      total_route_miles: round(totalMiles, 1),
      regions,
    });
  } catch (error: unknown) {
    if (error instanceof DieselPriceError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    console.error(
      "Regional diesel pricing failed:",
      error
    );

    return NextResponse.json(
      {
        error:
          "Regional diesel pricing is temporarily unavailable. The company default will be used.",
      },
      { status: 500 }
    );
  }
}

function readStateMiles(value: unknown): StateMileage[] {
  if (!Array.isArray(value)) {
    throw new DieselPriceError(
      "Route state mileage is required for diesel pricing.",
      400
    );
  }

  const stateMiles = value.flatMap((item) => {
    const record = isRecord(item) ? item : null;

    const state =
      typeof record?.state === "string"
        ? record.state.trim().toUpperCase()
        : "";

    const miles = toPositiveNumber(record?.miles);

    if (!state || miles === null) {
      return [];
    }

    return [{ state, miles }];
  });

  if (stateMiles.length === 0) {
    throw new DieselPriceError(
      "Route state mileage is required for diesel pricing.",
      400
    );
  }

  return stateMiles;
}

function groupMilesByRegion(
  stateMiles: StateMileage[]
) {
  const grouped = new Map<RegionKey, number>();

  for (const item of stateMiles) {
    const region =
      STATE_TO_REGION[item.state] ?? "united_states";

    grouped.set(
      region,
      (grouped.get(region) ?? 0) + item.miles
    );
  }

  return grouped;
}

async function fetchLatestPrice(
  series: string,
  apiKey: string
): Promise<LatestPrice> {
  const url = new URL(`${EIA_SERIES_URL}/${series}`);

  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("length", "1");
  url.searchParams.set(
    "sort[0][column]",
    "period"
  );
  url.searchParams.set(
    "sort[0][direction]",
    "desc"
  );

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
    },
    next: {
      revalidate: 21_600,
    },
    signal: AbortSignal.timeout(12_000),
  });

  const payload = (await response.json()) as unknown;

  if (!response.ok) {
    console.error(
      "EIA diesel price error:",
      payload
    );

    throw new DieselPriceError(
      "Regional diesel pricing is temporarily unavailable.",
      502
    );
  }

  const envelope =
    isRecord(payload) &&
    isRecord(payload.response)
      ? payload.response
      : null;

  const data = Array.isArray(envelope?.data)
    ? envelope.data
    : [];

  const latest = isRecord(data[0])
    ? data[0]
    : null;

  const price = toPositiveNumber(latest?.value);

  const period =
    typeof latest?.period === "string"
      ? latest.period
      : "";

  if (price === null || !period) {
    throw new DieselPriceError(
      "Regional diesel pricing is temporarily unavailable.",
      502
    );
  }

  return {
    price,
    period,
  };
}

function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null
  );
}

function toPositiveNumber(
  value: unknown
): number | null {
  if (
    typeof value !== "string" &&
    typeof value !== "number"
  ) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number) &&
    number > 0
    ? number
    : null;
}

function round(
  value: number,
  decimals: number
) {
  const multiplier = 10 ** decimals;

  return (
    Math.round(
      (value + Number.EPSILON) * multiplier
    ) / multiplier
  );
}