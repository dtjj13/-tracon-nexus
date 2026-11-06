import { randomUUID } from "node:crypto";

import { NextResponse } from "next/server";

export const runtime = "nodejs";

const GEOCODING_URL = "https://graphhopper.com/api/1/geocode";
const ROUTING_URL = "https://graphhopper.com/api/1/route";
const METERS_PER_MILE = 1609.344;
const MAX_VIA_STOPS = 3;

type Coordinates = [longitude: number, latitude: number];

type RoutePoint = {
  coordinates: Coordinates;
  label: string;
};

type TruckProfile = {
  heightFeet: number | null;
  widthFeet: number | null;
  lengthFeet: number | null;
  grossWeightPounds: number | null;
  axleLoadPounds: number | null;
  hazmat: boolean;
  avoidTolls: boolean;
};

type GraphHopperInstruction = {
  distance?: unknown;
  interval?: unknown;
  sign?: unknown;
  text?: unknown;
};

class RoutePreviewError extends Error {
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

    if (!apiKey) {
      throw new RoutePreviewError(
        "Truck routing is not configured yet.",
        503
      );
    }

    if (request.headers.get("x-client-id") !== "tracon-maps-mobile") {
      throw new RoutePreviewError("This route client is not supported.", 403);
    }

    const body = (await request.json()) as unknown;
    const payload = isRecord(body) ? body : null;

    if (!payload) {
      throw new RoutePreviewError("Enter a valid route request.", 400);
    }

    const originInput = readRoutePoint(payload.origin, "origin");
    const destinationInput = readRoutePoint(
      payload.destination,
      "destination"
    );
    const viaInputs = readViaStops(payload.via);
    const truck = readTruckProfile(payload.truck);

    const [origin, destination, via] = await Promise.all([
      resolveRoutePoint(originInput, "Current location", apiKey),
      resolveRoutePoint(destinationInput, "Destination", apiKey),
      Promise.all(
        viaInputs.map((point, index) =>
          resolveRoutePoint(point, `Stop ${index + 1}`, apiKey)
        )
      ),
    ]);

    const graphHopperResponse = await fetchGraphHopperRoute(
      [origin, ...via, destination],
      truck,
      apiKey
    );
    const path = readGraphHopperPath(graphHopperResponse);
    const geometry = readGeometry(path.points);
    const distanceMeters = readPositiveNumber(path.distance);
    const durationMilliseconds = readPositiveNumber(path.time);

    if (!distanceMeters || !durationMilliseconds) {
      throw new RoutePreviewError(
        "A complete truck route could not be calculated.",
        422
      );
    }

    const distanceMiles = distanceMeters / METERS_PER_MILE;

    return NextResponse.json({
      route_id: randomUUID(),
      origin_label: origin.label,
      destination_label: destination.label,
      distance_miles: round(distanceMiles, 1),
      duration_minutes: Math.max(
        1,
        Math.round(durationMilliseconds / 60_000)
      ),
      geometry: {
        type: "LineString",
        coordinates: geometry,
      },
      maneuvers: readManeuvers(
        path.instructions,
        geometry,
        distanceMiles
      ),
      restrictions_applied: appliedRestrictions(truck),
      stops_along_route: [],
      advisory:
        "Truck routing is advisory. Always follow posted restrictions, clearance signs, and dispatch instructions.",
    });
  } catch (error: unknown) {
    if (error instanceof RoutePreviewError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    console.error("GraphHopper route preview failed:", safeError(error));

    return NextResponse.json(
      { error: "Truck routing is temporarily unavailable." },
      { status: 500 }
    );
  }
}

async function fetchGraphHopperRoute(
  points: RoutePoint[],
  truck: TruckProfile,
  apiKey: string
) {
  const url = new URL(ROUTING_URL);
  url.searchParams.set("key", apiKey);

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      points: points.map((point) => point.coordinates),
      profile: "truck",
      locale: "en",
      instructions: true,
      calc_points: true,
      points_encoded: false,
      "ch.disable": true,
      custom_model: buildCustomModel(truck),
    }),
    cache: "no-store",
    signal: AbortSignal.timeout(18_000),
  });

  const result = (await response.json()) as unknown;

  if (!response.ok) {
    console.error("GraphHopper routing request failed:", {
      status: response.status,
      message: providerMessage(result),
    });

    throw new RoutePreviewError(
      response.status === 429
        ? "Truck routing is busy. Try again shortly."
        : "A safe truck route could not be calculated.",
      response.status === 429 ? 429 : 422
    );
  }

  return result;
}

