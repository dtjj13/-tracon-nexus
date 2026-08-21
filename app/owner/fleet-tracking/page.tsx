"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Clock3,
  MapPin,
  Navigation,
  Radio,
  Truck,
} from "lucide-react";

import Navbar from "../../components/Navbar";
import LiveFleetMap, {
  type FleetMapLocation,
} from "../../components/owner/LiveFleetMap";
import OwnerDepartmentMenu from "../../components/owner/OwnerDepartmentMenu";
import { hasRole } from "../../lib/getUserRole";
import { supabase } from "../../lib/supabase";

type Load = {
  id: string;
  tracon_id?: string;
  broker_load_id?: string;
  broker_name?: string;
  pickup?: string;
  dropoff?: string;
  status?: string;
  driver_name?: string;
  truck_number?: string;
  driver_lat?: number | null;
  driver_lng?: number | null;
  tracking_active?: boolean;
  tracking_started_at?: string;
  updated_at?: string;
  created_at?: string;
  archived?: boolean;
  cancelled?: boolean;
};

type TrackingState = "live" | "signal-lost" | "stopped" | "awaiting";
type TrackingFilter = "all" | TrackingState;

const filters: Array<{ label: string; value: TrackingFilter }> = [
  { label: "All Active", value: "all" },
  { label: "Tracking Live", value: "live" },
  { label: "Signal Lost", value: "signal-lost" },
  { label: "Tracking Stopped", value: "stopped" },
  { label: "Awaiting Location", value: "awaiting" },
];

export default function FleetTrackingPage() {
  const router = useRouter();
  const [loads, setLoads] = useState<Load[]>([]);
  const [selectedLoadId, setSelectedLoadId] = useState<string | null>(null);
  const [filter, setFilter] = useState<TrackingFilter>("all");
  const [loading, setLoading] = useState(true);
  const [currentTime, setCurrentTime] = useState(() => Date.now());

  async function fetchLoads() {
    const { data, error } = await supabase
      .from("loads")
      .select("*")
      .order("updated_at", { ascending: false });

    if (error) {
      console.error("Unable to load fleet locations:", error);
      setLoading(false);
      return;
    }

    const nextLoads = (data || []) as Load[];
    setLoads(nextLoads);
    setSelectedLoadId((currentId) => {
      if (currentId && nextLoads.some((load) => load.id === currentId)) {
        return currentId;
      }

      return (
        nextLoads.find((load) => hasLocation(load))?.id ||
        nextLoads[0]?.id ||
        null
      );
    });
    setLoading(false);
  }

  useEffect(() => {
    let mounted = true;

    const initialize = async () => {
      const allowed = await hasRole(["owner", "admin"]);

      if (!allowed) {
        router.push("/dispatch");
        return;
      }

      if (mounted) {
        await fetchLoads();
      }
    };

    initialize();

    const channel = supabase
      .channel("owner-fleet-tracking")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "loads",
        },
        fetchLoads
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [router]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentTime(Date.now());
    }, 30_000);

    return () => window.clearInterval(timer);
  }, []);

  const activeLoads = useMemo(
    () =>
      loads.filter(
        (load) =>
          !load.archived &&
          !load.cancelled &&
          clean(load.status) !== "delivered"
      ),
    [loads]
  );

  const trackingCounts = useMemo(() => {
    const counts: Record<TrackingState, number> = {
      live: 0,
      "signal-lost": 0,
      stopped: 0,
      awaiting: 0,
    };

    activeLoads.forEach((load) => {
      counts[getTrackingState(load, currentTime)] += 1;
    });

    return counts;
  }, [activeLoads, currentTime]);

  const visibleLoads = useMemo(
    () =>
      filter === "all"
        ? activeLoads
        : activeLoads.filter(
            (load) => getTrackingState(load, currentTime) === filter
          ),
    [activeLoads, currentTime, filter]
  );

  const selectedLoad = useMemo(() => {
    const selected = visibleLoads.find((load) => load.id === selectedLoadId);
    return selected || visibleLoads.find((load) => hasLocation(load)) || visibleLoads[0] || null;
  }, [visibleLoads, selectedLoadId]);
