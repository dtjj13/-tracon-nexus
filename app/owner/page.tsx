"use client";

import { useEffect, useState } from "react";
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
};

type Driver = {
  id: string;
  active: boolean;
};

export default function OwnerDashboard() {
  const router = useRouter();

  const [loads, setLoads] = useState<Load[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);

  useEffect(() => {
    const checkRole = async () => {
      const allowed = await hasRole(["owner", "admin"]);

      if (!allowed) {
        router.push("/dispatch");
      }
    };

    checkRole();
    fetchData();

    const channel = supabase
      .channel("owner-dashboard-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "loads" },
        () => fetchData()
      )
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

    const { data: driverData } = await supabase.from("drivers").select("*");

    setLoads(loadData || []);
    setDrivers(driverData || []);
  };

  const totalLoads = loads.length;
  const activeLoads = loads.filter((load) => clean(load.status) !== "delivered").length;
  const deliveredLoads = loads.filter((load) => clean(load.status) === "delivered").length;
  const missingPODs = loads.filter(
    (load) => clean(load.status) === "delivered" && !load.pod_url
  ).length;
  const activeDrivers = drivers.filter((driver) => driver.active).length;

  const totalRevenue = sum(loads, "rate");
  const totalDriverPay = sum(loads, "driver_pay");
  const totalFuelCost = sum(loads, "fuel_cost");
  const totalProfit = sum(loads, "profit");

  const deliveredRevenue = loads
    .filter((load) => clean(load.status) === "delivered")
    .reduce((total, load) => total + Number(load.rate || 0), 0);

  const missingPodRevenue = loads
    .filter((load) => clean(load.status) === "delivered" && !load.pod_url)
    .reduce((total, load) => total + Number(load.rate || 0), 0);

  const negativeProfitLoads = loads.filter((load) => Number(load.profit || 0) < 0);
  const missingRateCons = loads.filter((load) => !load.rate_con_url);

  const avgProfit =
    totalLoads > 0 ? totalProfit / totalLoads : 0;

  const recentLoads = loads.slice(0, 6);

  return (
    <div className="min-h-screen bg-[#020617] p-3 text-white sm:p-6">
      <div className="space-y-6">
        <Navbar />

        <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-[#07101A] to-[#050A11] p-5 shadow-[0_0_30px_rgba(0,0,0,0.45)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[#00A3FF]">
                Executive View
              </p>
              <h1 className="mt-2 text-base uppercase tracking-[0.35em] text-white">
                Owner Dashboard
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                Revenue, profit, driver activity, and operational risk in one view.
              </p>
            </div>

            <div className="rounded-xl border border-[#1E6BFF]/40 bg-[#0B1522] px-4 py-3 text-sm shadow-[0_0_20px_rgba(30,107,255,0.12)]">
              <p className="text-slate-400">Estimated Profit</p>
              <p
                className={`text-2xl font-bold ${
                  totalProfit >= 0 ? "text-[#00A3FF]" : "text-red-400"
                }`}
              >
                {money(totalProfit)}
              </p>
            </div>
          </div>
        </div>

        {(missingPODs > 0 || negativeProfitLoads.length > 0 || missingRateCons.length > 0) && (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 shadow-[0_0_25px_rgba(239,68,68,0.15)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-red-400">
                  Attention Required
                </p>
                <h2 className="mt-2 text-lg font-semibold text-white">
                  Operational Risk Detected
                </h2>
                <p className="mt-1 text-sm text-slate-300">
                  Review missing documents, negative-profit loads, and delivered loads without POD.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                <RiskPill label="Missing POD" value={missingPODs} />
                <RiskPill label="Negative Profit" value={negativeProfitLoads.length} />
                <RiskPill label="Missing Rate Con" value={missingRateCons.length} />
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard title="Total Loads" value={totalLoads} />
          <StatCard title="Active Loads" value={activeLoads} />
          <StatCard title="Delivered" value={deliveredLoads} />
          <StatCard title="Missing PODs" value={missingPODs} />
          <StatCard title="Active Drivers" value={activeDrivers} />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <MoneyCard title="Total Revenue" value={totalRevenue} color="text-green-400" />
          <MoneyCard title="Driver Pay" value={totalDriverPay} color="text-yellow-400" />
          <MoneyCard title="Fuel Cost" value={totalFuelCost} color="text-orange-400" />
          <MoneyCard
            title="Estimated Profit"
            value={totalProfit}
            color={totalProfit >= 0 ? "text-[#00A3FF]" : "text-red-400"}
          />
          <MoneyCard title="Avg Profit / Load" value={avgProfit} color="text-indigo-400" />
        </div>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <InsightCard
            title="Delivered Revenue"
            value={money(deliveredRevenue)}
            subtitle="Revenue tied to completed loads"
          />

          <InsightCard
            title="Missing POD Revenue"
            value={money(missingPodRevenue)}
            subtitle="Revenue at risk until POD is uploaded"
            danger={missingPodRevenue > 0}
          />

          <InsightCard
            title="Document Risk"
            value={`${missingRateCons.length} loads`}
            subtitle="Loads missing uploaded rate confirmation"
            danger={missingRateCons.length > 0}
          />
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-[#07101A] shadow-[0_0_30px_rgba(0,0,0,0.45)]">
          <div className="flex items-center justify-between border-b border-slate-800 p-4">
            <div>
              <h2 className="font-semibold text-white">Recent Load Financials</h2>
              <p className="text-xs text-slate-500">
                Latest loads with revenue, cost, and profit visibility.
              </p>
            </div>
          </div>

          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-[#0B1522] text-slate-400">
              <tr>
                <th className="p-4 text-left">Load</th>
                <th className="p-4 text-left">Route</th>
                <th className="p-4 text-left">Driver</th>
                <th className="p-4 text-left">Status</th>
                <th className="p-4 text-left">Revenue</th>
                <th className="p-4 text-left">Driver Pay</th>
                <th className="p-4 text-left">Fuel</th>
                <th className="p-4 text-left">Profit</th>
                <th className="p-4 text-left">POD</th>
              </tr>
            </thead>

            <tbody>
              {recentLoads.map((load) => (
                <tr key={load.id} className="border-t border-slate-800">
                  <td className="p-4">
                    <p className="font-semibold text-[#00A3FF]">
                      {load.broker_load_id || load.tracon_id || "-"}
                    </p>
                    <p className="text-xs text-slate-500">{load.tracon_id}</p>
                  </td>

                  <td className="p-4">
                    <p>{load.pickup || "-"} → {load.dropoff || "-"}</p>
                  </td>

                  <td className="p-4">{load.driver_name || "Unassigned"}</td>

                  <td className="p-4">
                    <span className={statusColor(load.status)}>
                      {load.status || "-"}
                    </span>
                  </td>

                  <td className="p-4 text-green-400">{money(load.rate)}</td>
                  <td className="p-4 text-yellow-400">{money(load.driver_pay)}</td>
                  <td className="p-4 text-orange-400">{money(load.fuel_cost)}</td>
                  <td
                    className={`p-4 ${
                      Number(load.profit || 0) >= 0
                        ? "text-[#00A3FF]"
                        : "text-red-400"
                    }`}
                  >
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

              {recentLoads.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-6 text-center text-slate-500">
                    No loads available yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({ title, value }: { title: string; value: number }) {
  let color = "text-[#00A3FF]";

  if (title === "Active Loads") color = "text-blue-400";
  if (title === "Delivered") color = "text-green-400";
  if (title === "Missing PODs") color = "text-red-400";
  if (title === "Active Drivers") color = "text-indigo-400";

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#07101A] p-5 shadow-[0_0_25px_rgba(0,0,0,0.45)] transition hover:border-[#00A3FF]">
      <p className="text-xs uppercase tracking-widest text-slate-500">
        {title}
      </p>
      <h2 className={`mt-3 text-3xl font-bold ${color}`}>{value}</h2>
    </div>
  );
}

function MoneyCard({
  title,
  value,
  color,
}: {
  title: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#07101A] p-5 shadow-[0_0_25px_rgba(0,0,0,0.45)] transition hover:border-[#00A3FF]">
      <p className="text-xs uppercase tracking-widest text-slate-500">
        {title}
      </p>
      <h2 className={`mt-3 text-2xl font-bold ${color}`}>{money(value)}</h2>
    </div>
  );
}

function InsightCard({
  title,
  value,
  subtitle,
  danger = false,
}: {
  title: string;
  value: string;
  subtitle: string;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 shadow-[0_0_25px_rgba(0,0,0,0.45)] ${
        danger
          ? "border-red-500/40 bg-red-500/10"
          : "border-slate-800 bg-[#07101A]"
      }`}
    >
      <p
        className={`text-xs uppercase tracking-widest ${
          danger ? "text-red-400" : "text-slate-500"
        }`}
      >
        {title}
      </p>
      <h2 className="mt-3 text-2xl font-bold text-white">{value}</h2>
      <p className="mt-1 text-sm text-slate-400">{subtitle}</p>
    </div>
  );
}

function RiskPill({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2">
      <p className="text-xs uppercase tracking-[0.2em] text-red-400">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-white">{value}</p>
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
  if (value === "in transit") return "text-blue-400";
  if (value === "delivered") return "text-green-400";

  return "text-slate-300";
}