function buildCustomModel(truck: TruckProfile) {
  const priority: Array<Record<string, string>> = [
    {
      if: "road_environment == FERRY",
      multiply_by: "0.1",
    },
    {
      if: "road_class == RESIDENTIAL || road_class == TERTIARY",
      multiply_by: "0.4",
    },
    {
      if: "road_class == TRACK",
      multiply_by: "0",
    },
  ];

  addLimit(priority, "max_height", feetToMeters(truck.heightFeet));
  addLimit(priority, "max_width", feetToMeters(truck.widthFeet));
  addLimit(priority, "max_length", feetToMeters(truck.lengthFeet));
  addLimit(
    priority,
    "max_weight",
    poundsToMetricTons(truck.grossWeightPounds)
  );
  addLimit(
    priority,
    "max_axle_load",
    poundsToMetricTons(truck.axleLoadPounds)
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

  return {
    distance_influence: 70,
    priority,
  };
}

function addLimit(
  priority: Array<Record<string, string>>,
  encodedValue: string,
  limit: number | null
) {
  if (limit === null) return;

  priority.push({
    if: `${encodedValue} > 0 && ${encodedValue} < ${round(limit, 3)}`,
    multiply_by: "0",
  });
}

async function resolveRoutePoint(
  input: RoutePointInput,
  fallbackLabel: string,
  apiKey: string
): Promise<RoutePoint> {
  if (input.coordinates) {
    return {
      coordinates: input.coordinates,
      label: fallbackLabel,
    };
  }

  const url = new URL(GEOCODING_URL);
  url.searchParams.set("key", apiKey);
  url.searchParams.set("q", input.query);
  url.searchParams.set("limit", "1");
  url.searchParams.set("locale", "en");

  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(8_000),
  });
  const result = (await response.json()) as unknown;

  if (!response.ok) {
    console.error("GraphHopper geocoding request failed:", {
      status: response.status,
      message: providerMessage(result),
    });
    throw new RoutePreviewError(
      "A route location could not be found.",
      response.status === 429 ? 429 : 422
    );
  }

  const envelope = isRecord(result) ? result : null;
  const hit = Array.isArray(envelope?.hits)
    ? (envelope.hits.find(isRecord) ?? null)
    : null;
  const point = hit && isRecord(hit.point) ? hit.point : null;
  const latitude = readCoordinate(point?.lat, -90, 90);
  const longitude = readCoordinate(point?.lng, -180, 180);

  if (latitude === null || longitude === null) {
    throw new RoutePreviewError(
      `We could not match “${input.query}”. Check the location and try again.`,
      422
    );
  }

  return {
    coordinates: [longitude, latitude],
    label: formatGeocodeLabel(hit, input.query),
  };
}

type RoutePointInput =
  | { query: string; coordinates: null }
  | { query: ""; coordinates: Coordinates };

function readRoutePoint(value: unknown, field: string): RoutePointInput {
  const record = isRecord(value) ? value : null;
  const query =
    typeof record?.query === "string" ? record.query.trim() : "";

  if (query) {
    if (query.length > 200) {
      throw new RoutePreviewError(`${field} is too long.`, 400);
    }
    return { query, coordinates: null };
  }

  const coordinates = readCoordinates(record?.coordinate);

  if (!coordinates) {
    throw new RoutePreviewError(`Enter a valid ${field}.`, 400);
  }

  return { query: "", coordinates };
}

function readViaStops(value: unknown): RoutePointInput[] {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) {
    throw new RoutePreviewError("Via stops must be a list.", 400);
  }
  if (value.length > MAX_VIA_STOPS) {
    throw new RoutePreviewError(
      `A route can include up to ${MAX_VIA_STOPS} added stops.`,
      400
    );
  }

  return value.map((point, index) =>
    readRoutePoint(point, `via stop ${index + 1}`)
  );
}

function readTruckProfile(value: unknown): TruckProfile {
  const record = isRecord(value) ? value : {};

  return {
    heightFeet: readOptionalPositiveNumber(record.height_ft, 20),
    widthFeet: readOptionalPositiveNumber(record.width_ft, 15),
    lengthFeet: readOptionalPositiveNumber(record.length_ft, 150),
    grossWeightPounds: readOptionalPositiveNumber(
      record.gross_weight_lbs,
      250_000
    ),
    axleLoadPounds: readOptionalPositiveNumber(
      record.axle_load_lbs,
      100_000
    ),
    hazmat: record.hazmat === true,
    avoidTolls: record.avoid_tolls === true,
  };
}

function readGraphHopperPath(value: unknown): Record<string, unknown> {
  const envelope = isRecord(value) ? value : null;
  const path = Array.isArray(envelope?.paths)
    ? envelope.paths.find(isRecord)
    : null;

  if (!path) {
    throw new RoutePreviewError(
      "A safe truck route could not be calculated.",
      422
    );
  }

  return path;
}

