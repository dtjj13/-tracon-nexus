"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

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

type LoadForm = {
  broker_load_id: string;
  bol_number: string;
  pickup: string;
  dropoff: string;
  driver_id: string;
  status: string;
};

export default function DispatchPage() {
  const [loads, setLoads] = useState<Load[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);

  const [form, setForm] = useState<LoadForm>({
    broker_load_id: "",
    bol_number: "",
    pickup: "",
    dropoff: "",
    driver_id: "",
    status: "Pending",
  });

  const fetchDrivers = async () => {
    const { data, error } = await supabase
      .from("drivers")
      .select("*")
      .eq("active", true)
      .order("name", { ascending: true });

    if (error) {
      alert(error.message);
      return;
    }

    setDrivers(data || []);
  };

  const fetchLoads = async () => {
    const { data, error } = await supabase
      .from("loads")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      alert(error.message);
      return;
    }

    setLoads(data || []);
  };

  useEffect(() => {
    fetchDrivers();
    fetchLoads();
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const addLoad = async () => {
    if (!form.pickup || !form.dropoff || !form.driver_id) {
      alert("Fill out pickup, dropoff, and select a driver");
      return;
    }

    const selectedDriver = drivers.find((d) => d.id === form.driver_id);

    if (!selectedDriver) {
      alert("Driver not found");
      return;
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
      },
    ]);

    if (error) {
      alert(error.message);
      return;
    }

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

    if (error) {
      alert(error.message);
      return;
    }

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
      })
      .eq("id", loadId);

    if (error) {
      alert(error.message);
      return;
    }

    fetchLoads();
  };

  const uploadFile = async (
    loadId: string,
    file: File | null,
    documentType: "RATECON" | "BOL" | "POD"
  ) => {
    if (!file) return;

    const fileName = `${documentType.toLowerCase()}-${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(fileName, file);

    if (uploadError) {
      alert(uploadError.message);
      return;
    }

    const { data } = supabase.storage.from("documents").getPublicUrl(fileName);

    const updateData =
      documentType === "RATECON"
        ? { rate_con_url: data.publicUrl }
        : documentType === "BOL"
        ? { bol_url: data.publicUrl }
        : { pod_url: data.publicUrl };

    const { error: updateError } = await supabase
      .from("loads")
      .update(updateData)
      .eq("id", loadId);

    if (updateError) {
      alert(updateError.message);
      return;
    }

    fetchLoads();
    alert(`${documentType} upload complete`);
  };

  const deleteLoad = async (loadId: string) => {
    const { error } = await supabase.from("loads").delete().eq("id", loadId);

    if (error) {
      alert(error.message);
      return;
    }

    fetchLoads();
  };

  const statusStyle = (status: string) => {
    if (status === "Arrived at Pickup") return "bg-slate-500 text-white";
    if (status === "Loaded") return "bg-blue-500 text-white";
    if (status === "In Transit") return "bg-blue-600 text-white";
    if (status === "Delivered") return "bg-green-600 text-white";
    if (status === "Issue") return "bg-red-600 text-white";
    return "bg-orange-500 text-white";
  };

  return (
    <div className="min-h-screen bg-[#050A11] text-white p-6">
      <h1 className="text-3xl font-bold">
        TRACON <span className="text-blue-500 font-light">NEXUS</span>
      </h1>

      <div className="mt-6 grid grid-cols-7 gap-3">
        <input
          placeholder="Auto Generated"
          disabled
          className="bg-[#0B1522] p-2 rounded border border-slate-700 text-slate-500"
        />

        <input
          name="broker_load_id"
          placeholder="Broker Load ID"
          value={form.broker_load_id}
          onChange={handleChange}
          className="bg-[#0B1522] p-2 rounded border border-slate-700"
        />

        <input
          name="bol_number"
          placeholder="BOL Number"
          value={form.bol_number}
          onChange={handleChange}
          className="bg-[#0B1522] p-2 rounded border border-slate-700"
        />

        <input
          name="pickup"
          placeholder="Pickup"
          value={form.pickup}
          onChange={handleChange}
          className="bg-[#0B1522] p-2 rounded border border-slate-700"
        />

        <input
          name="dropoff"
          placeholder="Dropoff"
          value={form.dropoff}
          onChange={handleChange}
          className="bg-[#0B1522] p-2 rounded border border-slate-700"
        />

        <select
          name="driver_id"
          value={form.driver_id}
          onChange={handleChange}
          className="bg-[#0B1522] p-2 rounded border border-slate-700"
        >
          <option value="">Select Driver</option>
          {drivers.map((driver) => (
            <option key={driver.id} value={driver.id}>
              {driver.name} - {driver.email}
            </option>
          ))}
        </select>

        <select
          name="status"
          value={form.status}
          onChange={handleChange}
          className="bg-[#0B1522] p-2 rounded border border-slate-700"
        >
          <option>Pending</option>
          <option>Arrived at Pickup</option>
          <option>Loaded</option>
          <option>In Transit</option>
          <option>Delivered</option>
          <option>Issue</option>
        </select>
      </div>

      <button
        onClick={addLoad}
        className="mt-4 bg-blue-600 px-4 py-2 rounded hover:bg-blue-500"
      >
        + Create Load
      </button>

      <div className="mt-8 rounded-xl border border-slate-800 overflow-auto">
        <table className="w-full min-w-[1500px] text-sm">
          <thead className="bg-[#0B1522] text-slate-400">
            <tr>
              <th className="text-left p-4">TRACON ID</th>
              <th className="text-left p-4">Broker ID</th>
              <th className="text-left p-4">BOL #</th>
              <th className="text-left p-4">Pickup</th>
              <th className="text-left p-4">Dropoff</th>
              <th className="text-left p-4">Driver</th>
              <th className="text-left p-4">Reassign</th>
              <th className="text-left p-4">Status</th>
              <th className="text-left p-4">Location</th>
              <th className="text-left p-4">Rate Con</th>
              <th className="text-left p-4">BOL</th>
              <th className="text-left p-4">POD</th>
              <th className="text-left p-4">Actions</th>
            </tr>
          </thead>

          <tbody>
            {loads.map((load) => (
              <tr key={load.id} className="border-t border-slate-800">
                <td className="p-4 font-semibold">{load.tracon_id}</td>
                <td className="p-4">{load.broker_load_id || "-"}</td>
                <td className="p-4">{load.bol_number || "-"}</td>
                <td className="p-4">{load.pickup}</td>
                <td className="p-4">{load.dropoff}</td>

                <td className="p-4">
                  <div>{load.driver_name || "No Driver"}</div>
                  <div className="text-xs text-slate-500">
                    {load.driver_email || load.driver || "-"}
                  </div>
                </td>

                <td className="p-4">
                  <select
                    value=""
                    onChange={(e) => changeDriver(load.id, e.target.value)}
                    className="bg-[#0B1522] p-2 rounded border border-slate-700"
                  >
                    <option value="">Change Driver</option>
                    {drivers.map((driver) => (
                      <option key={driver.id} value={driver.id}>
                        {driver.name}
                      </option>
                    ))}
                  </select>
                </td>

                <td className="p-4">
                  <select
                    value={load.status}
                    onChange={(e) => updateStatus(load.id, e.target.value)}
                    className={`rounded-md px-2 py-1 text-xs font-semibold ${statusStyle(
                      load.status
                    )}`}
                  >
                    <option>Pending</option>
                    <option>Arrived at Pickup</option>
                    <option>Loaded</option>
                    <option>In Transit</option>
                    <option>Delivered</option>
                    <option>Issue</option>
                  </select>
                </td>

                <td className="p-4">
                  {load.driver_lat && load.driver_lng ? (
                    <a
                      href={`https://www.google.com/maps?q=${load.driver_lat},${load.driver_lng}`}
                      target="_blank"
                      className="text-green-400 underline"
                    >
                      View Map
                    </a>
                  ) : (
                    <span className="text-slate-500">No Location</span>
                  )}
                </td>

                <DocCell
                  label="Rate Con"
                  url={load.rate_con_url}
                  onUpload={(file) => uploadFile(load.id, file, "RATECON")}
                />

                <DocCell
                  label="BOL"
                  url={load.bol_url}
                  onUpload={(file) => uploadFile(load.id, file, "BOL")}
                />

                <DocCell
                  label="POD"
                  url={load.pod_url}
                  onUpload={(file) => uploadFile(load.id, file, "POD")}
                />

                <td className="p-4 space-x-3">
                  <button
                    onClick={() => {
                      const trackingLink = `${window.location.origin}/track/${load.id}`;
                      navigator.clipboard.writeText(trackingLink);
                      alert(`Tracking link copied:\n${trackingLink}`);
                    }}
                    className="text-blue-500 hover:text-blue-400"
                  >
                    Send Link
                  </button>

                  <button
                    onClick={() => deleteLoad(load.id)}
                    className="text-red-500 hover:text-red-400"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DocCell({
  label,
  url,
  onUpload,
}: {
  label: string;
  url?: string;
  onUpload: (file: File | null) => void;
}) {
  return (
    <td className="p-4">
      {url ? (
        <a href={url} target="_blank" className="text-green-400 underline">
          View {label}
        </a>
      ) : (
        <label className="text-blue-500 underline cursor-pointer">
          Upload {label}
          <input
            type="file"
            className="hidden"
            onChange={(e) => onUpload(e.target.files?.[0] || null)}
          />
        </label>
      )}
    </td>
  );
}
