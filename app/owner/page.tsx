"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { getUserRole } from "../lib/getUserRole";
import Navbar from "../components/Navbar";

type Load = {
  id: string;
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
      const role = await getUserRole();

      if (!role) {
        router.push("/login");
        return;
      }

      if (role !== "owner" && role !== "admin") {
        router.push("/dispatch");
      }
    };

    checkRole();
    fetchData();
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

  return (
    <div className="min-h-screen bg-[#050A11] text-white p-6">
      <Navbar />

      <p className="text-slate-400">Owner Dashboard</p>

      <div className="mt-6 grid grid-cols-5 gap-4">
        <Card title="Total Loads" value={totalLoads} />
        <Card title="Active Loads" value={activeLoads} />
        <Card title="Delivered" value={deliveredLoads} />
        <Card title="Missing PODs" value={missingPODs} />
        <Card title="Active Drivers" value={activeDrivers} />
      </div>
    </div>
  );
}

function Card({ title, value }: { title: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-[#07101A] p-5">
      <p className="text-slate-400 text-sm">{title}</p>
      <h2 className="mt-2 text-3xl font-bold text-blue-400">{value}</h2>
    </div>
  );
}