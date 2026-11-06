import { NextResponse } from "next/server";

export const runtime = "nodejs";

const GEOCODE_URL = "https://graphhopper.com/api/1/geocode";
const ROUTE_URL = "https://graphhopper.com/api/1/route";
const METERS_PER_MILE = 1609.344;

type Coordinates = {
  lat: number;
  lon: number;
  label: string;
};

type GraphHopperPath = {
  distance?: unknown;
  time?: unknown;
  bbox?: unknown;
  points?: unknown;
};

type RouteTruck = {
  heightFt: number | null;
  widthFt: number | null;
  lengthFt: number | null;
  grossWeightLbs: number | null;
  axleLoadLbs: number | null;
  hazmat: boolean;
  avoidTolls: boolean;
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
    const apiKey = process.env.GRAPHHOPPER_API_KEY?.trim();
    const profile = process.env.GRAPHHOPPER_PROFILE?.trim() || "truck";

    if (!apiKey) {
      throw new MileageError(
        "GraphHopper routing is not configured yet. Add the API key or enter miles manually.",
        503
      );
    }

    const body = (await request.json()) as {
      pickup?: unknown;
      dropoff?: unknown;
      truck?: unknown;
    };

    const pickup = readLocation(body.pickup, "pickup");
    const dropoff = readLocation(body.dropoff, "dropoff");
    const truck = readTruck(body.truck);

    const [origin, destination] = await Promise.all([
      findLocation(pickup, "pickup", apiKey),
      findLocation(dropoff, "dropoff", apiKey),
    ]);

    const url = new URL(ROUTE_URL);
    url.searchParams.set("key", apiKey);

    const customModel = buildTruckCustomModel(truck);
    const routeRequest: Record<string, unknown> = {
      profile,
      points: [
        [origin.lon, origin.lat],
        [destination.lon, destination.lat],
      ],
      points_encoded: false,
      instructions: true,
      locale: "en-US",
      calc_points: true,
    };

    if (customModel) {
      routeRequest["ch.disable"] = true;
      routeRequest.custom_model = customModel;
    }

    const routeResponse = await fetch(url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(routeRequest),
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
    });

    const payload = (await routeResponse.json()) as unknown;

    if (!routeResponse.ok) {
      console.error("GraphHopper routing error:", safeProviderMessage(payload));
      throw new MileageError(
        providerErrorMessage(payload) ||
          "The route could not be calculated. Check the locations or enter miles manually.",
        routeResponse.status === 429 ? 429 : 502
      );
    }

    const envelope = isRecord(payload) ? payload : null;
    const path = Array.isArray(envelope?.paths)
      ? (envelope.paths[0] as GraphHopperPath | undefined)
      : undefined;
    const distanceMeters = toPositiveNumber(path?.distance);
    const timeMilliseconds = toPositiveNumber(path?.time);
    const routeCoordinates = readRouteCoordinates(path?.points);

    if (distanceMeters === null || routeCoordinates.length < 2) {
      throw new MileageError(
        "The route could not be calculated. Check the locations or enter miles manually.",
        422
      );
    }

    const miles = distanceMeters / METERS_PER_MILE;
    const roundedMiles = Number(miles.toFixed(1));
    const durationMinutes = timeMilliseconds
      ? Math.round(timeMilliseconds / 60_000)
      : null;

    return NextResponse.json({
      miles: roundedMiles,
      duration_minutes: durationMinutes,
      source: `GraphHopper ${profile.replaceAll("_", " ")} route`,
      routing_profile: profile,
      truck_restrictions_applied: listAppliedTruckRestrictions(truck),
      pickup_match: origin.label,
      dropoff_match: destination.label,
      route: {
        type: "LineString",
        coordinates: routeCoordinates,
      },
      bbox: readBoundingBox(path?.bbox),
      // GraphHopper does not return state-by-state mileage. Passing the route
      // total as US mileage lets the existing EIA integration use the weekly
      // national diesel price instead of pretending it is a regional average.
      state_miles: [{ state: "US", miles: roundedMiles }],
      advisory: customModel
        ? "Vehicle restrictions were applied. Drivers must still follow posted restrictions and dispatch instructions."
        : "Generic truck route. Add the truck dimensions in Fleet Settings for vehicle-specific restrictions.",
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
      { error: "The route could not be calculated. Enter miles manually." },
      { status: 500 }
    );
  }
}

