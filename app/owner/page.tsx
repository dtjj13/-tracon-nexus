"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { getUserRole, hasRole } from "../lib/getUserRole";
import Navbar from "../components/Navbar";


type Load = {
  id: string;
  tracon_id: string;
    broker_load_id?: string;
  status: string;
  pod_url?: string;
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

  const loadData = async () => {
    await fetchData();
  };

  checkRole();
  loadData();

  const interval = setInterval(fetchData, 10000);

  return () => clearInterval(interval);
}, [router]);

  const fetchData = async () => {
    const { data: loadData } = await supabase.from("loads").select("*");
    const { data: driverData } = await supabase.from("drivers").select("*");

    setLoads(loadData || []);
    setDrivers(driverData || []);
  };

  const totalLoads = loads.length;
  const activeLoads = loads.filter(
    (load) => load.status !== "Delivered"
  ).length;
  const deliveredLoads = loads.filter(
    (load) => load.status === "Delivered"
  ).length;
  const missingPODs = loads.filter(
    (load) => load.status === "Delivered" && !load.pod_url
  ).length;
  const activeDrivers = drivers.filter((driver) => driver.active).length;
const alerts: string[] = [];

if (missingPODs > 0) {
  alerts.push(`⚠️ ${missingPODs} delivered loads missing POD`);
}

if (activeLoads > 5) {
  alerts.push(`🚚 High active load count (${activeLoads})`);
}

if (activeDrivers === 0) {
  alerts.push(`❌ No active drivers`);
}
  return (
    <div className="min-h-screen bg-[#050A11] text-white p-3 sm:p-6">
      <Navbar />

      <p className="text-slate-400">Owner Dashboard</p>
{alerts.length > 0 && (
  <div className="mt-4 space-y-2">
    {alerts.map((alert, i) => (
      <div
        key={i}
        className="rounded-lg border border-red-500 bg-red-900/20 p-3 text-red-400"
      >
        {alert}
      </div>
    ))}
  </div>
)}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card title="Total Loads" value={totalLoads} />
        <Card title="Active Loads" value={activeLoads} />
        <Card title="Delivered" value={deliveredLoads} />
        <Card title="Missing PODs" value={missingPODs} />
        <Card title="Active Drivers" value={activeDrivers} />
      </div>
      <div className="mt-8">
  <h2 className="text-lg font-semibold mb-3">Recent Loads</h2>

 <div className="mt-8 rounded-xl border border-slate-800 overflow-x-auto">
    <table className="w-full text-sm">
      <thead className="bg-[#07101A] text-slate-400">
        <tr>
          <th className="p-3 text-left">ID</th>
          <th className="p-3 text-left">Status</th>
          <th className="p-3 text-left">POD</th>
        </tr>
      </thead>

      <tbody>
        {loads.slice(0, 5).map((load) => (
          <tr key={load.id} className="border-t border-slate-800">
           <td>
  <span className="text-blue-400 font-semibold">
    {load.tracon_id}
  </span>
  <div className="text-xs text-slate-400">
    {load.broker_load_id || "No broker ID"}
  </div>
</td>
            <td className="p-3">{load.status}</td>
            <td className="p-3">
              {load.pod_url ? (
                <span className="text-green-400">Uploaded</span>
              ) : (
                <span className="text-red-400">Missing</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</div>
    </div>
  );
}

function Card({ title, value }: { title: string; value: number }) {
  let color = "text-blue-400";

  if (title === "Active Loads") color = "text-yellow-400";
  if (title === "Delivered") color = "text-green-400";
  if (title === "Missing PODs") color = "text-red-400";

  return (
    <div className="rounded-xl border border-slate-800 bg-[#07101A] p-5 hover:border-blue-500 transition">
      <p className="text-slate-400 text-sm">{title}</p>
      <h2 className={`mt-2 text-3xl font-bold ${color}`}>{value}</h2>
    </div>
  );
}
