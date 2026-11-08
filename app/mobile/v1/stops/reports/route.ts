import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import { createSupabaseAdmin } from "@/app/lib/supabaseAdmin";

export const runtime = "nodejs";

const CLIENT_ID = "tracon-maps-mobile";
const INSTALLATION_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_REPORT_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const WEIGH_REPORT_MAX_AGE_MS = 2 * 60 * 60 * 1000;
const FUEL_REPORT_MAX_AGE_MS = 12 * 60 * 60 * 1000;
const MINIMUM_CONSENSUS_REPORTS = 2;
const MAXIMUM_FUEL_CLUSTER_SPREAD = 0.75;
const MAXIMUM_STOP_IDS = 100;

type ReportCategory = "fuel" | "weigh_station";
type Coordinates = [longitude: number, latitude: number];

type StopReport = {
  stopId: string;
  stopName: string;
  category: ReportCategory;
  coordinates: Coordinates;
  availability: "open" | "closed" | null;
  dieselPricePerGallon: number | null;
  observedAt: string;
};

type CommunityReportRow = {
  stop_id: string;
  category: ReportCategory;
  availability: "open" | "closed" | null;
  diesel_price_per_gallon: number | string | null;
  observed_at: string;
  received_at: string;
  installation_hash: string;
};

type ConsensusReport = {
  stop_id: string;
  category: ReportCategory;
  availability: "open" | "closed" | null;
  diesel_price_per_gallon: number | null;
  reported_at: string;
  report_count: number;
  confidence: "medium" | "high";
};

class StopReportError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
  }
}

