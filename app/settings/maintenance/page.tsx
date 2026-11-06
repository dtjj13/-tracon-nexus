"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ClipboardList,
  FileClock,
  RefreshCw,
  Search,
  Settings2,
  ShieldAlert,
  Truck as TruckIcon,
  Wrench,
} from "lucide-react";

import Navbar from "@/app/components/Navbar";
import RoleGate from "@/app/components/RoleGate";
import { supabase } from "@/app/lib/supabase";
import type { ComplianceDocument } from "@/app/lib/complianceDocuments";

type Truck = {
  id: string;
  truck_number: string;
  vin: string | null;
  make: string | null;
  model: string | null;
  year: string | null;
  license_plate: string | null;
  mpg: number | null;
  active: boolean;
  vehicle_type: string | null;
};

type DvirFailure = {
  id: string;
  truck_id: string | null;
  category: string | null;
  question: string | null;
  notes: string | null;
  created_at: string | null;
};

type FleetFilter = "all" | "attention" | "no-history" | "inactive";

type FleetRow = Truck & {
  failures: DvirFailure[];
  records: ComplianceDocument[];
  latestRecord: ComplianceDocument | null;
};

const filterLabels: Record<FleetFilter, string> = {
  all: "All trucks",
  attention: "Needs attention",
  "no-history": "No service history",
  inactive: "Inactive",
};

export default function MaintenancePage() {
  return (
    <RoleGate allowed={["owner", "admin", "manager", "maintenance"]}>
      <MaintenanceWorkspace />
    </RoleGate>
  );
}