function readGeometry(value: unknown): Coordinates[] {
  const points = isRecord(value) ? value : null;

  if (points?.type !== "LineString" || !Array.isArray(points.coordinates)) {
    throw new RoutePreviewError(
      "The route geometry was incomplete. Try the route again.",
      502
    );
  }

  const coordinates = points.coordinates.flatMap((point) => {
    const parsed = readCoordinates(point);
    return parsed ? [parsed] : [];
  });

  if (coordinates.length < 2) {
    throw new RoutePreviewError(
      "The route geometry was incomplete. Try the route again.",
      502
    );
  }

  return coordinates;
}

function readManeuvers(
  value: unknown,
  geometry: Coordinates[],
  distanceMiles: number
) {
  if (!Array.isArray(value)) return [];

  let distanceBeforeMeters = 0;

  return value.flatMap((item, index) => {
    if (!isRecord(item) || typeof item.text !== "string") return [];

    const instruction = item as GraphHopperInstruction;
    const interval = Array.isArray(instruction.interval)
      ? instruction.interval
      : [];
    const geometryIndex = clampInteger(interval[0], 0, geometry.length - 1);
    const coordinate = geometry[geometryIndex] ?? geometry[0];
    const routeMile = Math.min(
      distanceMiles,
      distanceBeforeMeters / METERS_PER_MILE
    );
    const maneuverDistance = readNonNegativeNumber(instruction.distance) ?? 0;
    distanceBeforeMeters += maneuverDistance;

    return [
      {
        id: `maneuver_${index + 1}`,
        instruction: instruction.text,
        spoken_instruction: instruction.text,
        coordinate,
        route_mile: round(routeMile, 2),
        type: clampInteger(instruction.sign, -98, 98),
      },
    ];
  });
}

function appliedRestrictions(truck: TruckProfile) {
  const restrictions: string[] = [];

  if (truck.heightFeet !== null) restrictions.push("height");
  if (truck.widthFeet !== null) restrictions.push("width");
  if (truck.lengthFeet !== null) restrictions.push("length");
  if (truck.grossWeightPounds !== null) restrictions.push("gross weight");
  if (truck.axleLoadPounds !== null) restrictions.push("axle load");
  if (truck.hazmat) restrictions.push("hazmat");
  if (truck.avoidTolls) restrictions.push("toll avoidance");

  return restrictions;
}

function formatGeocodeLabel(
  hit: Record<string, unknown> | null,
  fallback: string
) {
  if (!hit) return fallback;

  const values = [hit.name, hit.city, hit.state, hit.country]
    .filter((value): value is string =>
      typeof value === "string" && Boolean(value.trim())
    )
    .map((value) => value.trim());

  return Array.from(new Set(values)).join(", ") || fallback;
}

function readCoordinates(value: unknown): Coordinates | null {
  if (!Array.isArray(value) || value.length < 2) return null;

  const longitude = readCoordinate(value[0], -180, 180);
  const latitude = readCoordinate(value[1], -90, 90);

  return longitude === null || latitude === null
    ? null
    : [longitude, latitude];
}

function readCoordinate(
  value: unknown,
  minimum: number,
  maximum: number
) {
  const number = toNumber(value);
  return number !== null && number >= minimum && number <= maximum
    ? number
    : null;
}

function readOptionalPositiveNumber(value: unknown, maximum: number) {
  if (value === undefined || value === null || value === "") return null;

  const number = readPositiveNumber(value);
  if (number === null || number > maximum) {
    throw new RoutePreviewError("The truck profile contains an invalid value.", 400);
  }

  return number;
}

function readPositiveNumber(value: unknown) {
  const number = toNumber(value);
  return number !== null && number > 0 ? number : null;
}

function readNonNegativeNumber(value: unknown) {
  const number = toNumber(value);
  return number !== null && number >= 0 ? number : null;
}

function toNumber(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

function clampInteger(value: unknown, minimum: number, maximum: number) {
  const number = toNumber(value);
  if (number === null) return 0;
  return Math.min(maximum, Math.max(minimum, Math.trunc(number)));
}

function feetToMeters(value: number | null) {
  return value === null ? null : value * 0.3048;
}

function poundsToMetricTons(value: number | null) {
  return value === null ? null : value * 0.00045359237;
}

function providerMessage(value: unknown) {
  if (!isRecord(value)) return "No provider message";
  return typeof value.message === "string"
    ? value.message.slice(0, 300)
    : "No provider message";
}

function safeError(value: unknown) {
  return value instanceof Error ? value.message : "Unknown error";
}

function round(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
