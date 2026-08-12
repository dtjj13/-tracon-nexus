"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import Navbar from "../components/Navbar";
import CompanyHealth from "../components/owner/CompanyHealth";
import ExecutiveHeader from "../components/owner/ExecutiveHeader";
import OwnerDepartmentMenu from "../components/owner/OwnerDepartmentMenu";
import TodaysBusiness from "../components/owner/TodaysBusiness";
import TodaysFocus from "../components/owner/TodaysFocus";
import ExecutiveAI from "../components/owner/ExecutiveAI";
import ExecutiveTimeline from "../components/owner/ExecutiveTimeline";
import ExecutiveScore from "../components/owner/ExecutiveScore";
import ProfitDetailsDrawer from "../components/dispatch/ProfitDetailsDrawer";
import { hasRole } from "../lib/getUserRole";
import { supabase } from "../lib/supabase";

type Load = {
  id: string;
  tracon_id?: string;
  broker_load_id?: string;
  driver_name?: string;
  status?: string;
  rate?: number;
  driver_pay?: number;
  fuel_cost?: number;
 profit?: number;
net_profit?: number;
profit_margin?: number;
  pod_url?: string;
  rate_con_url?: string;
  created_at?: string;
  delivered_at?: string;
  archived?: boolean;
  cancelled?: boolean;
  cancelled_at?: string;
};

type Driver = {
  id: string;
  name?: string;
  active: boolean;
};

type TimeFilter = "daily" | "weekly" | "monthly" | "yearly";

