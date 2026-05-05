"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import { hasRole } from "../lib/getUserRole";

type Driver = {
  id: string;
  name: string;
  email: string;
  active: boolean;
};

type Load = {
  id: string;
  tracon_id: string;
  broker_load_id?: string;
  bol_number?: string;
  pickup: string;
  dropoff: string;
  driver?: string;
  driver_name?: string;
  driver_email?: string;
  status: string;
  rate_con_url?: string;
  bol_url?: string;
  pod_url?: string;
  driver_lat?: number;
  driver_lng?: number;
};

const statuses = ["Pending", "Assigned", "Arrived", "In Transit", "Delivered"];

export default function DispatchPage() {
  const router = useRouter();

  const [loads, setLoads] = useState<Load[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);

  const [form, setForm] = useState({
    broker_load_id: "",
    bol_number: "",
    pickup: "",
    dropoff: "",
    driver_id: "",
    status: "Pending",
  });

  useEffect(() => {
    const checkRole = async () => {
      const allowed = await hasRole(["owner", "admin", "dispatcher", "manager"]);
      if (!allowed) router.push("/driver");
    };

    checkRole();
    fetchLoads();
    fetchDrivers();
  }, [router]);

  const fetchLoads = async () => {
    const { data, error } = await supabase
      .from("loads")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return alert(error.message);
    setLoads(data || []);
  };

  const fetchDrivers = async () => {
    const { data, error } = await supabase
      .from("drivers")
      .select("*")
      .eq("active", true)
      .order("name", { ascending: true });

    if (error) return alert(error.message);
    setDrivers(data || []);
  };

  const addLoad = async () => {
    if (!form.pickup || !form.dropoff || !form.driver_id) {
      alert("Fill pickup, dropoff, and select driver");
      return;
    }

    const selectedDriver = drivers.find((d) => d.id === form.driver_id);
    if (!selectedDriver) return alert("Driver not found");

    const traconId = `TN-${Math.floor(1000 + Math.random() * 9000)}`;

    const { error } = await supabase.from("loads").insert([
      {
        tracon_id: traconId,
        broker_load_id: form.broker_load_id,
        bol_number: form.bol_number,
        pickup: form.pickup,
        dropoff: form.dropoff,
        driver: selectedDriver.email,
        driver_name: selectedDriver.name,
        driver_email: selectedDriver.email,
        status: form.status,
      },
    ]);

    if (error) return alert(error.message);

    setForm({
      broker_load_id: "",
      bol_number: "",
      pickup: "",
      dropoff: "",
      driver_id: "",
      status: "Pending",
    });

    fetchLoads();
  };

  const updateStatus = async (loadId: string, status: string) => {
    const { error } = await supabase
      .from("loads")
      .update({ status })
      .eq("id", loadId);

    if (error) return alert(error.message);
    fetchLoads();
  };

  const changeDriver = async (loadId: string, driverId: string) => {
    const selectedDriver = drivers.find((d) => d.id === driverId);
    if (!selectedDriver) return;

    const { error } = await supabase
      .from("loads")
      .update({
        driver: selectedDriver.email,
        driver_name: selectedDriver.name,
        driver_email: selectedDriver.email,
        status: "Assigned",
      })
      .eq("id", loadId);

    if (error) return alert(error.message);
    fetchLoads();
  };

  const uploadFile = async (
    loadId: string,
    file: File | null,
    type: "RATECON" | "BOL" | "POD"
  ) => {
    if (!file) return;

    const fileName = `${type.toLowerCase()}-${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(fileName, file);

    if (uploadError) return alert(uploadError.message);

    const { data } = supabase.storage.from("documents").getPublicUrl(fileName);

    const updateData =
      type === "RATECON"
        ? { rate_con_url: data.publicUrl }
        : type === "BOL"
        ? { bol_url: data.publicUrl }
        : { pod_url: data.publicUrl };

    const { error } = await supabase.from("loads").update(updateData).eq("id", loadId);

    if (error) return alert(error.message);
    fetchLoads();
  };

  const deleteLoad = async (loadId: string) => {
    if (!confirm("Delete this load?")) return;

    const { error } = await supabase.from("loads").delete().eq("id", loadId);
    if (error) return alert(error.message);

    fetchLoads();
  };

  const totalLoads = loads.length;
  const pendingLoads = loads.filter((l) => l.status === "Pending").length;
  const arrivedLoads = loads.filter((l) => l.status === "Arrived").length;
  const transitLoads = loads.filter((l) => l.status === "In Transit").length;
  const deliveredLoads = loads.filter((l) => l.status === "Delivered").length;
  const missingPod = loads.filter((l) => l.status === "Delivered" && !l.pod_url).length;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-[#07101A] to-[#050A11] p-5 shadow-[0_0_30px_rgba(0,0,0,0.45)]">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-[#00A3FF]">Operations</p>
            <h1 className="mt-1 text-2xl font-bold text-white">Dispatch Board</h1>
            <p className="mt-1 text-sm text-slate-400">
              Live load control center — assign, track, update, and manage documents.
            </p>
          </div>

          <div className="rounded-xl border border-[#1E6BFF]/40 bg-[#0B1522] px-4 py-3 text-sm shadow-[0_0_20px_rgba(30,107,255,0.12)]">
            <p className="text-slate-400">Active Loads</p>
            <p className="text-2xl font-bold text-[#00A3FF]">
              {totalLoads - deliveredLoads}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6">
        <StatCard title="Total Loads" value={totalLoads} />
        <StatCard title="Pending" value={pendingLoads} />
        <StatCard title="Arrived" value={arrivedLoads} />
        <StatCard title="In Transit" value={transitLoads} />
        <StatCard title="Delivered" value={deliveredLoads} />
        <StatCard title="Missing POD" value={missingPod} />
      </div>

      <div className="rounded-2xl border border-slate-800 bg-[#07101A] p-4 shadow-[0_0_30px_rgba(0,0,0,0.45)]">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-white">Create Load</h2>
          <span className="text-xs text-slate-500">Dispatch entry</span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <Input placeholder="Broker Load ID" value={form.broker_load_id} onChange={(value) => setForm({ ...form, broker_load_id: value })} />
          <Input placeholder="BOL Number" value={form.bol_number} onChange={(value) => setForm({ ...form, bol_number: value })} />
          <Input placeholder="Pickup" value={form.pickup} onChange={(value) => setForm({ ...form, pickup: value })} />
          <Input placeholder="Dropoff" value={form.dropoff} onChange={(value) => setForm({ ...form, dropoff: value })} />

          <select
            value={form.driver_id}
            onChange={(e) => setForm({ ...form, driver_id: e.target.value })}
            className="rounded-xl border border-slate-700 bg-[#0B1522] p-2 text-sm text-white outline-none transition focus:border-[#00A3FF]"
          >
            <option value="">Select Driver</option>
            {drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>{driver.name}</option>
            ))}
          </select>

          <button
            onClick={addLoad}
            className="w-full rounded-xl bg-gradient-to-r from-[#1E6BFF] to-[#00A3FF] px-4 py-2 text-sm font-semibold text-white shadow-[0_0_18px_rgba(30,107,255,0.45)] transition hover:scale-[1.01]"
          >
            + Create Load
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
        {statuses.map((status) => {
          const columnLoads = loads.filter((load) => load.status === status);

          return (
            <div key={status} className="min-h-[420px] rounded-2xl border border-slate-800 bg-[#07101A] p-4 shadow-[0_0_25px_rgba(0,0,0,0.5)]">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className={`font-semibold ${statusColor(status)}`}>{status}</h3>
                  <p className="text-xs text-slate-500">Load status</p>
                </div>

                <span className="rounded-full border border-slate-700 bg-[#0B1522] px-2 py-1 text-xs text-slate-300">
                  {columnLoads.length}
                </span>
              </div>

              <div className="space-y-4">
                {columnLoads.map((load) => (
                  <LoadCard
                    key={load.id}
                    load={load}
                    drivers={drivers}
                    updateStatus={updateStatus}
                    changeDriver={changeDriver}
                    uploadFile={uploadFile}
                    deleteLoad={deleteLoad}
                  />
                ))}

                {columnLoads.length === 0 && (
                  <div className="rounded-xl border border-dashed border-slate-800 p-6 text-center text-sm text-slate-500">
                    No loads yet
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function LoadCard({ load, drivers, updateStatus, changeDriver, uploadFile, deleteLoad }: any) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#050A11] p-4 transition hover:border-[#00A3FF] hover:shadow-[0_0_18px_rgba(0,163,255,0.18)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-bold text-[#00A3FF]">{load.broker_load_id || load.tracon_id}</p>
          <p className="text-xs text-slate-500">{load.tracon_id}</p>
        </div>
        <button onClick={() => deleteLoad(load.id)} className="text-xs text-red-400 hover:text-red-300">Delete</button>
      </div>

      <div className="mt-3 rounded-xl bg-[#07101A] p-3">
        <p className="text-sm font-medium text-white">{load.pickup} → {load.dropoff}</p>
        <p className="mt-1 text-xs text-slate-400">Driver: {load.driver_name || "Unassigned"}</p>
        {load.bol_number && <p className="mt-1 text-xs text-slate-500">BOL: {load.bol_number}</p>}
      </div>

      <select value={load.status} onChange={(e) => updateStatus(load.id, e.target.value)} className="mt-3 w-full rounded-xl border border-slate-700 bg-[#0B1522] p-2 text-sm text-white outline-none focus:border-[#00A3FF]">
        {statuses.map((s) => <option key={s}>{s}</option>)}
      </select>

      <select value="" onChange={(e) => changeDriver(load.id, e.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-[#0B1522] p-2 text-sm text-white outline-none focus:border-[#00A3FF]">
        <option value="">Reassign Driver</option>
        {drivers.map((driver: Driver) => (
          <option key={driver.id} value={driver.id}>{driver.name}</option>
        ))}
      </select>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <DocButton label="Rate" url={load.rate_con_url} onUpload={(file) => uploadFile(load.id, file, "RATECON")} />
        <DocButton label="BOL" url={load.bol_url} onUpload={(file) => uploadFile(load.id, file, "BOL")} />
        <DocButton label="POD" url={load.pod_url} onUpload={(file) => uploadFile(load.id, file, "POD")} />
      </div>

      {load.driver_lat && load.driver_lng && (
        <a href={`https://www.google.com/maps?q=${load.driver_lat},${load.driver_lng}`} target="_blank" className="mt-3 block text-xs text-green-400 underline">
          View Map
        </a>
      )}

      <button
        onClick={() => {
          const link = `${window.location.origin}/track/${load.id}`;
          navigator.clipboard.writeText(link);
          alert(`Tracking link copied:\n${link}`);
        }}
        className="mt-3 w-full rounded-xl bg-[#111827] p-2 text-xs text-slate-300 transition hover:bg-slate-700 hover:text-white"
      >
        Copy Tracking Link
      </button>
    </div>
  );
}

