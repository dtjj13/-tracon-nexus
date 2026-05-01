"use client";

import { useEffect, useState } from "react";

type Load = {
  id: string;
  pickup: string;
  dropoff: string;
  driver: string;
  status: string;
  bolFileName?: string;
  podFileName?: string;
};

export default function DispatchPage() {
  const [loads, setLoads] = useState<Load[]>([
    {
      id: "TN-001",
      pickup: "Dallas, TX",
      dropoff: "Atlanta, GA",
      driver: "John Doe",
      status: "In Transit",
    },
  ]);

  const [form, setForm] = useState<Load>({
    id: "",
    pickup: "",
    dropoff: "",
    driver: "",
    status: "Pending",
  });

  useEffect(() => {
    const loadSavedData = () => {
      const savedLoads = localStorage.getItem("traconLoads");

      if (savedLoads) {
        setLoads(JSON.parse(savedLoads));
      }
    };

    loadSavedData();

    const interval = setInterval(loadSavedData, 1000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    localStorage.setItem("traconLoads", JSON.stringify(loads));
  }, [loads]);

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
      alert("Fill out all fields");
      return;
    }

    const newLoad: Load = {
      ...form,
      id: `TN-${Math.floor(1000 + Math.random() * 9000)}`,
    };

    setLoads([...loads, newLoad]);

    setForm({
      id: "",
      pickup: "",
      dropoff: "",
      driver: "",
      status: "Pending",
    });
  };

  return (
    <div className="min-h-screen bg-[#050A11] text-white p-6">
      <h1 className="text-3xl font-bold">
        TRACON <span className="text-blue-500 font-light">NEXUS</span>
      </h1>

      <div className="mt-6 grid grid-cols-5 gap-3">
        <input
          name="id"
          placeholder="Auto Generated"
          value={form.id}
          disabled
          className="bg-[#0B1522] p-2 rounded border border-slate-700 text-slate-500"
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

        <input
          name="driver"
          placeholder="Driver"
          value={form.driver}
          onChange={handleChange}
          className="bg-[#0B1522] p-2 rounded border border-slate-700"
        />

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

      <div className="mt-8 rounded-xl border border-slate-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#0B1522] text-slate-400">
            <tr>
              <th className="text-left p-4">Load ID</th>
              <th className="text-left p-4">Pickup</th>
              <th className="text-left p-4">Dropoff</th>
              <th className="text-left p-4">Driver</th>
              <th className="text-left p-4">Status</th>
              <th className="text-left p-4">BOL</th>
              <th className="text-left p-4">POD</th>
              <th className="text-left p-4">Actions</th>
            </tr>
          </thead>

          <tbody>
            {loads.map((load, index) => (
              <tr key={load.id} className="border-t border-slate-800">
                <td className="p-4 font-semibold">{load.id}</td>
                <td className="p-4">{load.pickup}</td>
                <td className="p-4">{load.dropoff}</td>
                <td className="p-4">{load.driver}</td>

                <td className="p-4">
                  <select
                    value={load.status}
                    onChange={(e) => {
                      const updated = [...loads];
                      updated[index].status = e.target.value;
                      setLoads(updated);
                    }}
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
                  {load.bolFileName ? (
                    <span className="text-green-400">{load.bolFileName}</span>
                  ) : (
                    <span className="text-slate-500">No BOL</span>
                  )}
                </td>

                <td className="p-4">
                  {load.podFileName ? (
                    <span className="text-green-400">{load.podFileName}</span>
                  ) : (
                    <span className="text-slate-500">No POD</span>
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
                      setLoads(updated);
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