export default function OwnerDashboard() {
  const router = useRouter();

  const [loads, setLoads] = useState<Load[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [timeFilter, setTimeFilter] =
    useState<TimeFilter>("weekly");
  const [loading, setLoading] = useState(true);
  const [profitDetailsLoad, setProfitDetailsLoad] =
  useState<Load | null>(null);

  useEffect(() => {
    let mounted = true;

    const initializeDashboard = async () => {
      const allowed = await hasRole(["owner", "admin"]);

      if (!allowed) {
        router.push("/dispatch");
        return;
      }

      if (mounted) {
        await fetchData();
      }
    };

    initializeDashboard();

    const channel = supabase
      .channel("owner-dashboard-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "loads",
        },
        fetchData
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "drivers",
        },
        fetchData
      )
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [router]);

  const fetchData = async () => {
    try {
      const [loadsResult, driversResult] = await Promise.all([
        supabase
          .from("loads")
          .select("*")
          .order("created_at", { ascending: false }),

        supabase
          .from("drivers")
          .select("*")
          .order("name", { ascending: true }),
      ]);

      if (loadsResult.error) {
        console.error(
          "Unable to load owner dashboard loads:",
          loadsResult.error
        );
      }

      if (driversResult.error) {
        console.error(
          "Unable to load owner dashboard drivers:",
          driversResult.error
        );
      }

      setLoads(loadsResult.data || []);
      setDrivers(driversResult.data || []);
    } catch (error) {
      console.error("Unable to load owner dashboard:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLoads = useMemo(() => {
    const now = new Date();

    return loads.filter((load) => {
      if (!load.created_at) return false;

      const createdAt = new Date(load.created_at);

      if (Number.isNaN(createdAt.getTime())) {
        return false;
      }

      const differenceInDays =
        (now.getTime() - createdAt.getTime()) /
        (1000 * 60 * 60 * 24);

      if (timeFilter === "daily") {
        return differenceInDays <= 1;
      }

      if (timeFilter === "weekly") {
        return differenceInDays <= 7;
      }

      if (timeFilter === "monthly") {
        return differenceInDays <= 30;
      }

      return differenceInDays <= 365;
    });
  }, [loads, timeFilter]);

  const analytics = useMemo(() => {
    const operationalLoads = filteredLoads.filter(
      (load) => !load.cancelled && !load.archived
    );

    const totalLoads = operationalLoads.length;

    const activeLoads = operationalLoads.filter(
      (load) => clean(load.status) !== "delivered"
    ).length;

    const deliveredLoads = operationalLoads.filter(
      (load) => clean(load.status) === "delivered"
    ).length;

    const inTransitLoads = operationalLoads.filter(
      (load) => clean(load.status) === "in transit"
    ).length;

    const missingPODs = operationalLoads.filter(
      (load) =>
        clean(load.status) === "delivered" &&
        !load.pod_url
    ).length;

    const missingRateCons = operationalLoads.filter(
      (load) => !load.rate_con_url
    ).length;

    const negativeProfitLoads = operationalLoads.filter(
  (load) => getLoadNetProfit(load) < 0
);

    const activeDrivers = drivers.filter(
      (driver) => driver.active
    ).length;

    const totalRevenue = sum(operationalLoads, "rate");
   const totalProfit = operationalLoads.reduce(
  (total, load) =>
    total + getLoadNetProfit(load),
  0
);

    const profitMargin =
      totalRevenue > 0
        ? (totalProfit / totalRevenue) * 100
        : 0;

    const today = new Date().toDateString();

    const deliveredToday = operationalLoads.filter((load) => {
      if (!load.delivered_at) return false;

      const deliveredAt = new Date(load.delivered_at);

      if (Number.isNaN(deliveredAt.getTime())) {
        return false;
      }

      return deliveredAt.toDateString() === today;
    }).length;

    const revenueAtRisk = operationalLoads
      .filter(
        (load) =>
          clean(load.status) === "delivered" &&
          !load.pod_url
      )
      .reduce(
        (total, load) =>
          total + Number(load.rate || 0),
        0
      );
const dispatchHealth = clampScore(
  100 -
    missingPODs * 8 -
    missingRateCons * 5 -
    negativeProfitLoads.length * 10
);

const driverHealth =
  drivers.length > 0
    ? clampScore((activeDrivers / drivers.length) * 100)
    : 100;

const financialHealth = clampScore(
  100 -
    negativeProfitLoads.length * 15 -
    (profitMargin < 0 ? 30 : profitMargin < 10 ? 15 : 0) -
    (revenueAtRisk > 0 ? 10 : 0)
);

/*
  Fleet and Safety are intentionally null until their
  real database tables are connected.
*/
const fleetHealth: number | null = null;
const safetyHealth: number | null = null;

const connectedHealthScores = [
  dispatchHealth,
  driverHealth,
  financialHealth,
];

const companyHealth = clampScore(
  connectedHealthScores.reduce(
    (total, score) => total + score,
    0
  ) / connectedHealthScores.length
);
    return {
      totalLoads,
      activeLoads,
      deliveredLoads,
      inTransitLoads,
      missingPODs,
      missingRateCons,
      negativeProfitLoads,
      activeDrivers,
      totalRevenue,
      totalProfit,
      profitMargin,
      deliveredToday,
      revenueAtRisk,
      companyHealth,
  dispatchHealth,
  driverHealth,
  fleetHealth,
  safetyHealth,
  financialHealth,
    };
  }, [filteredLoads, drivers]);
  const worstNegativeProfitLoad =
  analytics.negativeProfitLoads.length > 0
    ? analytics.negativeProfitLoads.reduce((worst, load) =>
        getLoadNetProfit(load) < getLoadNetProfit(worst)
          ? load
          : worst
      )
    : null;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020617] text-slate-400">
        Loading Executive Dashboard...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] p-3 text-white sm:p-6">
      <div className="w-full px-6">
        <Navbar />

        <div className="grid items-start gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
          <aside className="xl:sticky xl:top-6">
            <OwnerDepartmentMenu
  dispatchCount={analytics.activeLoads}
  activeDrivers={analytics.activeDrivers}
  maintenanceDue={null}
  safetyAlerts={null}
/>
          </aside>

         <main className="min-w-0 space-y-6">
  <ExecutiveHeader
    activeLoads={analytics.activeLoads}
    activeDrivers={analytics.activeDrivers}
  />