function MaintenanceWorkspace() {
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [failures, setFailures] = useState<DvirFailure[]>([]);
  const [records, setRecords] = useState<ComplianceDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FleetFilter>("all");

  const loadMaintenanceData = useCallback(async () => {
    setLoading(true);
    setError("");

    const [trucksResult, failuresResult, recordsResult] = await Promise.all([
      supabase
        .from("trucks")
        .select(
          "id,truck_number,vin,make,model,year,license_plate,mpg,active,vehicle_type"
        )
        .order("truck_number", { ascending: true }),
      supabase
        .from("dvirs")
        .select("id,truck_id,category,question,notes,created_at")
        .eq("status", "Fail")
        .order("created_at", { ascending: false }),
      supabase
        .from("compliance_documents")
        .select("*")
        .eq("entity_type", "truck")
        .eq("document_type", "Maintenance record")
        .order("created_at", { ascending: false }),
    ]);

    const messages = [
      trucksResult.error?.message,
      failuresResult.error?.message,
      recordsResult.error?.message,
    ].filter(Boolean);

    setTrucks((trucksResult.data ?? []) as Truck[]);
    setFailures((failuresResult.data ?? []) as DvirFailure[]);
    setRecords((recordsResult.data ?? []) as ComplianceDocument[]);
    setError(messages.join(" "));
    setLoading(false);
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect -- Initial async maintenance-data hydration. */
  useEffect(() => {
    void loadMaintenanceData();

    const channel = supabase
      .channel("maintenance-workspace-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trucks" },
        () => void loadMaintenanceData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "dvirs" },
        () => void loadMaintenanceData()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "compliance_documents" },
        () => void loadMaintenanceData()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadMaintenanceData]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const fleet = useMemo<FleetRow[]>(() => {
    const failuresByTruck = groupByTruck(failures);
    const recordsByTruck = groupByTruck(records);

    return trucks.map((truck) => {
      const truckRecords = recordsByTruck[truck.id] ?? [];

      return {
        ...truck,
        failures: failuresByTruck[truck.id] ?? [],
        records: truckRecords,
        latestRecord: truckRecords[0] ?? null,
      };
    });
  }, [failures, records, trucks]);

  const visibleFleet = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return fleet.filter((truck) => {
      const matchesQuery =
        !normalizedQuery ||
        [
          truck.truck_number,
          truck.vin,
          truck.make,
          truck.model,
          truck.license_plate,
          truck.vehicle_type,
        ].some((value) => value?.toLowerCase().includes(normalizedQuery));

      const matchesFilter =
        filter === "all" ||
        (filter === "attention" && truck.failures.length > 0) ||
        (filter === "no-history" && truck.records.length === 0) ||
        (filter === "inactive" && !truck.active);

      return matchesQuery && matchesFilter;
    });
  }, [filter, fleet, query]);

  const activeCount = fleet.filter((truck) => truck.active).length;
  const attentionCount = fleet.filter(
    (truck) => truck.failures.length > 0
  ).length;
  const noHistoryCount = fleet.filter(
    (truck) => truck.records.length === 0
  ).length;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        <div className="text-center">
          <RefreshCw className="mx-auto h-7 w-7 animate-spin text-cyan-400" />
          <p className="mt-3 text-sm text-slate-400">
            Loading maintenance workspace…
          </p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-[#020617] px-4 py-6 text-white sm:px-6 lg:px-10">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <Navbar />

        <header className="rounded-3xl border border-cyan-500/20 bg-[#07101d] p-6 sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-cyan-400">
                <Wrench className="h-7 w-7" />
              </div>

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-400">
                  Fleet operations
                </p>
                <h1 className="mt-2 text-3xl font-bold sm:text-4xl">
                  Maintenance Center
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
                  See fleet readiness, failed inspection follow-up, and service
                  records without hunting across separate screens.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/settings/trucks"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-[#0b1626] px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-cyan-500/40 hover:text-cyan-400"
              >
                <Settings2 className="h-4 w-4" />
                Manage trucks
              </Link>
              <Link
                href="/owner"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-[#0b1626] px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-cyan-500/40 hover:text-cyan-400"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Owner
              </Link>
            </div>
          </div>
        </header>

        {error && (
          <section className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5">
            <p className="font-semibold text-amber-200">
              Some maintenance information could not be loaded
            </p>
            <p className="mt-1 text-sm text-amber-100/70">{error}</p>
            <button
              type="button"
              onClick={() => void loadMaintenanceData()}
              className="mt-3 rounded-xl border border-amber-400/30 px-4 py-2 text-sm font-semibold text-amber-100 transition hover:bg-amber-500/10"
            >
              Try again
            </button>
          </section>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Active fleet"
            value={activeCount}
            detail={`${fleet.length} total trucks`}
            icon={TruckIcon}
            tone="cyan"
          />
          <MetricCard
            label="Needs attention"
            value={attentionCount}
            detail={`${failures.length} open failed items`}
            icon={ShieldAlert}
            tone={attentionCount > 0 ? "red" : "green"}
          />
          <MetricCard
            label="Service records"
            value={records.length}
            detail="Recorded maintenance history"
            icon={ClipboardList}
            tone="green"
          />
          <MetricCard
            label="No service history"
            value={noHistoryCount}
            detail="Trucks without a maintenance record"
            icon={FileClock}
            tone={noHistoryCount > 0 ? "amber" : "green"}
          />
        </section>

        <section className="rounded-3xl border border-slate-800 bg-[#07101d] p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-400">
                Fleet readiness
              </p>
              <h2 className="mt-2 text-2xl font-bold">Maintenance queue</h2>
              <p className="mt-2 text-sm text-slate-400">
                Failed inspection items are prioritized ahead of missing service
                history.
              </p>
            </div>

            <div className="relative w-full lg:max-w-sm">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search truck, VIN, plate…"
                className="w-full rounded-xl border border-slate-700 bg-[#0b1626] py-3 pl-10 pr-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-cyan-500"
              />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {(Object.keys(filterLabels) as FleetFilter[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setFilter(value)}
                className={`rounded-full border px-4 py-2 text-xs font-semibold transition ${
                  filter === value
                    ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-300"
                    : "border-slate-700 bg-[#0b1626] text-slate-400 hover:text-white"
                }`}
              >
                {filterLabels[value]}
              </button>
            ))}
          </div>

          <div className="mt-5 overflow-x-auto rounded-2xl border border-slate-800">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-[#0b1626] text-left text-xs uppercase tracking-[0.12em] text-slate-500">
                <tr>
                  <th className="px-4 py-4">Truck</th>
                  <th className="px-4 py-4">Vehicle</th>
                  <th className="px-4 py-4">Readiness</th>
                  <th className="px-4 py-4">Open defects</th>
                  <th className="px-4 py-4">Last service record</th>
                  <th className="px-4 py-4">History</th>
                </tr>
              </thead>
              <tbody>
                {visibleFleet.map((truck) => (
                  <tr
                    key={truck.id}
                    className="border-t border-slate-800 bg-[#07101d] transition hover:bg-[#0a1523]"
                  >
                    <td className="px-4 py-4">
                      <p className="font-bold text-white">
                        Truck {truck.truck_number}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {truck.license_plate || "No plate recorded"}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-slate-300">
                      <p>{vehicleLabel(truck)}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatVehicleType(truck.vehicle_type)}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <ReadinessBadge truck={truck} />
                    </td>
                    <td className="px-4 py-4">
                      {truck.failures.length > 0 ? (
                        <span className="font-semibold text-red-300">
                          {truck.failures.length} failed item
                          {truck.failures.length === 1 ? "" : "s"}
                        </span>
                      ) : (
                        <span className="text-emerald-300">None open</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-slate-300">
                      {truck.latestRecord
                        ? formatDate(
                            truck.latestRecord.issue_date ??
                              truck.latestRecord.created_at
                          )
                        : "Not recorded"}
                    </td>
                    <td className="px-4 py-4 text-slate-300">
                      {truck.records.length} record
                      {truck.records.length === 1 ? "" : "s"}
                    </td>
                  </tr>
                ))}

                {visibleFleet.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-6 py-12 text-center text-slate-500"
                    >
                      No trucks match this view.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="rounded-3xl border border-slate-800 bg-[#07101d] p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-red-300">
                  Inspection follow-up
                </p>
                <h2 className="mt-2 text-2xl font-bold">Open repair items</h2>
              </div>
              <AlertTriangle className="h-6 w-6 text-red-300" />
            </div>

            <div className="mt-5 space-y-3">
              {failures.slice(0, 8).map((failure) => (
                <article
                  key={failure.id}
                  className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4"
                >
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold text-white">
                        {failure.question || "Failed inspection item"}
                      </p>
                      <p className="mt-1 text-sm text-slate-400">
                        {failure.category || "General inspection"}
                        {failure.notes ? ` · ${failure.notes}` : ""}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-red-300">
                      {truckNumberFor(failure.truck_id, trucks)}
                    </span>
                  </div>
                </article>
              ))}

              {failures.length === 0 && (
                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 text-center">
                  <CheckCircle2 className="mx-auto h-6 w-6 text-emerald-300" />
                  <p className="mt-2 font-semibold text-emerald-200">
                    No failed inspection items are open
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-[#07101d] p-5 sm:p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-400">
              Service history
            </p>
            <h2 className="mt-2 text-2xl font-bold">Recent maintenance</h2>

            <div className="mt-5 space-y-3">
              {records.slice(0, 6).map((record) => (
                <article
                  key={record.id}
                  className="rounded-2xl border border-slate-800 bg-[#0b1626] p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">
                        {record.entity_name || "Truck maintenance"}
                      </p>
                      <p className="mt-1 text-sm text-slate-400">
                        {record.notes || "Maintenance record"}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-slate-500">
                      {formatDate(record.issue_date ?? record.created_at)}
                    </span>
                  </div>
                </article>
              ))}

              {records.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-500">
                  No maintenance records have been uploaded yet.
                </div>
              )}
            </div>

            <Link
              href="/settings/safety"
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#1e6bff] to-[#00a3ff] px-4 py-3 text-sm font-bold text-white"
            >
              <ClipboardList className="h-4 w-4" />
              Add maintenance record
            </Link>
          </div>
        </section>

        <section className="rounded-3xl border border-amber-500/20 bg-amber-500/5 p-5 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-amber-300">
              <FileClock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-amber-100">
                Scheduling foundation is the next maintenance step
              </h2>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-amber-100/70">
                Mileage-based reminders, work orders, vendors, parts, downtime,
                and repair costs need company-isolated maintenance tables. This
                screen intentionally does not put those records in browser-only
                storage or overload the truck table. The current view is live and
                useful; those controls will be added after the secure maintenance
                schema is reviewed.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function MetricCard({
  label,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  detail: string;
  icon: typeof TruckIcon;
  tone: "cyan" | "green" | "amber" | "red";
}) {
  const tones = {
    cyan: "border-cyan-500/25 bg-cyan-500/10 text-cyan-300",
    green: "border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
    amber: "border-amber-500/25 bg-amber-500/10 text-amber-300",
    red: "border-red-500/25 bg-red-500/10 text-red-300",
  };

  return (
    <article className="rounded-2xl border border-slate-800 bg-[#07101d] p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-bold text-white">{value}</p>
          <p className="mt-2 text-xs text-slate-500">{detail}</p>
        </div>
        <div className={`rounded-xl border p-2.5 ${tones[tone]}`}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </article>
  );
}

function ReadinessBadge({ truck }: { truck: FleetRow }) {
  if (!truck.active) {
    return (
      <span className="inline-flex rounded-full border border-slate-600 bg-slate-800 px-3 py-1 text-xs font-semibold text-slate-300">
        Inactive
      </span>
    );
  }

  if (truck.failures.length > 0) {
    return (
      <span className="inline-flex rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-300">
        Repair follow-up
      </span>
    );
  }

  if (truck.records.length === 0) {
    return (
      <span className="inline-flex rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-300">
        History needed
      </span>
    );
  }

  return (
    <span className="inline-flex rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-300">
      Monitored
    </span>
  );
}

function groupByTruck<T extends { truck_id?: string | null; entity_id?: string }>(
  items: T[]
) {
  return items.reduce<Record<string, T[]>>((groups, item) => {
    const truckId = item.truck_id ?? item.entity_id;
    if (!truckId) return groups;
    groups[truckId] = [...(groups[truckId] ?? []), item];
    return groups;
  }, {});
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function vehicleLabel(truck: Truck) {
  return [truck.year, truck.make, truck.model].filter(Boolean).join(" ") ||
    "Vehicle details not set";
}

function formatVehicleType(value: string | null) {
  if (!value) return "Type not set";
  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function truckNumberFor(truckId: string | null, trucks: Truck[]) {
  if (!truckId) return "Truck not linked";
  const truck = trucks.find((item) => item.id === truckId);
  return truck ? `Truck ${truck.truck_number}` : "Unknown truck";
}
