"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../components/Navbar";
import { supabase } from "../lib/supabase";
import { hasRole } from "../lib/getUserRole";
import { formatDistanceToNow } from "date-fns";

type Driver = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  pay_type?: string;
  pay_rate?: number;
  truck_mpg?: number;
   phone?: string;
   truck_id?: string | null
truck_number?: string | null
};
type Truck = {
  id: string;
  truck_number: string;
  active: boolean;
  mpg?: number;
};
type Load = {
  id: string;
  tracon_id: string;
  broker_name?: string;
  broker_load_id?: string;
  bol_number?: string;
  pickup: string;
  dropoff: string;
  driver?: string;
  driver_name?: string;
  driver_email?: string;
  truck_number?: string;
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
  assigned_at?: string;
arrived_pickup_at?: string;
in_transit_at?: string;
delivered_at?: string;
tracking_active?: boolean;
tracking_started_at?: string;
updated_at?: string;
};
type FuelSettings = {
  default_diesel_price?: number | null;
  default_mpg?: number | null;
  default_deadhead_percent?: number | null;
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
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [role, setRole] = useState("");
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [rateConFile, setRateConFile] = useState<File | null>(null);
  const [scanningRateCon, setScanningRateCon] = useState(false);
const [fuelSettings, setFuelSettings] = useState<FuelSettings | null>(null);
const [editingLoadId, setEditingLoadId] = useState<string | null>(null);

const [editForm, setEditForm] = useState({
  broker_load_id: "",
  pickup: "",
  dropoff: "",
  rate: "",
  loaded_miles: "",
  deadhead_miles: "",
  fuel_cost: "",
});
const startEditLoad = (load: Load) => {
  setEditingLoadId(load.id);

  setEditForm({
    broker_load_id: load.broker_load_id || "",
    pickup: load.pickup || "",
    dropoff: load.dropoff || "",
    rate: String(load.rate || ""),
    loaded_miles: String(load.loaded_miles || ""),
    deadhead_miles: String(load.deadhead_miles || ""),
    fuel_cost: String(load.fuel_cost || ""),
  });
};

const saveEditedLoad = async (loadId: string) => {
  const { error } = await supabase
    .from("loads")
    .update({
      broker_load_id: editForm.broker_load_id,
      pickup: editForm.pickup,
      dropoff: editForm.dropoff,
      rate: Number(editForm.rate || 0),
      loaded_miles: Number(editForm.loaded_miles || 0),
      deadhead_miles: Number(editForm.deadhead_miles || 0),
      fuel_cost: Number(editForm.fuel_cost || 0),
    })
    .eq("id", loadId);

  if (error) {
    alert(error.message);
    return;
  }

  setEditingLoadId(null);
  fetchLoads();
};
  const [form, setForm] = useState<{
    broker_name?: string;
    broker_load_id: string;
    bol_number: string;
    pickup: string;
    dropoff: string;
    truck_number: string;
    truck_id: string;
    driver_id: string;
    status: string;
    rate: string;
    loaded_miles: string;
    fuel_cost: string;
    deadhead_miles: string;
  }>({
   broker_name: "",
    broker_load_id: "",
    bol_number: "",
    pickup: "",
    dropoff: "",
    truck_number: "",
    truck_id: "",
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
const getRole = async () => {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user?.email) return;

  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("email", user.email)
    .single();

  setRole(data?.role || "");
};

getRole();
    checkRole();
    fetchLoads();
    fetchDrivers();
    fetchTrucks();
fetchFuelSettings();

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
console.log("Drivers from DB:", data);
    if (error) return alert(error.message);
    setDrivers(data || []);
  };
const fetchTrucks = async () => {
  const { data, error } = await supabase
    .from("trucks")
    .select("*")
    .eq("active", true)
    .order("truck_number", { ascending: true });

  if (error) return alert(error.message);
  setTrucks(data || []);
};
const fetchFuelSettings = async () => {
  const { data, error } = await supabase
  .from("company_settings")
  .select("default_diesel_price, default_mpg, default_deadhead_percent")
  .eq("id", 1)
  .single();

  if (!error && data) {
    setFuelSettings(data);
  }
};
  const extractRateConText = async (file: File) => {
    if (file.type === "text/plain") {
      return await file.text();
    }

   if (
  file.type === "application/pdf" ||
  file.name.toLowerCase().endsWith(".pdf")
) {
  return "PDF uploaded";
}

    return await file.text();
  };

  const scanRateCon = async () => {
  if (!rateConFile) {
    alert("Upload a rate confirmation first");
    return;
  }

  try {
    setScanningRateCon(true);

    const formData = new FormData();
    formData.append("file", rateConFile);

    const response = await fetch("/api/scan-ratecon", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

if (data.error) {
  alert(data.error);
  return;
}

setForm((prev) => ({
  ...prev,
  broker_name: data.broker_name || "",
  broker_load_id: data.broker_load_id || "",
  pickup: data.pickup || "",
  dropoff: data.dropoff || "",
  rate: data.rate || "",
  loaded_miles: data.loaded_miles || "",
  bol_number: data.bol_number || "",
}));

alert("Rate confirmation scanned. Review before creating load.");
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
const deadheadMiles = Number(form.deadhead_miles || 0);

const selectedTruck = trucks.find(
  (t) => t.id === form.truck_id || t.id === selectedDriver.truck_id
);

const manualFuelCost = Number(form.fuel_cost || 0);

const fuelCost =
  manualFuelCost > 0
    ? manualFuelCost
    : calculateEstimatedFuelCost({
        loadedMiles,
        deadheadMiles,
        truckMpg: selectedTruck?.mpg,
        defaultMpg: fuelSettings?.default_mpg,
        dieselPrice: fuelSettings?.default_diesel_price,
        defaultDeadheadPercent:
          fuelSettings?.default_deadhead_percent,
      });

const driverPay = calculateDriverPay(
  selectedDriver,
  rate,
  loadedMiles
);

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
console.log("Fuel Engine:", {
  loadedMiles,
  deadheadMiles,
  selectedTruck,
  fuelSettings,
  fuelCost,
  driverPay,
  profit,
});
    const { error } = await supabase.from("loads").insert([
      {
        tracon_id: traconId,
        broker_name: form.broker_name,
        broker_load_id: form.broker_load_id,
        bol_number: form.bol_number,
        pickup: form.pickup,
        dropoff: form.dropoff,
        truck_id: selectedTruck?.id || null,
        truck_number:
  selectedTruck?.truck_number ||
  selectedDriver.truck_number ||
  "",
        driver: selectedDriver.email,
        driver_name: selectedDriver.name,
        driver_email: selectedDriver.email,
        driver_phone: selectedDriver.phone || "",
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
      broker_name: "",
      broker_load_id: "",
      bol_number: "",
      pickup: "",
      dropoff: "",
      truck_number: "",
      driver_id: "",
      status: "Pending",
      rate: "",
      loaded_miles: "",
      fuel_cost: "",
      deadhead_miles: "",
      truck_id: "",
    });

    setRateConFile(null);
    fetchLoads();
  };

  const updateStatus = async (loadId: string, status: string) => {
  const cleanStatus = status.trim();

  const timestampUpdate: {
    assigned_at?: string;
    arrived_pickup_at?: string;
    in_transit_at?: string;
    delivered_at?: string;
  } = {};

  if (cleanStatus === "Assigned") timestampUpdate.assigned_at = new Date().toISOString();
  if (cleanStatus === "Arrived at Pickup") timestampUpdate.arrived_pickup_at = new Date().toISOString();
  if (cleanStatus === "In Transit") timestampUpdate.in_transit_at = new Date().toISOString();
  if (cleanStatus === "Delivered") timestampUpdate.delivered_at = new Date().toISOString();

  const { error } = await supabase
    .from("loads")
    .update({
      status: cleanStatus,
      ...timestampUpdate,
      updated_at: new Date().toISOString(),
    })
    .eq("id", loadId);

  if (error) return alert(error.message);
await supabase.from("notifications").insert({
  title: `Load ${loadId.slice(0, 6)} Updated`,
  message: `Status changed to ${cleanStatus}`,
  load_id: loadId,
  type: cleanStatus.toLowerCase(),
});
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
  driver_phone: selectedDriver.phone || "",
  driver_pay: driverPay,
  profit,
  status: "Assigned",
  updated_at: new Date().toISOString(),
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
const updateBol = async (loadId: string, bol: string) => {
  const { error } = await supabase
    .from("loads")
    .update({
      bol_number: bol,
      updated_at: new Date().toISOString()
    })
    .eq("id", loadId);

  if (error) {
    console.error(error.message);
    return;
  }

  fetchLoads();
};

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
            <Input placeholder="Broker Name" value={form.broker_name || ""} onChange={(value) => setForm({ ...form, broker_name: value })} />
            <Input placeholder="Broker Load ID" value={form.broker_load_id} onChange={(value) => setForm({ ...form, broker_load_id: value })} />
            <Input placeholder="Pickup" value={form.pickup} onChange={(value) => setForm({ ...form, pickup: value })} />
            <Input placeholder="Dropoff" value={form.dropoff} onChange={(value) => setForm({ ...form, dropoff: value })} />
            <Input
  placeholder="Deadhead Miles"
  value={form.deadhead_miles}
  onChange={(value) =>
    setForm({ ...form, deadhead_miles: value })
  }
/>

            <select
  value={form.driver_id}
  onChange={(e) => {
    

    const driverId = e.target.value;

    const selectedDriver = drivers.find(
      (driver) => driver.id === driverId
    );

    console.log("Driver selected:", selectedDriver);

    setForm({
      ...form,
      driver_id: driverId,
      truck_id: selectedDriver?.truck_id || "",
      truck_number: selectedDriver?.truck_number || "",
    });
  }}
  className="rounded-xl border border-slate-700 bg-[#0B1522] p-2 text-sm text-white outline-none transition focus:border-[#00A3FF]"
>
              <option value="">Select Driver</option>
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.name} ({driver.pay_type || "No Pay Setup"})
                </option>
              ))}
            </select>
<select
  value={form.truck_id}
  onChange={(e) => {
    const truckId = e.target.value;

    const selectedTruck = trucks.find((truck) => truck.id === truckId);

    setForm({
      ...form,
      truck_id: truckId,
      truck_number: selectedTruck?.truck_number || "",
    });
  }}
  className="rounded-xl border border-slate-700 bg-[#0B1522] p-2 text-sm text-white outline-none transition focus:border-[#00A3FF]"
>
  <option value="">Select Truck</option>

  {trucks.map((truck) => (
    <option key={truck.id} value={truck.id}>
      {truck.truck_number}
    </option>
  ))}
</select>
            <Input placeholder="Load Revenue" value={form.rate} onChange={(value) => setForm({ ...form, rate: value })} />
            <Input placeholder="Loaded Miles" value={form.loaded_miles} onChange={(value) => setForm({ ...form, loaded_miles: value })} />
            <Input placeholder="Fuel Cost" value={form.fuel_cost} onChange={(value) => setForm({ ...form, fuel_cost: value })} />

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
                      role={role}
                      drivers={drivers}
                      editingLoadId={editingLoadId}
editForm={editForm}
setEditForm={setEditForm}
setEditingLoadId={setEditingLoadId}
startEditLoad={startEditLoad}
saveEditedLoad={saveEditedLoad}
                      setDraggingId={setDraggingId}
                      updateStatus={updateStatus}
                      changeDriver={changeDriver}
                      uploadFile={uploadFile}
                      deleteLoad={deleteLoad}
                      updateBol={updateBol}
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

function calculateEstimatedFuelCost({
  loadedMiles,
  deadheadMiles,
  truckMpg,
  defaultMpg,
  dieselPrice,
  defaultDeadheadPercent,
}: {
  loadedMiles: number;
  deadheadMiles: number;
  truckMpg?: number | null;
  defaultMpg?: number | null;
  dieselPrice?: number | null;
  defaultDeadheadPercent?: number | null;
}) {
  const mpg = Number(truckMpg || defaultMpg || 0);
  const fuelPrice = Number(dieselPrice || 0);

  if (!loadedMiles || !mpg || !fuelPrice) return 0;

  const estimatedDeadhead =
    deadheadMiles > 0
      ? deadheadMiles
      : defaultDeadheadPercent
      ? loadedMiles * (Number(defaultDeadheadPercent) / 100)
      : 0;

  const totalMiles = loadedMiles + estimatedDeadhead;

  return (totalMiles / mpg) * fuelPrice;
}
function LoadCard({
  load,
  drivers,
  role, 
  editingLoadId,
editForm,
setEditForm,
startEditLoad,
saveEditedLoad,
setEditingLoadId,
  setDraggingId,
  updateStatus,
  changeDriver,
  uploadFile,
  deleteLoad,
  updateBol,
}: {
  editingLoadId: string | null;
  setEditingLoadId: React.Dispatch<
  React.SetStateAction<string | null>
>;

editForm: {
  broker_load_id: string;
  pickup: string;
  dropoff: string;
  rate: string;
  loaded_miles: string;
  deadhead_miles: string;
  fuel_cost: string;
};

setEditForm: React.Dispatch<
  React.SetStateAction<{
    broker_load_id: string;
    pickup: string;
    dropoff: string;
    rate: string;
    loaded_miles: string;
    deadhead_miles: string;
    fuel_cost: string;
  }>
>;

startEditLoad: (load: Load) => void;

saveEditedLoad: (loadId: string) => Promise<void>;
  load: Load;
  drivers: Driver[];
  role: string;
  setDraggingId: (id: string | null) => void;
  updateStatus: (loadId: string, status: string) => void;
  changeDriver: (loadId: string, driverId: string) => void;
  uploadFile: (loadId: string, file: File | null, type: "RATECON" | "BOL" | "POD") => void;
  deleteLoad: (loadId: string) => void;
  updateBol: (loadId: string, bol: string) => void;
}) {
  return (
    <div
      draggable
      onDragStart={() => setDraggingId(load.id)}
      onDragEnd={() => setDraggingId(null)}
     className={`cursor-grab rounded-2xl border p-4 transition-all duration-200 ease-out active:cursor-grabbing hover:-translate-y-1 hover:scale-[1.01] active:scale-[0.98] ${
  clean(load.status) === "pending"
    ? "border-yellow-500/30 bg-[#050A11] shadow-[0_0_18px_rgba(234,179,8,0.08)] hover:border-yellow-400"
    : clean(load.status) === "assigned"
    ? "border-blue-500/30 bg-[#050A11] shadow-[0_0_18px_rgba(59,130,246,0.08)] hover:border-blue-400"
    : clean(load.status) === "arrived at pickup"
    ? "border-purple-500/30 bg-[#050A11] shadow-[0_0_18px_rgba(168,85,247,0.08)] hover:border-purple-400"
    : clean(load.status) === "in transit"
    ? "border-cyan-500/30 bg-[#050A11] shadow-[0_0_18px_rgba(34,211,238,0.08)] hover:border-cyan-400"
    : clean(load.status) === "delivered"
    ? "border-green-500/30 bg-[#050A11] shadow-[0_0_18px_rgba(34,197,94,0.08)] hover:border-green-400"
    : "border-slate-800 bg-[#050A11] hover:border-[#00A3FF]"
}`}
    >
     <div className="flex items-start justify-between gap-3">
  <div>
    <p className="text-base font-bold text-[#00A3FF]">
      {load.broker_load_id || load.tracon_id}
    </p>

    <p className="text-xs text-slate-500">
      {load.broker_name || load.tracon_id}
    </p>
  </div>

  <div className="flex items-center gap-3">
    <button
      onClick={() => startEditLoad(load)}
      className="text-xs text-cyan-400 hover:text-cyan-300"
    >
      Edit
    </button>

    <button
      onClick={() => deleteLoad(load.id)}
      className="text-xs text-red-400 hover:text-red-300"
    >
      Delete
    </button>
  </div>
</div>
{editingLoadId === load.id && (
  <div className="mb-3 rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-3 space-y-2">
    <Input
      placeholder="Broker Load ID"
      value={editForm.broker_load_id}
      onChange={(value) =>
        setEditForm({
          ...editForm,
          broker_load_id: value,
        })
      }
    />

    <Input
      placeholder="Pickup"
      value={editForm.pickup}
      onChange={(value) =>
        setEditForm({
          ...editForm,
          pickup: value,
        })
      }
    />

    <Input
      placeholder="Dropoff"
      value={editForm.dropoff}
      onChange={(value) =>
        setEditForm({
          ...editForm,
          dropoff: value,
        })
      }
    />

    <div className="grid grid-cols-2 gap-2">
      <Input
        placeholder="Revenue"
        value={editForm.rate}
        onChange={(value) =>
          setEditForm({
            ...editForm,
            rate: value,
          })
        }
      />

      <Input
        placeholder="Loaded Miles"
        value={editForm.loaded_miles}
        onChange={(value) =>
          setEditForm({
            ...editForm,
            loaded_miles: value,
          })
        }
      />

      <Input
        placeholder="Deadhead"
        value={editForm.deadhead_miles}
        onChange={(value) =>
          setEditForm({
            ...editForm,
            deadhead_miles: value,
          })
        }
      />

      <Input
        placeholder="Fuel"
        value={editForm.fuel_cost}
        onChange={(value) =>
          setEditForm({
            ...editForm,
            fuel_cost: value,
          })
        }
      />
    </div>

    <div className="flex gap-2">
      <button
        onClick={() => saveEditedLoad(load.id)}
        className="rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold text-white"
      >
        Save Changes
      </button>

      <button
        onClick={() => setEditingLoadId(null)}
        className="rounded-lg bg-slate-700 px-3 py-2 text-xs text-white"
      >
        Cancel
      </button>
    </div>
  </div>
)}
      <div className="mt-3 rounded-xl bg-[#07101A] p-4">
        <p className="text-sm font-medium text-white">
          {shortLocation(load.pickup)} → {shortLocation(load.dropoff)}
        </p>

       <p className="mt-1 text-xs text-slate-500">
  Driver: <span className="text-white">{load.driver_name || "Unassigned"}</span>
</p>

{load.truck_number && (
  <p className="text-xs text-slate-400">
    Truck: <span className="text-white">{load.truck_number}</span>
  </p>
)}

{load.tracking_active && (
  <div className="mt-3 inline-flex rounded-full border border-green-500/30 bg-green-500/10 px-3 py-1 text-[11px] font-semibold text-green-300">
    Tracking Active
  </div>
)}
  
<div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
  <TimePill label="Assigned" value={load.assigned_at} />
  <TimePill label="Arrived" value={load.arrived_pickup_at} />
  <TimePill label="Transit" value={load.in_transit_at} />
  <TimePill label="Delivered" value={load.delivered_at} />
</div>
        <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
  <MoneyBox
    label="Revenue"
    value={load.rate || 0}
    color="text-green-400"
  />

  {(role === "owner" || role === "admin") && (
    <MoneyBox
      label="Driver Pay"
      value={load.driver_pay || 0}
      color="text-yellow-400"
    />
 )}

  <MoneyBox
    label="Fuel"
    value={load.fuel_cost || 0}
    color="text-orange-400"
  />

  {(role === "owner" || role === "admin") && (
    <MoneyBox
      label="Profit"
      value={load.profit || 0}
      color={
        Number(load.profit || 0) >= 0
          ? "text-[#00A3FF]"
          : "text-red-400"
      }
    />
  )}
</div>

        {load.loaded_miles ? (
          <p className="mt-2 text-xs text-slate-500">
            Miles: {load.loaded_miles} loaded
          </p>
        ) : null}

        <div className="mt-2">
  <input
    type="text"
    placeholder="Enter BOL Number"
    value={load.bol_number || ""}
    onChange={(e) =>
      updateBol(load.id, e.target.value)
    }
    className="w-full rounded-lg border border-slate-700 bg-[#0B1522] p-2 text-xs text-white outline-none focus:border-[#00A3FF]"
  />
</div>
      </div>
      {load.updated_at && (
  <p className="mt-3 text-[10px] text-slate-500">
    Updated {formatDistanceToNow(new Date(load.updated_at), { addSuffix: true })}
  </p>
)}
<div className="mt-4 border-t border-slate-800/60 pt-4 opacity-90"></div>
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
function TimePill({
  label,
  value,
}: {
  label: string;
  value?: string;
}) {
  return (
    <div
  className={`rounded-lg border p-2 transition ${
    value
      ? "border-[#16BFFF]/40 bg-[#16BFFF]/10 shadow-[0_0_12px_rgba(22,191,255,0.18)]"
      : "border-slate-800 bg-[#0B1522]"
  }`}
>
      <p className="text-slate-500">{label}</p>

      <p className={value ? "text-[#16BFFF]" : "text-slate-600"}>
        {value ? formatTime(value) : "--"}
      </p>
    </div>
  );
}

function formatTime(value: string) {
  return new Date(value).toLocaleString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
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
function shortLocation(value?: string) {
  if (!value) return "-";

  const stateMatch = value.match(/\b([A-Z]{2})\s+\d{5}\b/);

  if (stateMatch) {
    const state = stateMatch[1];
    const beforeState = value.slice(0, stateMatch.index).trim();
    const words = beforeState.split(/\s+/);
    const city = words[words.length - 1];

    return `${city}, ${state}`;
  }

  const parts = value.split(",").map((part) => part.trim());

  if (parts.length >= 2) {
    const city = parts[parts.length - 2];
    const state = parts[parts.length - 1].split(" ")[0];

    return `${city}, ${state}`;
  }
  return value;
}