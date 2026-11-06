"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  Clock3,
  Fuel,
  LoaderCircle,
  MapPin,
  Navigation,
  Route,
  Truck as TruckIcon,
} from "lucide-react";

import { supabase } from "../../lib/supabase";
import {
  describeTruckRoutingProfile,
  toRouteTruckInput,
  type TruckRoutingFields,
} from "../../lib/truckRouting";
import RoutePreviewMap from "./RoutePreviewMap";

type MapTruck = TruckRoutingFields & {
  id: string;
  truck_number: string;
  mpg?: number | null;
  make?: string | null;
  model?: string | null;
};

type RouteResult = {
  miles: number;
  durationMinutes: number | null;
  pickupMatch: string;
  dropoffMatch: string;
  coordinates: [number, number][];
  fuelPrice: number | null;
  fuelSource: string;
  fuelAsOf: string | null;
  advisory: string;
  restrictionsApplied: string[];
};

type Props = {
  initialPickup?: string;
  initialDropoff?: string;
};

export default function TraconMapsWorkspace({
  initialPickup = "",
  initialDropoff = "",
}: Props) {
  const [pickup, setPickup] = useState(initialPickup);
  const [dropoff, setDropoff] = useState(initialDropoff);
  const [mpg, setMpg] = useState("7");
  const [trucks, setTrucks] = useState<MapTruck[]>([]);
  const [selectedTruckId, setSelectedTruckId] = useState("");
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const selectedTruck = useMemo(
    () => trucks.find((truck) => truck.id === selectedTruckId) ?? null,
    [selectedTruckId, trucks]
  );

  useEffect(() => {
    let cancelled = false;

    const loadTrucks = async () => {
      const { data, error: truckError } = await supabase
        .from("trucks")
        .select("*")
        .eq("active", true)
        .order("truck_number", { ascending: true });

      if (!cancelled && !truckError) setTrucks((data as MapTruck[]) || []);
    };

    void loadTrucks();
    return () => {
      cancelled = true;
    };
  }, []);

  const estimatedFuelCost = useMemo(() => {
    const truckMpg = Number(mpg);
    if (!route?.fuelPrice || !Number.isFinite(truckMpg) || truckMpg <= 0) {
      return null;
    }

    return (route.miles / truckMpg) * route.fuelPrice;
  }, [mpg, route]);

  const planRoute = async () => {
    setError("");
    setRoute(null);

    if (!pickup.trim() || !dropoff.trim()) {
      setError("Enter a starting point and destination.");
      return;
    }

    try {
      setLoading(true);
      const response = await fetch("/api/route-mileage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup,
          dropoff,
          truck: toRouteTruckInput(selectedTruck),
        }),
      });
      const data = (await response.json()) as {
        miles?: number;
        duration_minutes?: number | null;
        pickup_match?: string;
        dropoff_match?: string;
        route?: { coordinates?: [number, number][] };
        state_miles?: Array<{ state: string; miles: number }>;
        advisory?: string;
        truck_restrictions_applied?: string[];
        error?: string;
      };

      if (!response.ok || !data.miles || !data.route?.coordinates?.length) {
        throw new Error(data.error || "The route could not be calculated.");
      }

      let fuelPrice: number | null = null;
      let fuelSource = "";
      let fuelAsOf: string | null = null;

      if (data.state_miles?.length) {
        const fuelResponse = await fetch("/api/diesel-price", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ state_miles: data.state_miles }),
        });
        const fuelData = (await fuelResponse.json()) as {
          price_per_gallon?: number;
          source?: string;
          as_of?: string;
        };

        if (fuelResponse.ok && Number(fuelData.price_per_gallon) > 0) {
          fuelPrice = Number(fuelData.price_per_gallon);
          fuelSource = fuelData.source || "Diesel price estimate";
          fuelAsOf = fuelData.as_of || null;
        }
      }

      setRoute({
        miles: data.miles,
        durationMinutes: data.duration_minutes ?? null,
        pickupMatch: data.pickup_match || pickup,
        dropoffMatch: data.dropoff_match || dropoff,
        coordinates: data.route.coordinates,
        fuelPrice,
        fuelSource,
        fuelAsOf,
        advisory:
          data.advisory ||
          "Route estimates are advisory. Follow posted commercial-vehicle restrictions.",
        restrictionsApplied: Array.isArray(data.truck_restrictions_applied)
          ? data.truck_restrictions_applied
          : [],
      });
    } catch (routeError) {
      setError(
        routeError instanceof Error
          ? routeError.message
          : "The route could not be calculated."
      );
    } finally {
      setLoading(false);
    }
  };

  const swapLocations = () => {
    setPickup(dropoff);
    setDropoff(pickup);
    setRoute(null);
    setError("");
  };

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-cyan-500/20 bg-gradient-to-br from-[#07101d] to-cyan-950/20 p-5 sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-cyan-400">
          Tracon Maps
        </p>
        <h1 className="mt-2 text-3xl font-bold sm:text-4xl">Route planning</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Compare route distance, drive time, and estimated fuel cost before dispatching a load.
        </p>
      </section>

      <section className="rounded-3xl border border-slate-800 bg-[#07101d] p-4 sm:p-6">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr_auto] lg:items-end">
          <MapField
            label="Starting point"
            value={pickup}
            onChange={(value) => {
              setPickup(value);
              setRoute(null);
            }}
            placeholder="City, state or address"
          />
          <button
            type="button"
            onClick={swapLocations}
            aria-label="Swap starting point and destination"
            className="grid h-12 w-full place-items-center rounded-xl border border-slate-700 bg-[#0b1626] text-slate-300 transition hover:border-cyan-400/50 hover:text-cyan-300 lg:w-12"
          >
            <ArrowLeftRight className="h-4 w-4" />
          </button>
          <MapField
            label="Destination"
            value={dropoff}
            onChange={(value) => {
              setDropoff(value);
              setRoute(null);
            }}
            placeholder="City, state or address"
          />
          <button
            type="button"
            onClick={() => void planRoute()}
            disabled={loading}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#1e6bff] to-[#00a3ff] px-5 text-sm font-bold text-white shadow-[0_0_20px_rgba(22,191,255,0.2)] disabled:cursor-wait disabled:opacity-60"
          >
            {loading ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : (
              <Navigation className="h-4 w-4" />
            )}
            {loading ? "Planning…" : "Calculate route"}
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <label className="block">
            <span className="text-xs font-semibold text-slate-400">
              Truck routing profile
            </span>
            <span className="mt-2 flex h-12 items-center gap-2 rounded-xl border border-slate-700 bg-[#0b1626] px-3 focus-within:border-cyan-400/60">
              <TruckIcon className="h-4 w-4 shrink-0 text-cyan-400" />
              <select
                value={selectedTruckId}
                onChange={(event) => {
                  const truckId = event.target.value;
                  const truck = trucks.find((item) => item.id === truckId);
                  setSelectedTruckId(truckId);
                  if (truck?.mpg && truck.mpg > 0) setMpg(String(truck.mpg));
                  setRoute(null);
                  setError("");
                }}
                className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none"
              >
                <option value="">Generic truck</option>
                {trucks.map((truck) => (
                  <option key={truck.id} value={truck.id}>
                    {truck.truck_number}
                    {truck.make || truck.model
                      ? ` · ${[truck.make, truck.model].filter(Boolean).join(" ")}`
                      : ""}
                  </option>
                ))}
              </select>
            </span>
          </label>

          <div className="rounded-xl border border-slate-800 bg-[#0b1626] px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Restrictions used
            </p>
            <p className="mt-1 text-sm font-semibold text-slate-200">
              {selectedTruck
                ? describeTruckRoutingProfile(selectedTruck)
                : "GraphHopper generic truck profile"}
            </p>
          </div>
        </div>

        {error && (
          <p className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </p>
        )}
      </section>

      {route ? (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.65fr)_390px]">
          <section className="overflow-hidden rounded-3xl border border-slate-800 bg-[#07101d]">
            <RoutePreviewMap
              coordinates={route.coordinates}
              pickupLabel={route.pickupMatch}
              dropoffLabel={route.dropoffMatch}
              className="min-h-[560px] rounded-none border-0"
            />
            <div className="grid gap-3 border-t border-slate-800 p-4 sm:grid-cols-2 sm:p-5">
              <RouteLocation label="Start" value={route.pickupMatch} />
              <RouteLocation label="Destination" value={route.dropoffMatch} />
            </div>
          </section>

          <aside className="space-y-5">
            <section className="rounded-3xl border border-slate-800 bg-[#07101d] p-5">
              <div className="grid grid-cols-2 gap-3">
                <SummaryMetric
                  icon={Route}
                  label="Distance"
                  value={`${route.miles.toLocaleString()} mi`}
                />
                <SummaryMetric
                  icon={Clock3}
                  label="Drive time"
                  value={formatDuration(route.durationMinutes)}
                />
              </div>

              <div className="mt-4 rounded-2xl border border-slate-800 bg-[#0b1626] p-4">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Truck profile
                </p>
                <p className="mt-1 text-sm font-bold text-white">
                  {selectedTruck?.truck_number || "Generic truck"}
                </p>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  {route.restrictionsApplied.length
                    ? route.restrictionsApplied.join(" · ")
                    : "No vehicle-specific dimensions applied"}
                </p>
              </div>

              <label className="mt-4 block">
                <span className="text-xs font-semibold text-slate-400">Truck MPG</span>
                <div className="mt-2 flex items-center rounded-xl border border-slate-700 bg-[#0b1626] px-3">
                  <Fuel className="h-4 w-4 text-slate-500" />
                  <input
                    type="number"
                    min="1"
                    step="0.1"
                    value={mpg}
                    onChange={(event) => setMpg(event.target.value)}
                    className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm text-white outline-none"
                  />
                  <span className="text-xs text-slate-500">mpg</span>
                </div>
              </label>

              <div className="mt-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-300">
                  Estimated fuel
                </p>
                <p className="mt-2 text-2xl font-bold text-white">
                  {estimatedFuelCost == null
                    ? "Unavailable"
                    : formatCurrency(estimatedFuelCost)}
                </p>
                {route.fuelPrice && (
                  <p className="mt-1 text-xs text-slate-400">
                    {formatCurrency(route.fuelPrice)}/gal
                    {route.fuelAsOf ? ` · ${route.fuelAsOf}` : ""}
                  </p>
                )}
              </div>

              {route.fuelSource && (
                <p className="mt-3 text-xs leading-5 text-slate-500">
                  {route.fuelSource}
                </p>
              )}
            </section>

            <p className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-xs leading-5 text-amber-200">
              {route.advisory}
            </p>
          </aside>
        </div>
      ) : (
        <section className="grid min-h-[420px] place-items-center rounded-3xl border border-dashed border-slate-800 bg-[#07101d] p-8 text-center">
          <div>
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-cyan-500/20 bg-cyan-500/10 text-cyan-300">
              <MapPin className="h-7 w-7" />
            </div>
            <h2 className="mt-5 text-xl font-bold">Plan the next load</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
              Enter both locations to view the route, mileage, drive time, and estimated fuel cost.
            </p>
          </div>
        </section>
      )}
    </div>
  );
}

function MapField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-400">{label}</span>
      <span className="mt-2 flex h-12 items-center gap-2 rounded-xl border border-slate-700 bg-[#0b1626] px-3 focus-within:border-cyan-400/60">
        <MapPin className="h-4 w-4 shrink-0 text-cyan-400" />
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-slate-600"
        />
      </span>
    </label>
  );
}

function SummaryMetric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Route;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#0b1626] p-4">
      <Icon className="h-4 w-4 text-cyan-400" />
      <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>
      <p className="mt-1 text-lg font-bold text-white">{value}</p>
    </div>
  );
}

function RouteLocation({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#0b1626] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function formatDuration(minutes: number | null) {
  if (!minutes) return "—";
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (!hours) return `${remainder} min`;
  if (!remainder) return `${hours} hr`;
  return `${hours} hr ${remainder} min`;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}
