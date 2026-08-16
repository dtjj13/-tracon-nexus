import { NextResponse } from "next/server";

export const runtime = "nodejs";

const SEARCH_URL = "https://singlesearch.alk.com/NA/api/search";
const ROUTE_URL =
  "https://pcmiler.alk.com/apis/rest/v1.0/Service.svc/route/routeReports?dataVersion=Current";

type Coordinates = {
  lat: number;
  lon: number;
  label: string;
};

class MileageError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.TRIMBLE_MAPS_API_KEY?.trim();

    if (!apiKey) {
      throw new MileageError(
        "Truck mileage service is not configured yet.",
        503
      );
    }

    const body = (await request.json()) as {
      pickup?: unknown;
      dropoff?: unknown;
    };

    const pickup = readLocation(body.pickup, "pickup");
    const dropoff = readLocation(body.dropoff, "dropoff");

    const [origin, destination] = await Promise.all([
      findLocation(pickup, "pickup", apiKey),
      findLocation(dropoff, "dropoff", apiKey),
    ]);

    const routeResponse = await fetch(ROUTE_URL, {
      method: "POST",
      headers: {
        Authorization: apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        ReportRoutes: [
          {
            RouteId: "tracon-loaded-mileage",
            Stops: [
              {
                Address: null,
                Coords: {
                  Lat: String(origin.lat),
                  Lon: String(origin.lon),
                },
                Region: 4,
                Label: "Pickup",
              },
              {
                Address: null,
                Coords: {
                  Lat: String(destination.lat),
                  Lon: String(destination.lon),
                },
                Region: 4,
                Label: "Dropoff",
              },
            ],
            Options: {
              VehicleType: 0,
              RoutingType: 0,
              HighwayOnly: false,
              DistanceUnits: 0,
              TollRoads: 3,
            },
           ReportTypes: [
  {
    __type:
      "CalculateMilesReportType:http://pcmiler.alk.com/APIs/v1.0",
  },
  {
    __type:
      "StateReportType:http://pcmiler.alk.com/APIs/v1.0",
    SortByRoute: false,
  },
],
          },
        ],
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });

    const reports = (await routeResponse.json()) as unknown;

    if (!routeResponse.ok) {
      console.error("Trimble mileage error:", reports);
      throw new MileageError(
        "Truck mileage could not be calculated. Enter it manually.",
        502
      );
    }

    const miles = getMiles(reports);
const stateMiles = getStateMiles(reports);

    if (miles === null || miles <= 0) {
      throw new MileageError(
        "Truck mileage could not be calculated. Enter it manually.",
        422
      );
    }

    return NextResponse.json({
      miles: Number(miles.toFixed(1)),
      source: "Trimble PC*Miler practical truck route",
      pickup_match: origin.label,
      dropoff_match: destination.label,
      state_miles: stateMiles,
    });
  } catch (error: unknown) {
    if (error instanceof MileageError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    console.error("Route mileage failed:", error);

    return NextResponse.json(
      { error: "Truck mileage could not be calculated. Enter it manually." },
      { status: 500 }
    );
  }
}

async function findLocation(
  location: string,
  field: "pickup" | "dropoff",
  apiKey: string
): Promise<Coordinates> {
  const url = new URL(SEARCH_URL);
  url.searchParams.set("query", location);
  url.searchParams.set("maxResults", "1");

  const response = await fetch(url, {
    headers: { Authorization: apiKey },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });

  const results = (await response.json()) as unknown;

  if (!response.ok) {
    throw new MileageError(
      "Address search is temporarily unavailable. Enter the miles manually.",
      502
    );
  }

 const envelope = isRecord(results) ? results : null;

const locations = Array.isArray(envelope?.Locations)
  ? envelope.Locations
  : Array.isArray(results)
    ? results
    : [];

const first = locations[0];
  const result = isRecord(first) ? first : null;
  const coords = isRecord(result?.Coords) ? result.Coords : null;
  const lat = toNumber(coords?.Lat);
  const lon = toNumber(coords?.Lon);

  if (lat === null || lon === null) {
    throw new MileageError(
      `We could not match the ${field}. Check the address or enter the miles manually.`,
      422
    );
  }

  return {
    lat,
    lon,
    label:
      typeof result?.ShortString === "string"
        ? result.ShortString
        : location,
  };
}

function readLocation(value: unknown, field: "pickup" | "dropoff") {
  if (typeof value !== "string" || !value.trim()) {
    throw new MileageError(
      `Enter the ${field} before estimating mileage.`,
      400
    );
  }

  return value.trim();
}

function getMiles(value: unknown): number | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const miles = getMiles(item);
      if (miles !== null) return miles;
    }
  }

  if (isRecord(value)) {
    const directMiles = toNumber(value.TMiles);
    if (directMiles !== null) return directMiles;

    for (const item of Object.values(value)) {
      const miles = getMiles(item);
      if (miles !== null) return miles;
    }
  }

  return null;
}
type StateMileage = {
  state: string;
  miles: number;
};

function getStateMiles(value: unknown): StateMileage[] {
  if (Array.isArray(value)) {
    for (const item of value) {
      const stateMiles = getStateMiles(item);

      if (stateMiles.length > 0) {
        return stateMiles;
      }
    }
  }

  if (isRecord(value)) {
    if (Array.isArray(value.StateReportLines)) {
      return value.StateReportLines.flatMap((line) => {
        const record = isRecord(line) ? line : null;

        const state =
          typeof record?.StCntry === "string"
            ? record.StCntry.trim().toUpperCase()
            : "";

        const miles = toNumber(record?.Total);

        if (
  !state ||
  state === "US" ||
  state === "TOTAL" ||
  miles === null ||
  miles <= 0
) {
          return [];
        }

        return [
          {
            state,
            miles: Number(miles.toFixed(1)),
          },
        ];
      });
    }

    for (const item of Object.values(value)) {
      const stateMiles = getStateMiles(item);

      if (stateMiles.length > 0) {
        return stateMiles;
      }
    }
  }

  return [];
}
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toNumber(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