<ExecutiveAI
  companyHealth={analytics.companyHealth}
  missingPODs={analytics.missingPODs}
  missingRateCons={analytics.missingRateCons}
  negativeProfitLoads={analytics.negativeProfitLoads.length}
  revenueAtRisk={analytics.revenueAtRisk}
  activeLoads={analytics.activeLoads}
  activeDrivers={analytics.activeDrivers}
  totalProfit={analytics.totalProfit}
  onReviewNegativeProfit={
  worstNegativeProfitLoad
    ? () => setProfitDetailsLoad(worstNegativeProfitLoad)
    : undefined
}
/>

  <CompanyHealth
    score={analytics.companyHealth}
    dispatch={analytics.dispatchHealth}
    drivers={analytics.driverHealth}
    fleet={analytics.fleetHealth}
    safety={analytics.safetyHealth}
    financials={analytics.financialHealth}
/>
<ExecutiveScore
  companyHealth={analytics.companyHealth}
  dispatchHealth={analytics.dispatchHealth}
  driverHealth={analytics.driverHealth}
  financialHealth={analytics.financialHealth}
/>
  <TodaysFocus
    missingPODs={analytics.missingPODs}
    negativeProfitLoads={analytics.negativeProfitLoads.length}
    missingRateCons={analytics.missingRateCons}
    deliveredToday={analytics.deliveredToday}
  />

  <ExecutiveSnapshot
    totalLoads={analytics.totalLoads}
    deliveredLoads={analytics.deliveredLoads}
    inTransitLoads={analytics.inTransitLoads}
    profitMargin={analytics.profitMargin}
  />

  <TodaysBusiness
    revenue={analytics.totalRevenue}
    profit={analytics.totalProfit}
    activeLoads={analytics.activeLoads}
    activeDrivers={analytics.activeDrivers}
    revenueAtRisk={analytics.revenueAtRisk}
  />

  <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-xs uppercase tracking-[0.25em] text-[#16BFFF]">
          Recent Activity
        </p>

        <h2 className="mt-1 text-lg font-semibold text-white">
          Company Timeline
        </h2>
      </div>

      <TimeFilterButtons
        selectedFilter={timeFilter}
        onChange={setTimeFilter}
      />
    </div>

    <ExecutiveTimeline loads={filteredLoads} />
  </section>
</main>
        </div>
      </div>

      <ProfitDetailsDrawer
        load={profitDetailsLoad}
        onClose={() => setProfitDetailsLoad(null)}
      />
    </div>
  );
}