function Input({ placeholder, value, onChange }: { placeholder: string; value: string; onChange: (value: string) => void }) {
  return (
    <input
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-xl border border-slate-700 bg-[#0B1522] p-2 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-[#00A3FF]"
    />
  );
}

function DocButton({ label, url, onUpload }: { label: string; url?: string; onUpload: (file: File | null) => void }) {
  if (url) {
    return <a href={url} target="_blank" className="rounded-lg bg-green-900/30 p-2 text-center text-green-400 hover:bg-green-900/50">View {label}</a>;
  }

  return (
    <label className="cursor-pointer rounded-lg bg-blue-900/30 p-2 text-center text-blue-400 hover:bg-blue-900/50">
      Upload {label}
      <input type="file" className="hidden" onChange={(e) => onUpload(e.target.files?.[0] || null)} />
    </label>
  );
}

function StatCard({ title, value }: { title: string; value: number }) {
  let color = "text-[#00A3FF]";
  if (title === "Pending") color = "text-yellow-400";
  if (title === "Arrived") color = "text-indigo-400";
  if (title === "In Transit") color = "text-blue-400";
  if (title === "Delivered") color = "text-green-400";
  if (title === "Missing POD") color = "text-red-400";

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#07101A] p-5 shadow-[0_0_25px_rgba(0,0,0,0.45)] transition hover:border-[#00A3FF]">
      <p className="text-xs uppercase tracking-widest text-slate-500">{title}</p>
      <h2 className={`mt-3 text-3xl font-bold ${color}`}>{value}</h2>
    </div>
  );
}

function statusColor(status: string) {
  if (status === "Pending") return "text-yellow-400";
  if (status === "Assigned") return "text-cyan-400";
  if (status === "Arrived") return "text-indigo-400";
  if (status === "In Transit") return "text-blue-400";
  if (status === "Delivered") return "text-green-400";
  return "text-slate-300";
}