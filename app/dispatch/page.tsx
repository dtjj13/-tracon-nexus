"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Load = {
  id: string;
  brokerLoadId?: string;
  bolNumber?: string;
  pickup: string;
  dropoff: string;
  driver: string;
  status: string;
  rateConFileName?: string;
  bolFileName?: string;
  podFileName?: string;
};

export default function DispatchPage() {
  const [loads, setLoads] = useState<Load[]>([]);
  const [form, setForm] = useState<Load>({
    id: "",
    brokerLoadId: "",
    bolNumber: "",
    pickup: "",
    dropoff: "",
    driver: "",
    status: "Pending",
  });

  useEffect(() => {
    const loadSavedData = () => {
      const savedLoads = localStorage.getItem("traconLoads");
      if (savedLoads) setLoads(JSON.parse(savedLoads));
    };

    loadSavedData();
    const interval = setInterval(loadSavedData, 1000);
    return () => clearInterval(interval);
  }, []);

  const saveLoads = (updatedLoads: Load[]) => {
    setLoads(updatedLoads);
    localStorage.setItem("traconLoads", JSON.stringify(updatedLoads));
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const statusStyle = (status: string) => {
    if (status === "Arrived at Pickup") return "bg-slate-500 text-white";
    if (status === "Loaded") return "bg-blue-500 text-white";
    if (status === "In Transit") return "bg-blue-600 text-white";
    if (status === "Delivered") return "bg-green-600 text-white";
    if (status === "Issue") return "bg-red-600 text-white";
    return "bg-orange-500 text-white";
  };

  const addLoad = () => {
    if (!form.pickup || !form.dropoff || !form.driver) {
      alert("Fill out pickup, dropoff, and driver");
      return;
    }

    const newLoad: Load = {
      ...form,
      id: `TN-${Math.floor(1000 + Math.random() * 9000)}`,
    };

    saveLoads([...loads, newLoad]);

    setForm({
      id: "",
      brokerLoadId: "",
      bolNumber: "",
      pickup: "",
      dropoff: "",
      driver: "",
      status: "Pending",
    });
  };

  const uploadFile = async (
    index: number,
    file: File | null,
    documentType: "RATECON" | "BOL" | "POD"
  ) => {
    if (!file) return;

    const fileName = `${documentType.toLowerCase()}-${Date.now()}-${file.name}`;

    const { error } = await supabase.storage
      .from("documents")
      .upload(fileName, file);

    if (error) {
      alert(`Upload failed: ${error.message}`);
      return;
    }

    const { data } = supabase.storage.from("documents").getPublicUrl(fileName);

    const updated = [...loads];

    if (documentType === "RATECON") updated[index].rateConFileName = data.publicUrl;
    if (documentType === "BOL") updated[index].bolFileName = data.publicUrl;
    if (documentType === "POD") updated[index].podFileName = data.publicUrl;

    saveLoads(updated);
    alert(`${documentType} upload complete`);
  };

  return (
    <div className="min-h-screen bg-[#050A11] text-white p-6">
      <h1 className="text-3xl font-bold">
        TRACON <span className="text-blue-500 font-light">NEXUS</span>
      </h1>

      <div className="mt-6 grid grid-cols-7 gap-3">
        <input name="id" placeholder="Auto Generated" value={form.id} disabled className="bg-[#0B1522] p-2 rounded border border-slate-700 text-slate-500" />
        <input name="brokerLoadId" placeholder="Broker Load ID" value={form.brokerLoadId || ""} onChange={handleChange} className="bg-[#0B1522] p-2 rounded border border-slate-700" />
        <input name="bolNumber" placeholder="BOL Number" value={form.bolNumber || ""} onChange={handleChange} className="bg-[#0B1522] p-2 rounded border border-slate-700" />
        <input name="pickup" placeholder="Pickup" value={form.pickup} onChange={handleChange} className="bg-[#0B1522] p-2 rounded border border-slate-700" />
        <input name="dropoff" placeholder="Dropoff" value={form.dropoff} onChange={handleChange} className="bg-[#0B1522] p-2 rounded border border-slate-700" />
        <input name="driver" placeholder="Driver" value={form.driver} onChange={handleChange} className="bg-[#0B1522] p-2 rounded border border-slate-700" />

        <select name="status" value={form.status} onChange={handleChange} className="bg-[#0B1522] p-2 rounded border border-slate-700">
          <option>Pending</option>
          <option>Arrived at Pickup</option>
          <option>Loaded</option>
          <option>In Transit</option>
          <option>Delivered</option>
          <option>Issue</option>
        </select>
      </div>

      <button onClick={addLoad} className="mt-4 bg-blue-600 px-4 py-2 rounded hover:bg-blue-500">
        + Create Load
      </button>

      <div className="mt-8 rounded-xl border border-slate-800 overflow-auto">
        <table className="w-full min-w-[1350px] text-sm">
          <thead className="bg-[#0B1522] text-slate-400">
            <tr>
              <th className="text-left p-4">TRACON ID</th>
              <th className="text-left p-4">Broker ID</th>
              <th className="text-left p-4">BOL #</th>
              <th className="text-left p-4">Pickup</th>
              <th className="text-left p-4">Dropoff</th>
              <th className="text-left p-4">Driver</th>
              <th className="text-left p-4">Status</th>
              <th className="text-left p-4">Rate Con</th>
              <th className="text-left p-4">BOL</th>
              <th className="text-left p-4">POD</th>
              <th className="text-left p-4">Actions</th>
            </tr>
          </thead>

          <tbody>
            {loads.map((load, index) => (
              <tr key={load.id} className="border-t border-slate-800">
                <td className="p-4 font-semibold">{load.id}</td>
                <td className="p-4">{load.brokerLoadId || "-"}</td>
                <td className="p-4">{load.bolNumber || "-"}</td>
                <td className="p-4">{load.pickup}</td>
                <td className="p-4">{load.dropoff}</td>
                <td className="p-4">{load.driver}</td>

                <td className="p-4">
                  <select
                    value={load.status}
                    onChange={(e) => {
                      const updated = [...loads];
                      updated[index].status = e.target.value;
                      saveLoads(updated);
                    }}
                    className={`rounded-md px-2 py-1 text-xs font-semibold ${statusStyle(load.status)}`}
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
                  {load.rateConFileName ? (
                    <a href={load.rateConFileName} target="_blank" className="text-green-400 underline">View Rate Con</a>
                  ) : (
                    <label className="text-blue-500 underline cursor-pointer">
                      Upload Rate Con
                      <input type="file" className="hidden" onChange={(e) => uploadFile(index, e.target.files?.[0] || null, "RATECON")} />
                    </label>
                  )}
                </td>

                <td className="p-4">
                  {load.bolFileName ? (
                    <a href={load.bolFileName} target="_blank" className="text-green-400 underline">View BOL</a>
                  ) : (
                    <label className="text-blue-500 underline cursor-pointer">
                      Upload BOL
                      <input type="file" className="hidden" onChange={(e) => uploadFile(index, e.target.files?.[0] || null, "BOL")} />
                    </label>
                  )}
                </td>

                <td className="p-4">
                  {load.podFileName ? (
                    <a href={load.podFileName} target="_blank" className="text-green-400 underline">View POD</a>
                  ) : (
                    <label className="text-blue-500 underline cursor-pointer">
                      Upload POD
                      <input type="file" className="hidden" onChange={(e) => uploadFile(index, e.target.files?.[0] || null, "POD")} />
                    </label>
                  )}
                </td>

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
                    onClick={() => {
                      const updated = loads.filter((_, i) => i !== index);
                      saveLoads(updated);
                    }}
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