function readTruck(value: unknown): RouteTruck {
  if (value === undefined || value === null) return emptyTruck();

  if (!isRecord(value)) {
    throw new MileageError("The selected truck routing profile is invalid.", 400);
  }

  return {
    heightFt: readOptionalTruckNumber(value, "height_ft", 20, "height"),
    widthFt: readOptionalTruckNumber(value, "width_ft", 15, "width"),
    lengthFt: readOptionalTruckNumber(value, "length_ft", 150, "length"),
    grossWeightLbs: readOptionalTruckNumber(
      value,
      "gross_weight_lbs",
      200_000,
      "gross weight"
    ),
    axleLoadLbs: readOptionalTruckNumber(
      value,
      "axle_load_lbs",
      80_000,
      "axle load"
    ),
    hazmat: readOptionalBoolean(value, "hazmat"),
    avoidTolls: readOptionalBoolean(value, "avoid_tolls"),
  };
}

function emptyTruck(): RouteTruck {
  return {
    heightFt: null,
    widthFt: null,
    lengthFt: null,
    grossWeightLbs: null,
    axleLoadLbs: null,
    hazmat: false,
    avoidTolls: false,
  };
}

function readOptionalTruckNumber(
  value: Record<string, unknown>,
  key: string,
  maximum: number,
  label: string
) {
  const raw = value[key];
  if (raw === undefined || raw === null || raw === "") return null;

  const number = toNumber(raw);
  if (number === null || number <= 0 || number > maximum) {
    throw new MileageError(`The truck ${label} is outside the supported range.`, 400);
  }

  return number;
}

function readOptionalBoolean(value: Record<string, unknown>, key: string) {
  const raw = value[key];
  if (raw === undefined || raw === null) return false;
  if (typeof raw !== "boolean") {
    throw new MileageError("The selected truck routing profile is invalid.", 400);
  }
  return raw;
}

function buildTruckCustomModel(truck: RouteTruck) {
  const priority: Array<{
    if: string;
    multiply_by: string;
  }> = [];

  addBlockingRule(priority, "max_height", feetToMeters(truck.heightFt));
  addBlockingRule(priority, "max_width", feetToMeters(truck.widthFt));
  addBlockingRule(priority, "max_length", feetToMeters(truck.lengthFt));
  addBlockingRule(
    priority,
    "max_weight",
    poundsToMetricTonnes(truck.grossWeightLbs)
  );
  addBlockingRule(
    priority,
    "max_axle_load",
    poundsToMetricTonnes(truck.axleLoadLbs)
  );

  if (truck.hazmat) {
    priority.push(
      {
        if: "hazmat == NO || hazmat_water == NO",
        multiply_by: "0",
      },
      {
        if: "hazmat_tunnel == D || hazmat_tunnel == E",
        multiply_by: "0",
      }
    );
  }

  if (truck.avoidTolls) {
    priority.push({
      if: "toll == ALL || toll == HGV",
      multiply_by: "0.1",
    });
  }

  return priority.length ? { priority } : null;
}

function addBlockingRule(
  rules: Array<{ if: string; multiply_by: string }>,
  encodedValue: string,
  limit: number | null
) {
  if (limit === null) return;
  rules.push({
    if: `${encodedValue} < ${limit}`,
    multiply_by: "0",
  });
}

function feetToMeters(value: number | null) {
  return value === null ? null : Number((value * 0.3048).toFixed(4));
}

function poundsToMetricTonnes(value: number | null) {
  return value === null ? null : Number((value / 2204.62262185).toFixed(4));
}