export async function GET(request: Request) {
  try {
    readInstallationId(request);
    const stopIds = readStopIds(request);
    const supabase = createSupabaseAdmin();
    if (!supabase) {
      throw new StopReportError(
        "Driver reports are not configured yet.",
        503
      );
    }

    const since = new Date(Date.now() - FUEL_REPORT_MAX_AGE_MS).toISOString();
    const { data, error } = await supabase
      .from("community_stop_reports")
      .select(
        "stop_id, category, availability, diesel_price_per_gallon, observed_at, received_at, installation_hash"
      )
      .in("stop_id", stopIds)
      .neq("moderation_status", "rejected")
      .gte("received_at", since)
      .order("received_at", { ascending: false })
      .limit(2_000);

    if (error) {
      console.error("Community report consensus query failed:", {
        code: error.code,
        message: error.message,
      });
      throw new StopReportError(
        "Driver reports are temporarily unavailable.",
        503
      );
    }

    return NextResponse.json(
      {
        reports: buildConsensusReports((data ?? []) as CommunityReportRow[]),
        generated_at: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error: unknown) {
    return reportErrorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const installationId = readInstallationId(request);

    const body = (await request.json()) as unknown;
    const report = readStopReport(body);
    const supabase = createSupabaseAdmin();
    if (!supabase) {
      throw new StopReportError(
        "Driver reports are not configured yet.",
        503
      );
    }

    const installationHash = createHash("sha256")
      .update(installationId)
      .digest("hex");

    await enforceRateLimit(supabase, installationHash);

    const { data, error } = await supabase
      .from("community_stop_reports")
      .insert({
        stop_id: report.stopId,
        stop_name: report.stopName,
        category: report.category,
        longitude: report.coordinates[0],
        latitude: report.coordinates[1],
        availability: report.availability,
        diesel_price_per_gallon: report.dieselPricePerGallon,
        observed_at: report.observedAt,
        installation_hash: installationHash,
        client_id: CLIENT_ID,
      })
      .select("id, received_at")
      .single();

    if (error) {
      console.error("Community stop report insert failed:", {
        code: error.code,
        message: error.message,
      });
      throw new StopReportError(
        "The report could not be saved right now.",
        503
      );
    }

    return NextResponse.json(
      {
        report_id: data.id,
        received_at: data.received_at,
        moderation_status: "pending",
      },
      {
        status: 201,
        headers: { "Cache-Control": "no-store" },
      }
    );
  } catch (error: unknown) {
    return reportErrorResponse(error);
  }
}

function readInstallationId(request: Request) {
  if (request.headers.get("x-client-id") !== CLIENT_ID) {
    throw new StopReportError("This report client is not supported.", 403);
  }

  const installationId = request.headers.get("x-installation-id")?.trim();
  if (!installationId || !INSTALLATION_ID_PATTERN.test(installationId)) {
    throw new StopReportError("A valid app installation is required.", 401);
  }
  return installationId;
}

function readStopIds(request: Request) {
  const stopIds = [...new URL(request.url).searchParams.getAll("stop_id")]
    .map((stopId) => stopId.trim())
    .filter(Boolean);
  if (
    stopIds.length === 0 ||
    stopIds.length > MAXIMUM_STOP_IDS ||
    stopIds.some((stopId) => stopId.length > 200)
  ) {
    throw new StopReportError("Enter valid stop IDs.", 400);
  }
  return [...new Set(stopIds)];
}

function buildConsensusReports(rows: CommunityReportRow[]) {
  const now = Date.now();
  const latestByInstallation = new Map<string, CommunityReportRow>();

  for (const row of rows) {
    const key = `${row.stop_id}:${row.category}:${row.installation_hash}`;
    if (!latestByInstallation.has(key)) latestByInstallation.set(key, row);
  }

  const reportsByStop = new Map<string, CommunityReportRow[]>();
  for (const row of latestByInstallation.values()) {
    const age = now - Date.parse(row.received_at);
    const maximumAge =
      row.category === "weigh_station"
        ? WEIGH_REPORT_MAX_AGE_MS
        : FUEL_REPORT_MAX_AGE_MS;
    if (!Number.isFinite(age) || age < 0 || age > maximumAge) continue;
    const key = `${row.stop_id}:${row.category}`;
    reportsByStop.set(key, [...(reportsByStop.get(key) ?? []), row]);
  }

  const consensus: ConsensusReport[] = [];
  for (const reports of reportsByStop.values()) {
    const report =
      reports[0]?.category === "weigh_station"
        ? buildWeighConsensus(reports)
        : buildFuelConsensus(reports);
    if (report) consensus.push(report);
  }
  return consensus;
}

function buildWeighConsensus(
  reports: CommunityReportRow[]
): ConsensusReport | null {
  const openReports = reports.filter((report) => report.availability === "open");
  const closedReports = reports.filter(
    (report) => report.availability === "closed"
  );
  const winner =
    openReports.length >= closedReports.length ? openReports : closedReports;
  if (
    winner.length < MINIMUM_CONSENSUS_REPORTS ||
    winner.length / reports.length < 2 / 3
  ) {
    return null;
  }

  return consensusReport(winner, {
    availability: winner[0].availability,
    dieselPricePerGallon: null,
  });
}

function buildFuelConsensus(
  reports: CommunityReportRow[]
): ConsensusReport | null {
  const pricedReports = reports
    .map((report) => ({
      report,
      price: Number(report.diesel_price_per_gallon),
    }))
    .filter(({ price }) => Number.isFinite(price))
    .sort((left, right) => left.price - right.price);

  let cluster = pricedReports.slice(0, 0);
  for (let start = 0; start < pricedReports.length; start += 1) {
    for (let end = start; end < pricedReports.length; end += 1) {
      if (
        pricedReports[end].price - pricedReports[start].price >
        MAXIMUM_FUEL_CLUSTER_SPREAD
      ) {
        break;
      }
      const candidate = pricedReports.slice(start, end + 1);
      if (candidate.length > cluster.length) cluster = candidate;
    }
  }

  if (cluster.length < MINIMUM_CONSENSUS_REPORTS) return null;
  const middle = Math.floor(cluster.length / 2);
  const median =
    cluster.length % 2 === 0
      ? (cluster[middle - 1].price + cluster[middle].price) / 2
      : cluster[middle].price;

  return consensusReport(
    cluster.map(({ report }) => report),
    {
      availability: null,
      dieselPricePerGallon: Math.round(median * 1000) / 1000,
    }
  );
}

function consensusReport(
  reports: CommunityReportRow[],
  value: {
    availability: "open" | "closed" | null;
    dieselPricePerGallon: number | null;
  }
): ConsensusReport {
  const latest = reports.reduce((current, report) =>
    Date.parse(report.observed_at) > Date.parse(current.observed_at)
      ? report
      : current
  );
  return {
    stop_id: latest.stop_id,
    category: latest.category,
    availability: value.availability,
    diesel_price_per_gallon: value.dieselPricePerGallon,
    reported_at: latest.observed_at,
    report_count: reports.length,
    confidence: reports.length >= 4 ? "high" : "medium",
  };
}

function reportErrorResponse(error: unknown) {
  if (error instanceof StopReportError) {
    return NextResponse.json(
      { error: error.message },
      {
        status: error.status,
        headers: { "Cache-Control": "no-store" },
      }
    );
  }

  console.error("Community stop report failed:", safeError(error));
  return NextResponse.json(
    { error: "Driver reports are temporarily unavailable." },
    {
      status: 500,
      headers: { "Cache-Control": "no-store" },
    }
  );
}

async function enforceRateLimit(
  supabase: NonNullable<ReturnType<typeof createSupabaseAdmin>>,
  installationHash: string
) {
  const now = Date.now();
  const windows = [
    { since: new Date(now - 60_000).toISOString(), maximum: 5 },
    { since: new Date(now - 24 * 60 * 60 * 1000).toISOString(), maximum: 100 },
  ];

  for (const window of windows) {
    const { count, error } = await supabase
      .from("community_stop_reports")
      .select("id", { count: "exact", head: true })
      .eq("installation_hash", installationHash)
      .gte("received_at", window.since);

    if (error) {
      console.error("Community report rate-limit check failed:", {
        code: error.code,
        message: error.message,
      });
      throw new StopReportError(
        "Driver reports are temporarily unavailable.",
        503
      );
    }

    if ((count ?? 0) >= window.maximum) {
      throw new StopReportError(
        "Too many reports were sent. Try again later.",
        429
      );
    }
  }
}

function readStopReport(value: unknown): StopReport {
  const record = isRecord(value) ? value : null;
  if (!record) {
    throw new StopReportError("Enter a valid stop report.", 400);
  }

  const stopId = readString(record.stop_id, "stop ID", 200);
  const stopName = readString(record.stop_name, "stop name", 200);
  const category = readCategory(record.category);
  const coordinates = readCoordinates(record.coordinate);
  const availability = readAvailability(record.availability);
  const dieselPricePerGallon = readDieselPrice(
    record.diesel_price_per_gallon
  );
  const observedAt = readObservedAt(record.reported_at);

  if (category === "weigh_station") {
    if (!availability || dieselPricePerGallon !== null) {
      throw new StopReportError(
        "Weigh-station reports must be open or closed.",
        400
      );
    }
  } else if (dieselPricePerGallon === null || availability !== null) {
    throw new StopReportError(
      "Fuel reports must include a valid diesel price.",
      400
    );
  }

  return {
    stopId,
    stopName,
    category,
    coordinates,
    availability,
    dieselPricePerGallon,
    observedAt,
  };
}

function readString(value: unknown, label: string, maximum: number) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text.length > maximum) {
    throw new StopReportError(`Enter a valid ${label}.`, 400);
  }
  return text;
}

