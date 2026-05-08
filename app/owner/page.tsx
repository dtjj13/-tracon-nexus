"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../components/Navbar";
import { supabase } from "../lib/supabase";
import { hasRole } from "../lib/getUserRole";

type Load = {
  id: string;
  tracon_id?: string;
  broker_load_id?: string;
  pickup?: string;
  dropoff?: string;
  driver_name?: string;
  status?: string;
  rate?: number;
  driver_pay?: number;
  fuel_cost?: number;
  profit?: number;
  pod_url?: string;
  rate_con_url?: string;
  created_at?: string;
  delivered_at?: string;
};

type Driver = {
  id: string;
  name?: string;
  active: boolean;
};

export default function OwnerDashboard() {
  const router = useRouter();

  const [loads, setLoads] = useState<Load[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);

  useEffect(() => {
    const checkRole = async () => {
      const allowed = await hasRole(["owner", "admin"]);
      if (!allowed) router.push("/dispatch");
    };

    checkRole();
    fetchData();

    const channel = supabase
      .channel("owner-analytics-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "loads" }, fetchData)
      .on("postgres_changes", { event: "*", schema: "public", table: "drivers" }, fetchData)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  const fetchData = async () => {
    const { data: loadData } = await supabase
      .from("loads")
      .select("*")
      .order("created_at", { ascending: false });

    const { data: driverData } = await supabase
      .from("drivers")
      .select("*")
      .order("name", { ascending: true });

    setLoads(loadData || []);
    setDrivers(driverData || []);
  };

  const analytics = useMemo(() => {
    const totalLoads = loads.length;
    const activeLoads = loads.filter((l) => clean(l.status) !== "delivered").length;
    const deliveredLoads = loads.filter((l) => clean(l.status) === "delivered").length;
    const inTransitLoads = loads.filter((l) => clean(l.status) === "in transit").length;
    const missingPODs = loads.filter((l) => clean(l.status) === "delivered" && !l.pod_url).length;
    const missingRateCons = loads.filter((l) => !l.rate_con_url).length;
    const activeDrivers = drivers.filter((d) => d.active).length;

    const totalRevenue = sum(loads, "rate");
    const totalDriverPay = sum(loads, "driver_pay");
    const totalFuel = sum(loads, "fuel_cost");
    const totalProfit = sum(loads, "profit");

    const avgProfit = totalLoads > 0 ? totalProfit / totalLoads : 0;
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    const today = new Date().toDateString();

    const deliveredToday = loads.filter((l) => {
      if (!l.delivered_at) return false;
      return new Date(l.delivered_at).toDateString() === today;
    }).length;

    const revenueAtRisk = loads
      .filter((l) => clean(l.status) === "delivered" && !l.pod_url)
      .reduce((total, load) => total + Number(load.rate || 0), 0);

    const negativeProfitLoads = loads.filter((l) => Number(l.profit || 0) < 0);

    const driverCounts = drivers.map((driver) => {
      const driverLoads = loads.filter((load) => load.driver_name === driver.name);
      const revenue = driverLoads.reduce((total, load) => total + Number(load.rate || 0), 0);
      const profit = driverLoads.reduce((total, load) => total + Number(load.profit || 0), 0);

      return {
        name: driver.name || "Unknown",
        loads: driverLoads.length,
        revenue,
        profit,
      };
    });

    return {
      totalLoads,
      activeLoads,
      deliveredLoads,
      inTransitLoads,
      missingPODs,
      missingRateCons,
      activeDrivers,
      totalRevenue,
      totalDriverPay,
      totalFuel,
      totalProfit,
      avgProfit,
      profitMargin,
      deliveredToday,
      revenueAtRisk,
      negativeProfitLoads,
      driverCounts,
    };
  }, [loads, drivers]);

  return (
    <div className="min-h-screen bg-[#020617] p-3 text-white sm:p-6">
      <div className="space-y-6">
        <Navbar />

       <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-[#07101A] to-[#050A11] p-5 shadow-[0_0_30px_rgba(0,0,0,0.45)]">
  <p className="text-xs uppercase tracking-[0.3em] text-[#16BFFF]">
    Executive View
  </p>

  <h1 className="mt-2 text-xl uppercase tracking-[0.35em] text-white">
    Owner Dashboard
  </h1>
</div>

        {(analytics.missingPODs > 0 ||
          analytics.negativeProfitLoads.length > 0 ||
          analytics.missingRateCons > 0) && (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 shadow-[0_0_25px_rgba(239,68,68,0.15)]">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <RiskCard title="Missing POD" value={analytics.missingPODs} />
              <RiskCard title="Negative Profit" value={analytics.negativeProfitLoads.length} />
              <RiskCard title="Missing Rate Con" value={analytics.missingRateCons} />
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard title="Revenue" value={money(analytics.totalRevenue)} color="text-green-400" />
          <MetricCard title="Profit" value={money(analytics.totalProfit)} color={analytics.totalProfit >= 0 ? "text-[#16BFFF]" : "text-red-400"} />
          <MetricCard title="Margin" value={`${analytics.profitMargin.toFixed(1)}%`} color="text-indigo-400" />
          <MetricCard title="Avg Profit" value={money(analytics.avgProfit)} color="text-[#16BFFF]" />
          <MetricCard title="Revenue At Risk" value={money(analytics.revenueAtRisk)} color="text-red-400" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard title="Total Loads" value={analytics.totalLoads} />
          <MetricCard title="Active Loads" value={analytics.activeLoads} color="text-blue-400" />
          <MetricCard title="In Transit" value={analytics.inTransitLoads} color="text-[#16BFFF]" />
          <MetricCard title="Delivered Today" value={analytics.deliveredToday} color="text-green-400" />
          <MetricCard title="Active Drivers" value={analytics.activeDrivers} color="text-indigo-400" />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-[#07101A] p-5 xl:col-span-2">
            <h2 className="text-lg font-semibold text-white">Financial Breakdown</h2>

            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-4">
              <MiniMoney title="Revenue" value={analytics.totalRevenue} color="text-green-400" />
              <MiniMoney title="Driver Pay" value={analytics.totalDriverPay} color="text-yellow-400" />
              <MiniMoney title="Fuel" value={analytics.totalFuel} color="text-orange-400" />
              <MiniMoney title="Profit" value={analytics.totalProfit} color={analytics.totalProfit >= 0 ? "text-[#16BFFF]" : "text-red-400"} />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#07101A] p-5">
            <h2 className="text-lg font-semibold text-white">Load Status</h2>

            <div className="mt-5 space-y-3">
              <ProgressRow label="Active" value={analytics.activeLoads} total={analytics.totalLoads} />
              <ProgressRow label="Delivered" value={analytics.deliveredLoads} total={analytics.totalLoads} />
              <ProgressRow label="In Transit" value={analytics.inTransitLoads} total={analytics.totalLoads} />
              <ProgressRow label="Missing POD" value={analytics.missingPODs} total={analytics.totalLoads} danger />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-[#07101A] p-5">
            <h2 className="text-lg font-semibold text-white">Driver Performance</h2>

            <div className="mt-5 space-y-3">
              {analytics.driverCounts.map((driver) => (
                <div key={driver.name} className="rounded-xl border border-slate-800 bg-[#0B1522] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="font-semibold text-white">{driver.name}</p>
                      <p className="text-xs text-slate-500">{driver.loads} loads</p>
                    </div>

                    <div className="text-right">
                      <p className="text-sm text-green-400">{money(driver.revenue)}</p>
                      <p className={driver.profit >= 0 ? "text-xs text-[#16BFFF]" : "text-xs text-red-400"}>
                        {money(driver.profit)} profit
                      </p>
                    </div>
                  </div>
                </div>
              ))}

              {analytics.driverCounts.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-800 p-6 text-center text-sm text-slate-500">
                  No driver data yet.
                </div>
              )}
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-[#07101A]">
            <div className="p-5">
              <h2 className="text-lg font-semibold text-white">Recent Loads</h2>
            </div>

            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-[#0B1522] text-slate-400">
                <tr>
                  <th className="p-4 text-left">Load</th>
                  <th className="p-4 text-left">Driver</th>
                  <th className="p-4 text-left">Status</th>
                  <th className="p-4 text-left">Revenue</th>
                  <th className="p-4 text-left">Profit</th>
                  <th className="p-4 text-left">POD</th>
                </tr>
              </thead>

              <tbody>
                {loads.slice(0, 8).map((load) => (
                  <tr key={load.id} className="border-t border-slate-800">
                    <td className="p-4">
                      <p className="font-semibold text-[#16BFFF]">
                        {load.broker_load_id || load.tracon_id || "-"}
                      </p>
                    </td>
                    <td className="p-4">{load.driver_name || "-"}</td>
                    <td className={`p-4 ${statusColor(load.status)}`}>{load.status || "-"}</td>
                    <td className="p-4 text-green-400">{money(load.rate)}</td>
                    <td className={Number(load.profit || 0) >= 0 ? "p-4 text-[#16BFFF]" : "p-4 text-red-400"}>
                      {money(load.profit)}
                    </td>
                    <td className="p-4">
                      {load.pod_url ? (
                        <span className="text-green-400">Uploaded</span>
                      ) : (
                        <span className="text-red-400">Missing</span>
                      )}
                    </td>
                  </tr>
                ))}

                {loads.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-slate-500">
                      No loads available yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  color = "text-[#16BFFF]",
}: {
  title: string;
  value: string | number;
  color?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#07101A] p-5 shadow-[0_0_25px_rgba(0,0,0,0.35)]">
      <p className="text-xs uppercase tracking-widest text-slate-500">{title}</p>
      <h2 className={`mt-3 text-2xl font-bold ${color}`}>{value}</h2>
    </div>
  );
}

function RiskCard({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3">
      <p className="text-xs uppercase tracking-[0.2em] text-red-400">{title}</p>
      <p className="mt-1 text-xl font-semibold text-white">{value}</p>
    </div>
  );
}

function MiniMoney({ title, value, color }: { title: string; value: number; color: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-[#0B1522] p-4">
      <p className="text-xs text-slate-500">{title}</p>
      <p className={`mt-2 text-lg font-semibold ${color}`}>{money(value)}</p>
    </div>
  );
}

function ProgressRow({
  label,
  value,
  total,
  danger = false,
}: {
  label: string;
  value: number;
  total: number;
  danger?: boolean;
}) {
  const pct = total > 0 ? Math.min((value / total) * 100, 100) : 0;

  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-slate-300">{label}</span>
        <span className={danger ? "text-red-400" : "text-[#16BFFF]"}>{value}</span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-[#0B1522]">
        <div
          className={`h-full rounded-full ${danger ? "bg-red-500" : "bg-[#16BFFF]"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

function sum(loads: Load[], key: keyof Load) {
  return loads.reduce((total, load) => total + Number(load[key] || 0), 0);
}

function money(value?: number) {
  return `$${Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}`;
}

function clean(value?: string) {
  return value?.trim().toLowerCase() || "";
}

function statusColor(status?: string) {
  const value = clean(status);

  if (value === "pending") return "text-yellow-400";
  if (value === "assigned") return "text-cyan-400";
  if (value === "arrived at pickup") return "text-indigo-400";
  if (value === "in transit") return "text-[#16BFFF]";
  if (value === "delivered") return "text-green-400";

  return "text-slate-300";
}