function listAppliedTruckRestrictions(truck: RouteTruck) {
  const restrictions: string[] = [];
  if (truck.heightFt !== null) restrictions.push("height");
  if (truck.widthFt !== null) restrictions.push("width");
  if (truck.lengthFt !== null) restrictions.push("length");
  if (truck.grossWeightLbs !== null) restrictions.push("gross weight");
  if (truck.axleLoadLbs !== null) restrictions.push("axle load");
  if (truck.hazmat) restrictions.push("hazmat");
  if (truck.avoidTolls) restrictions.push("avoid tolls");
  return restrictions;
}

async function findLocation(
  location: string,
  field: "pickup" | "dropoff",
  apiKey: string
): Promise<Coordinates> {
  const url = new URL(GEOCODE_URL);
  url.searchParams.set("q", location);
  url.searchParams.set("limit", "1");
  url.searchParams.set("locale", "en");
  url.searchParams.set("key", apiKey);

  const response = await fetch(url, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });

  const payload = (await response.json()) as unknown;

  if (!response.ok) {
    console.error("GraphHopper geocoding error:", safeProviderMessage(payload));
    throw new MileageError(
      "Address search is temporarily unavailable. Enter the miles manually.",
      response.status === 429 ? 429 : 502
    );
  }

  const envelope = isRecord(payload) ? payload : null;
  const hit = Array.isArray(envelope?.hits) && isRecord(envelope.hits[0])
    ? envelope.hits[0]
    : null;
  const point = isRecord(hit?.point) ? hit.point : null;
  const lat = toNumber(point?.lat);
  const lon = toNumber(point?.lng);

  if (lat === null || lon === null) {
    throw new MileageError(
      `We could not match the ${field}. Add a city and state or enter the miles manually.`,
      422
    );
  }

  return {
    lat,
    lon,
    label: formatLocationLabel(hit, location),
  };
}

function readLocation(value: unknown, field: "pickup" | "dropoff") {
  if (typeof value !== "string" || !value.trim()) {
    throw new MileageError(
      `Enter the ${field} before estimating mileage.`,
      400
    );
  }

  const location = value.trim();

  if (location.length > 250) {
    throw new MileageError(`The ${field} location is too long.`, 400);
  }

  return location;
}

function readRouteCoordinates(value: unknown): [number, number][] {
  if (!isRecord(value) || !Array.isArray(value.coordinates)) return [];

  return value.coordinates.flatMap((coordinate) => {
    if (!Array.isArray(coordinate) || coordinate.length < 2) return [];

    const lon = toNumber(coordinate[0]);
    const lat = toNumber(coordinate[1]);

    return lon === null || lat === null ? [] : [[lon, lat] as [number, number]];
  });
}

function readBoundingBox(value: unknown): [number, number, number, number] | null {
  if (!Array.isArray(value) || value.length !== 4) return null;

  const values = value.map(toNumber);

  if (values.some((item) => item === null)) return null;

  return values as [number, number, number, number];
}

function formatLocationLabel(
  hit: Record<string, unknown> | null,
  fallback: string
) {
  if (!hit) return fallback;

  const parts = [hit.name, hit.city, hit.state, hit.country]
    .filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
    .map((value) => value.trim());

  return Array.from(new Set(parts)).join(", ") || fallback;
}

function providerErrorMessage(value: unknown) {
  if (!isRecord(value) || typeof value.message !== "string") return "";

  const message = value.message.trim();

  if (/key|credential|auth/i.test(message)) {
    return "The routing service credentials need attention.";
  }

  if (/profile/i.test(message)) {
    return "The selected truck-routing profile is not available on this GraphHopper plan.";
  }

  return "";
}

function safeProviderMessage(value: unknown) {
  return providerErrorMessage(value) || "Provider request failed";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toNumber(value: unknown): number | null {
  if (typeof value !== "string" && typeof value !== "number") return null;

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function toPositiveNumber(value: unknown): number | null {
  const number = toNumber(value);
  return number !== null && number > 0 ? number : null;
}