function readCategory(value: unknown): ReportCategory {
  if (value === "fuel" || value === "weigh_station") return value;
  throw new StopReportError("This stop category cannot be reported.", 400);
}

function readCoordinates(value: unknown): Coordinates {
  if (!Array.isArray(value) || value.length < 2) {
    throw new StopReportError("Enter valid stop coordinates.", 400);
  }
  const longitude = readFiniteNumber(value[0]);
  const latitude = readFiniteNumber(value[1]);
  if (
    longitude === null ||
    latitude === null ||
    longitude < -180 ||
    longitude > 180 ||
    latitude < -90 ||
    latitude > 90
  ) {
    throw new StopReportError("Enter valid stop coordinates.", 400);
  }
  return [longitude, latitude];
}

function readAvailability(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  if (value === "open" || value === "closed") return value;
  throw new StopReportError("Enter a valid weigh-station status.", 400);
}

function readDieselPrice(value: unknown) {
  if (value === undefined || value === null || value === "") return null;
  const price = readFiniteNumber(value);
  if (price === null || price < 0.01 || price > 20) {
    throw new StopReportError("Enter a valid diesel price.", 400);
  }
  return Math.round(price * 1000) / 1000;
}

function readObservedAt(value: unknown) {
  if (typeof value !== "string") {
    throw new StopReportError("Enter a valid report time.", 400);
  }
  const milliseconds = Date.parse(value);
  const now = Date.now();
  if (
    !Number.isFinite(milliseconds) ||
    milliseconds > now + 10 * 60 * 1000 ||
    milliseconds < now - MAX_REPORT_AGE_MS
  ) {
    throw new StopReportError("This report time is no longer valid.", 400);
  }
  return new Date(milliseconds).toISOString();
}

function readFiniteNumber(value: unknown) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function safeError(error: unknown) {
  return error instanceof Error
    ? { name: error.name, message: error.message }
    : { name: "UnknownError" };
}