const mapLocations = useMemo<FleetMapLocation[]>(
  () =>
    visibleLoads.filter(hasLocation).map((load) => ({
      id: load.id,
      latitude: load.driver_lat,
      longitude: load.driver_lng,
      driverName:
        load.driver_name || "Driver unassigned",
      loadNumber: loadNumber(load),
      truckNumber:
        load.truck_number || "Unassigned",
      trackingState: getTrackingState(
        load,
        currentTime
      ) as "live" | "signal-lost" | "stopped",
    })),
  [visibleLoads, currentTime]
);
  const activeDrivers = new Set(
    activeLoads.map((load) => load.driver_name).filter(Boolean)
  ).size;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020617] text-slate-400">
        Loading Live Fleet Map...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] p-3 text-white sm:p-6">
      <div className="w-full px-2 sm:px-6">
        <Navbar />

        <div className="grid items-start gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="hidden xl:sticky xl:top-6 xl:block">
            <OwnerDepartmentMenu
              dispatchCount={activeLoads.length}
              activeDrivers={activeDrivers}
              maintenanceDue={null}
              safetyAlerts={null}
            />
          </aside>

          <main className="min-w-0 space-y-6">
            <section className="rounded-3xl border border-cyan-500/20 bg-gradient-to-br from-[#07101A] via-[#07101A] to-cyan-950/20 p-6 shadow-[0_0_40px_rgba(0,0,0,0.35)]">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-[#16BFFF]">
                    Live Operations
                  </p>
                  <h1 className="mt-2 text-3xl font-bold text-white">
                    Live Fleet Map
                  </h1>
                  <p className="mt-2 max-w-2xl text-sm text-slate-400">
                    Monitor every active load, identify signal problems, and open a driver&apos;s live tracking page.
                  </p>
                </div>

                <div className="inline-flex items-center gap-2 rounded-2xl border border-green-500/20 bg-green-500/10 px-4 py-3 text-sm font-semibold text-green-300">
                  <Radio className="h-4 w-4" />
                  Updates automatically
                </div>
              </div>
            </section>

          <section className="grid grid-cols-2 gap-3 xl:grid-cols-5">
  <Metric
    label="Active Loads"
    value={activeLoads.length}
    color="text-white"
  />
  <Metric
    label="Tracking Live"
    value={trackingCounts.live}
    color="text-green-400"
  />
  <Metric
    label="Signal Lost"
    value={trackingCounts["signal-lost"]}
    color="text-red-400"
  />
  <Metric
    label="Stopped"
    value={trackingCounts.stopped}
    color="text-slate-300"
  />
  <div className="col-span-2 xl:col-span-1">
    <Metric
      label="Awaiting"
      value={trackingCounts.awaiting}
      color="text-yellow-400"
    />
  </div>
</section>

            <section className="rounded-2xl border border-slate-800 bg-[#07101A] p-3">
              <div className="flex flex-wrap gap-2">
                {filters.map((item) => (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setFilter(item.value)}
                    className={`rounded-xl px-4 py-2 text-xs font-semibold transition ${
                      filter === item.value
                        ? "bg-[#00A3FF] text-white"
                        : "border border-slate-800 bg-[#0B1522] text-slate-400 hover:border-slate-700 hover:text-white"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="grid gap-6 2xl:grid-cols-[minmax(0,1.5fr)_420px]">
              <div className="overflow-hidden rounded-3xl border border-slate-800 bg-[#07101A]">
                <div className="flex flex-col gap-4 border-b border-slate-800 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-[#16BFFF]">
                      Selected Driver
                    </p>
                    <h2 className="mt-2 text-xl font-semibold text-white">
                      {selectedLoad?.driver_name || "No driver selected"}
                    </h2>
                    {selectedLoad && (
                      <p className="mt-1 text-sm text-slate-400">
                        {loadNumber(selectedLoad)} · Truck {selectedLoad.truck_number || "Unassigned"}
                      </p>
                    )}
                  </div>

                  {selectedLoad && (
                    <a
                      href={`/track/${selectedLoad.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex w-full min-w-0 items-center justify-center gap-2 whitespace-normal rounded-xl bg-gradient-to-r from-[#1E6BFF] to-[#00A3FF] px-4 py-3 text-center text-sm font-semibold text-white transition hover:brightness-110 sm:w-auto"
                    >
                      <Navigation className="h-4 w-4" />
                      Open Live Tracking
                    </a>
                  )}
                </div>

               {mapLocations.length > 0 ? (
  <div>
    <LiveFleetMap
      locations={mapLocations}
      selectedId={selectedLoad?.id || null}
      onSelect={setSelectedLoadId}
    />

    {selectedLoad && (
      <div className="grid gap-3 border-t border-slate-800 p-5 sm:grid-cols-3">
        <MapDetail
          label="Pickup"
          value={selectedLoad.pickup || "Not provided"}
        />
        <MapDetail
          label="Delivery"
          value={selectedLoad.dropoff || "Not provided"}
        />
        <MapDetail
          label="Last Location"
          value={formatAge(
            selectedLoad.updated_at,
            currentTime
          )}
        />
      </div>
    )}
  </div>
) : (
  <div className="flex h-[520px] flex-col items-center justify-center p-8 text-center">
    <div className="rounded-full border border-yellow-500/20 bg-yellow-500/10 p-5">
      <MapPin className="h-8 w-8 text-yellow-400" />
    </div>

    <h3 className="mt-5 text-xl font-semibold text-white">
      No location available
    </h3>

    <p className="mt-2 max-w-md text-sm text-slate-400">
      The driver must start live tracking before this load can appear on the map.
    </p>
  </div>
)}
              </div>

              <div className="rounded-3xl border border-slate-800 bg-[#07101A] p-4">
                <div className="flex items-center justify-between gap-3 border-b border-slate-800 px-1 pb-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.25em] text-[#16BFFF]">
                      Active Loads
                    </p>
                    <h2 className="mt-1 text-lg font-semibold text-white">
                      Driver Locations
                    </h2>
                  </div>
                  <span className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-400">
                    {visibleLoads.length}
                  </span>
                </div>

                <div className="mt-4 max-h-[660px] space-y-3 overflow-y-auto pr-1">
                  {visibleLoads.map((load) => (
                    <FleetLoadCard
                      key={load.id}
                      load={load}
                      currentTime={currentTime}
                      selected={selectedLoad?.id === load.id}
                      onSelect={() => setSelectedLoadId(load.id)}
                    />
                  ))}

                  {visibleLoads.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-500">
                      No active loads match this filter.
                    </div>
                  )}
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}

function FleetLoadCard({
  load,
  currentTime,
  selected,
  onSelect,
}: {
  load: Load;
  currentTime: number;
  selected: boolean;
  onSelect: () => void;
}) {
  const trackingState = getTrackingState(load, currentTime);
  const appearance = trackingAppearance(trackingState);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-2xl border p-4 text-left transition ${
        selected
          ? "border-cyan-500/50 bg-cyan-500/10"
          : "border-slate-800 bg-[#0B1522] hover:border-slate-700"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold text-white">{loadNumber(load)}</p>
          <p className="mt-1 text-xs text-slate-500">
            {load.driver_name || "Driver unassigned"}
          </p>
        </div>

        <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${appearance.classes}`}>
          {appearance.label}
        </span>
      </div>

      <div className="mt-4 space-y-2 text-xs">
        <div className="flex items-center gap-2 text-slate-400">
          <Truck className="h-3.5 w-3.5 text-cyan-400" />
          Truck {load.truck_number || "Unassigned"}
        </div>
        <div className="flex items-center gap-2 text-slate-400">
          <MapPin className="h-3.5 w-3.5 text-cyan-400" />
          <span className="min-w-0 break-words leading-5">{shortLocation(load.pickup)} → {shortLocation(load.dropoff)}</span>
        </div>
        <div className="flex items-center gap-2 text-slate-500">
          <Clock3 className="h-3.5 w-3.5" />
          {hasLocation(load)
            ? `Updated ${formatAge(load.updated_at, currentTime)}`
            : "No location reported"}
        </div>
      </div>
    </button>
  );
}

function Metric({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#07101A] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function MapDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-[#0B1522] p-3">
      <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 line-clamp-2 text-sm text-slate-200">{value}</p>
    </div>
  );
}

function getTrackingState(load: Load, currentTime: number): TrackingState {
  if (!hasLocation(load)) return "awaiting";

  const lastUpdate = load.updated_at
    ? new Date(load.updated_at).getTime()
    : 0;
  const fresh =
    lastUpdate > 0 && currentTime - lastUpdate <= 120_000;

  if (load.tracking_active && fresh) return "live";
  if (load.tracking_active && !fresh) return "signal-lost";
  return "stopped";
}

function trackingAppearance(state: TrackingState) {
  if (state === "live") {
    return {
      label: "Tracking Live",
      classes: "border-green-500/30 bg-green-500/10 text-green-300",
    };
  }

  if (state === "signal-lost") {
    return {
      label: "Signal Lost",
      classes: "border-red-500/40 bg-red-500/10 text-red-300",
    };
  }

  if (state === "stopped") {
    return {
      label: "Tracking Stopped",
      classes: "border-slate-600 bg-slate-500/10 text-slate-300",
    };
  }

  return {
    label: "Awaiting Location",
    classes: "border-yellow-500/30 bg-yellow-500/10 text-yellow-300",
  };
}

function hasLocation(
  load: Load
): load is Load & { driver_lat: number; driver_lng: number } {
  return load.driver_lat != null && load.driver_lng != null;
}

function formatAge(value: string | undefined, currentTime: number) {
  if (!value) return "Not reported";

  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "Not reported";

  const seconds = Math.max(0, Math.floor((currentTime - timestamp) / 1000));
  if (seconds < 60) return "just now";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return `${Math.floor(hours / 24)}d ago`;
}

function loadNumber(load: Load) {
  return load.broker_load_id || load.tracon_id || "Unnumbered load";
}

function shortLocation(value?: string) {
  if (!value) return "Not provided";
  const parts = value.split(",").map((part) => part.trim());

  if (parts.length >= 2) {
    return `${parts[parts.length - 2]}, ${parts[parts.length - 1]}`;
  }

  return value;
}

function clean(value?: string) {
  return value?.trim().toLowerCase() || "";
}
