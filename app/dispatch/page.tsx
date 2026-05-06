"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../components/Navbar";
import { supabase } from "../lib/supabase";
import { hasRole } from "../lib/getUserRole";

type Driver = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  pay_type?: string;
  pay_rate?: number;
  truck_mpg?: number;
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
  rate?: number;
  loaded_miles?: number;
  driver_pay?: number;
  fuel_cost?: number;
  deadhead_miles?: number;
  profit?: number;
};

const statuses = [
  "Pending",
  "Assigned",
  "Arrived at Pickup",
  "In Transit",
  "Delivered",
];

export default function DispatchPage() {
  const router = useRouter();

  const [loads, setLoads] = useState<Load[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [rateConFile, setRateConFile] = useState<File | null>(null);
  const [scanningRateCon, setScanningRateCon] = useState(false);

  const [form, setForm] = useState<{
    broker_load_id: string;
    bol_number: string;
    pickup: string;
    dropoff: string;
    driver_id: string;
    status: string;
    rate: string;
    loaded_miles: string;
    fuel_cost: string;
    deadhead_miles: string;
  }>({
    broker_load_id: "",
    bol_number: "",
    pickup: "",
    dropoff: "",
    driver_id: "",
    status: "Pending",
    rate: "",
    loaded_miles: "",
    fuel_cost: "",
    deadhead_miles: "",
  });

  useEffect(() => {
    const checkRole = async () => {
      const allowed = await hasRole(["owner", "admin", "dispatcher", "manager"]);
      if (!allowed) router.push("/driver");
    };

    checkRole();
    fetchLoads();
    fetchDrivers();

    const channel = supabase
      .channel("dispatch-loads-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "loads" },
        () => fetchLoads()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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

  const extractRateConText = async (file: File) => {
    if (file.type === "text/plain") {
      return await file.text();
    }

    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      const pdfjs = await import("pdfjs-dist");

      pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;

      let fullText = "";

      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const content = await page.getTextContent();

        const pageText = content.items
          .map((item: any) => item.str)
          .join(" ");

        fullText += `\n${pageText}`;
      }

      return fullText;
    }

    return await file.text();
  };

  const scanRateCon = async () => {
    if (!rateConFile) {
      alert("Upload a rate confirmation PDF first");
      return;
    }

    try {
      setScanningRateCon(true);

      const fileText = await rateConFile.text();

      if (!fileText.trim()) {
        alert("No text found in this rate confirmation");
        return;
      }

      const response = await fetch("/api/scan-ratecon", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: fileText }),
      });

      const data = await response.json();

      if (data.error) {
        alert(data.error);
        return;
      }

      setForm((prev) => ({
        ...prev,
        broker_load_id: data.broker_load_id || prev.broker_load_id,
        bol_number: data.bol_number || prev.bol_number,
        pickup: data.pickup || prev.pickup,
        dropoff: data.dropoff || prev.dropoff,
        rate: data.rate || prev.rate,
        loaded_miles: data.loaded_miles || prev.loaded_miles,
      }));

      alert("Rate confirmation scanned. Review details before creating load.");
    } catch (error) {
      console.error(error);
      alert("Failed to scan rate confirmation");
    } finally {
      setScanningRateCon(false);
    }
  };

  const calculateDriverPay = (driver: Driver, rate: number, loadedMiles: number) => {
    if (driver.pay_type === "CPM") return loadedMiles * Number(driver.pay_rate || 0);
    if (driver.pay_type === "Percentage") return rate * (Number(driver.pay_rate || 0) / 100);
    if (driver.pay_type === "Flat") return Number(driver.pay_rate || 0);
    return 0;
  };

  const addLoad = async () => {
    if (!form.pickup || !form.dropoff || !form.driver_id) {
      alert("Fill pickup, dropoff, and select driver");
      return;
    }

    const selectedDriver = drivers.find((d) => d.id === form.driver_id);
    if (!selectedDriver) return alert("Driver not found");

    const rate = Number(form.rate || 0);
    const loadedMiles = Number(form.loaded_miles || 0);
    const fuelCost = Number(form.fuel_cost || 0);
    const deadheadMiles = Number(form.deadhead_miles || 0);
    const driverPay = calculateDriverPay(selectedDriver, rate, loadedMiles);
    const profit = rate - driverPay - fuelCost;

    let rateConUrl = "";

    if (rateConFile) {
      const fileName = `ratecon-${Date.now()}-${rateConFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("documents")
        .upload(fileName, rateConFile);

      if (uploadError) return alert(uploadError.message);

      const { data } = supabase.storage.from("documents").getPublicUrl(fileName);
      rateConUrl = data.publicUrl;
    }

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
        rate,
        loaded_miles: loadedMiles,
        driver_pay: driverPay,
        fuel_cost: fuelCost,
        deadhead_miles: deadheadMiles,
        profit,
        rate_con_url: rateConUrl || null,
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
      rate: "",
      loaded_miles: "",
      fuel_cost: "",
      deadhead_miles: "",
    });

    setRateConFile(null);
    fetchLoads();
  };

  const updateStatus = async (loadId: string, status: string) => {
    const { error } = await supabase
      .from("loads")
      .update({ status: status.trim() })
      .eq("id", loadId);

    if (error) return alert(error.message);
    fetchLoads();
  };

  const handleDrop = async (newStatus: string) => {
    if (!draggingId) return;
    await updateStatus(draggingId, newStatus);
    setDraggingId(null);
  };

  const changeDriver = async (loadId: string, driverId: string) => {
    const selectedDriver = drivers.find((d) => d.id === driverId);
    if (!selectedDriver) return;

    const load = loads.find((l) => l.id === loadId);
    if (!load) return;

    const rate = Number(load.rate || 0);
    const loadedMiles = Number(load.loaded_miles || 0);
    const fuelCost = Number(load.fuel_cost || 0);
    const driverPay = calculateDriverPay(selectedDriver, rate, loadedMiles);
    const profit = rate - driverPay - fuelCost;

    const { error } = await supabase
      .from("loads")
      .update({
        driver: selectedDriver.email,
        driver_name: selectedDriver.name,
        driver_email: selectedDriver.email,
        driver_pay: driverPay,
        profit,
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
  const pendingLoads = loads.filter((l) => clean(l.status) === "pending").length;
  const arrivedLoads = loads.filter((l) => clean(l.status) === "arrived at pickup").length;
  const transitLoads = loads.filter((l) => clean(l.status) === "in transit").length;
  const deliveredLoads = loads.filter((l) => clean(l.status) === "delivered").length;
  const missingPod = loads.filter((l) => clean(l.status) === "delivered" && !l.pod_url).length;

  return (
    <div className="min-h-screen bg-[#020617] p-3 text-white sm:p-6">
      <div className="space-y-6">
        <Navbar />

        <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-[#07101A] to-[#050A11] p-5 shadow-[0_0_30px_rgba(0,0,0,0.45)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[#00A3FF]">
                Operations
              </p>
              <h1 className="mt-2 text-base uppercase tracking-[0.35em] text-white">
                Live Load Control Center
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                Drag loads between columns to update status in real time.
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

        {missingPod > 0 && (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 shadow-[0_0_25px_rgba(239,68,68,0.15)]">
            <p className="text-xs uppercase tracking-[0.3em] text-red-400">
              Attention Required
            </p>
            <h2 className="mt-2 text-lg font-semibold text-white">
              Missing Proof of Delivery
            </h2>
            <p className="mt-1 text-sm text-slate-300">
              {missingPod} delivered load{missingPod > 1 ? "s are" : " is"} missing POD documentation.
            </p>
          </div>
        )}

        <div className="rounded-2xl border border-slate-800 bg-[#07101A] p-4 shadow-[0_0_30px_rgba(0,0,0,0.45)]">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-white">Create Load</h2>
            <span className="text-xs text-slate-500">Dispatch entry</span>
          </div>

          <div className="mb-4 rounded-xl border border-purple-500/30 bg-purple-500/10 p-4">
            <p className="text-xs uppercase tracking-[0.3em] text-purple-300">
              AI Rate Con Import
            </p>

            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <input
                type="file"
                accept=".pdf,.txt"
                onChange={(e) => setRateConFile(e.target.files?.[0] || null)}
                className="rounded-xl border border-slate-700 bg-[#0B1522] p-2 text-sm text-white"
              />

              <button
                onClick={scanRateCon}
                disabled={scanningRateCon}
                className="rounded-xl bg-purple-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-purple-500 disabled:opacity-50"
              >
                {scanningRateCon ? "Scanning..." : "AI Scan Rate Con"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
                <option key={driver.id} value={driver.id}>
                  {driver.name} ({driver.pay_type || "No Pay Setup"})
                </option>
              ))}
            </select>

            <Input placeholder="Load Revenue" value={form.rate} onChange={(value) => setForm({ ...form, rate: value })} />
            <Input placeholder="Loaded Miles" value={form.loaded_miles} onChange={(value) => setForm({ ...form, loaded_miles: value })} />
            <Input placeholder="Fuel Cost" value={form.fuel_cost} onChange={(value) => setForm({ ...form, fuel_cost: value })} />
            <Input placeholder="Deadhead Miles" value={form.deadhead_miles} onChange={(value) => setForm({ ...form, deadhead_miles: value })} />

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
            const columnLoads = loads.filter((load) => clean(load.status) === clean(status));

            return (
              <div
                key={status}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => handleDrop(status)}
                className={`min-h-[420px] rounded-2xl border p-4 shadow-[0_0_25px_rgba(0,0,0,0.5)] transition-all duration-200 ease-out ${
                  draggingId
                    ? "border-[#00A3FF]/70 bg-[#0B1522] shadow-[0_0_28px_rgba(0,163,255,0.18)]"
                    : "border-slate-800 bg-[#07101A]"
                }`}
              >
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className={`font-semibold ${statusColor(status)}`}>
                      {status}
                    </h3>
                    <p className={`text-xs ${draggingId ? "text-[#00A3FF]" : "text-slate-500"}`}>
                      Drop load here to mark {status}
                    </p>
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
                      setDraggingId={setDraggingId}
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
    </div>
  );
}

function LoadCard({
  load,
  drivers,
  setDraggingId,
  updateStatus,
  changeDriver,
  uploadFile,
  deleteLoad,
}: {
  load: Load;
  drivers: Driver[];
  setDraggingId: (id: string | null) => void;
  updateStatus: (loadId: string, status: string) => void;
  changeDriver: (loadId: string, driverId: string) => void;
  uploadFile: (loadId: string, file: File | null, type: "RATECON" | "BOL" | "POD") => void;
  deleteLoad: (loadId: string) => void;
}) {
  return (
    <div
      draggable
      onDragStart={() => setDraggingId(load.id)}
      onDragEnd={() => setDraggingId(null)}
      className={`cursor-grab rounded-2xl border p-4 transition-all duration-200 ease-out active:cursor-grabbing hover:-translate-y-1 hover:scale-[1.01] active:scale-[0.98] ${
        clean(load.status) === "delivered" && !load.pod_url
          ? "border-red-500/50 bg-red-500/10"
          : "border-slate-800 bg-[#050A11] hover:border-[#00A3FF]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-base font-bold text-[#00A3FF]">
            {load.broker_load_id || load.tracon_id}
          </p>
          <p className="text-xs text-slate-500">{load.tracon_id}</p>
        </div>

        <button onClick={() => deleteLoad(load.id)} className="text-xs text-red-400 hover:text-red-300">
          Delete
        </button>
      </div>

      <div className="mt-3 rounded-xl bg-[#07101A] p-3">
        <p className="text-sm font-medium text-white">
          {load.pickup} → {load.dropoff}
        </p>

        <p className="mt-1 text-xs text-slate-400">
          Driver: {load.driver_name || "Unassigned"}
        </p>

        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
          <MoneyBox label="Revenue" value={load.rate || 0} color="text-green-400" />
          <MoneyBox label="Driver Pay" value={load.driver_pay || 0} color="text-yellow-400" />
          <MoneyBox label="Fuel" value={load.fuel_cost || 0} color="text-orange-400" />
          <MoneyBox
            label="Profit"
            value={load.profit || 0}
            color={Number(load.profit || 0) >= 0 ? "text-[#00A3FF]" : "text-red-400"}
          />
        </div>

        {load.loaded_miles ? (
          <p className="mt-2 text-xs text-slate-500">
            Miles: {load.loaded_miles} loaded
          </p>
        ) : null}

        {load.bol_number && (
          <p className="mt-2 text-xs text-slate-500">BOL: {load.bol_number}</p>
        )}
      </div>

      <select
        value={load.status}
        onChange={(e) => updateStatus(load.id, e.target.value)}
        className="mt-3 w-full rounded-xl border border-slate-700 bg-[#0B1522] p-2 text-sm text-white outline-none focus:border-[#00A3FF]"
      >
        {statuses.map((s) => (
          <option key={s}>{s}</option>
        ))}
      </select>

      <select
        value=""
        onChange={(e) => changeDriver(load.id, e.target.value)}
        className="mt-2 w-full rounded-xl border border-slate-700 bg-[#0B1522] p-2 text-sm text-white outline-none focus:border-[#00A3FF]"
      >
        <option value="">Reassign Driver</option>
        {drivers.map((driver) => (
          <option key={driver.id} value={driver.id}>
            {driver.name}
          </option>
        ))}
      </select>

      <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
        <DocButton label="Rate" url={load.rate_con_url} onUpload={(file) => uploadFile(load.id, file, "RATECON")} />
        <DocButton label="BOL" url={load.bol_url} onUpload={(file) => uploadFile(load.id, file, "BOL")} />
        <DocButton label="POD" url={load.pod_url} onUpload={(file) => uploadFile(load.id, file, "POD")} />
      </div>

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

function MoneyBox({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg bg-[#0B1522] p-2">
      <p className="text-slate-500">{label}</p>
      <p className={`font-semibold ${color}`}>
        ${Number(value || 0).toLocaleString()}
      </p>
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
    return (
      <a href={url} target="_blank" className="rounded-lg bg-green-900/30 p-2 text-center text-green-400 hover:bg-green-900/50">
        View {label}
      </a>
    );
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
    <div className="rounded-2xl border border-slate-800 bg-[#07101A] p-5">
      <p className="text-xs uppercase tracking-widest text-slate-500">{title}</p>
      <h2 className={`mt-3 text-3xl font-bold ${color}`}>{value}</h2>
    </div>
  );
}

function statusColor(status: string) {
  if (status === "Pending") return "text-yellow-400";
  if (status === "Assigned") return "text-cyan-400";
  if (status === "Arrived at Pickup") return "text-indigo-400";
  if (status === "In Transit") return "text-blue-400";
  if (status === "Delivered") return "text-green-400";
  return "text-slate-300";
}

function clean(value?: string) {
  return value?.trim().toLowerCase() || "";
}