function TimeFilterButtons({
  selectedFilter,
  onChange,
}: {
  selectedFilter: TimeFilter;
  onChange: (filter: TimeFilter) => void;
}) {
  const filters: TimeFilter[] = [
    "daily",
    "weekly",
    "monthly",
    "yearly",
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {filters.map((filter) => {
        const isActive = selectedFilter === filter;

        return (
          <button
            key={filter}
            type="button"
            onClick={() => onChange(filter)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold transition ${
              isActive
                ? "bg-[#00A3FF] text-white shadow-lg shadow-cyan-500/10"
                : "border border-slate-800 bg-[#07101A] text-slate-400 hover:border-slate-700 hover:text-white"
            }`}
          >
            {capitalize(filter)}
          </button>
        );
      })}
    </div>
  );
}

function ExecutiveSnapshot({
  totalLoads,
  deliveredLoads,
  inTransitLoads,
  profitMargin,
}: {
  totalLoads: number;
  deliveredLoads: number;
  inTransitLoads: number;
  profitMargin: number;
}) {
  const items = [
    {
      title: "Total Loads",
      value: totalLoads,
      color: "text-[#16BFFF]",
    },
    {
      title: "Delivered",
      value: deliveredLoads,
      color: "text-green-400",
    },
    {
      title: "In Transit",
      value: inTransitLoads,
      color: "text-cyan-400",
    },
    {
      title: "Profit Margin",
      value: `${profitMargin.toFixed(1)}%`,
      color:
        profitMargin >= 0
          ? "text-indigo-400"
          : "text-red-400",
    },
  ];

  return (
    <section>
      <div className="mb-4">
        <p className="text-xs uppercase tracking-[0.25em] text-[#16BFFF]">
          Company Overview
        </p>

        <h2 className="mt-1 text-lg font-semibold text-white">
          Executive Snapshot
        </h2>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <div
            key={item.title}
            className="rounded-2xl border border-slate-800 bg-[#07101A] p-5"
          >
            <p className="text-xs uppercase tracking-wider text-slate-500">
              {item.title}
            </p>

            <p
              className={`mt-3 text-2xl font-bold ${item.color}`}
            >
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

function RecentLoads({ loads }: { loads: Load[] }) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-800 bg-[#07101A]">
      <div className="flex items-center justify-between gap-4 border-b border-slate-800 p-5">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-[#16BFFF]">
            Recent Activity
          </p>

          <h2 className="mt-1 text-lg font-semibold text-white">
            Recent Loads
          </h2>
        </div>

        <span className="text-xs text-slate-500">
          Latest 5 loads
        </span>
      </div>

      <div className="divide-y divide-slate-800">
        {loads.map((load) => (
          <div
            key={load.id}
            className="grid gap-3 p-5 transition hover:bg-[#0B1522] sm:grid-cols-[1.2fr_1fr_auto]"
          >
            <div>
              <p className="font-semibold text-[#16BFFF]">
                {load.broker_load_id ||
                  load.tracon_id ||
                  "Unnumbered load"}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Driver: {load.driver_name || "Unassigned"}
              </p>
            </div>

            <div>
              <p
                className={`text-sm font-semibold ${statusColor(
                  load.status
                )}`}
              >
                {load.status || "No status"}
              </p>

              <p className="mt-1 text-xs text-slate-500">
                Profit:{" "}
                <span
                  className={
                   getLoadNetProfit(load) >= 0
                      ? "text-green-400"
                      : "text-red-400"
                  }
                >
                 {money(getLoadNetProfit(load))}
                </span>
              </p>
            </div>

            <div className="flex items-center gap-2 sm:justify-end">
              {load.cancelled && (
                <span className="rounded-full bg-yellow-500/10 px-2.5 py-1 text-xs font-semibold text-yellow-300">
                  Cancelled
                </span>
              )}

              {load.archived && (
                <span className="rounded-full bg-slate-700/50 px-2.5 py-1 text-xs font-semibold text-slate-300">
                  Archived
                </span>
              )}

              {!load.cancelled && !load.archived && (
                <span
                  className={
                    load.pod_url
                      ? "rounded-full bg-green-500/10 px-2.5 py-1 text-xs font-semibold text-green-400"
                      : "rounded-full bg-red-500/10 px-2.5 py-1 text-xs font-semibold text-red-400"
                  }
                >
                  {load.pod_url ? "POD Uploaded" : "POD Missing"}
                </span>
              )}
            </div>
          </div>
        ))}

        {loads.length === 0 && (
          <div className="p-8 text-center text-sm text-slate-500">
            No loads found for this period.
          </div>
        )}
      </div>
    </section>
  );
}
function getLoadNetProfit(load: Load) {
  return Number(
    load.net_profit ?? load.profit ?? 0
  );
}
function sum(loads: Load[], key: keyof Load) {
  return loads.reduce(
    (total, load) =>
      total + Number(load[key] || 0),
    0
  );
}

function money(value?: number) {
  return `$${Number(value || 0).toLocaleString("en-US", {
    maximumFractionDigits: 2,
  })}`;
}

function clean(value?: string) {
  return value?.trim().toLowerCase() || "";
}

function capitalize(value: string) {
  return (
    value.charAt(0).toUpperCase() +
    value.slice(1)
  );
}
function clampScore(score: number) {
  return Math.max(0, Math.min(100, Math.round(score)));
}

function statusColor(status?: string) {
  const value = clean(status);

  if (value === "pending") {
    return "text-yellow-400";
  }

  if (value === "assigned") {
    return "text-cyan-400";
  }

  if (value === "arrived at pickup") {
    return "text-indigo-400";
  }

  if (value === "in transit") {
    return "text-[#16BFFF]";
  }

  if (value === "delivered") {
    return "text-green-400";
  }

  return "text-slate-300";
}