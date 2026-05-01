"use client";

import { useEffect, useState } from "react";

type Load = {
  id: string;
  pickup: string;
  dropoff: string;
  driver: string;
  status: string;
  podFileName?: string;
  bolFileName?: string;
};

export default function DriverPage() {
  const [loads, setLoads] = useState<Load[]>([]);

  useEffect(() => {
    const savedLoads = localStorage.getItem("traconLoads");

    if (savedLoads) {
      setLoads(JSON.parse(savedLoads));
    }
  }, []);

  const updateStatus = (index: number, status: string) => {
    const updated = [...loads];
    updated[index].status = status;

    setLoads(updated);
    localStorage.setItem("traconLoads", JSON.stringify(updated));
  };

  const uploadBOLFile = (index: number, file: File | null) => {
    if (!file) return;

    const updated = [...loads];
    updated[index].bolFileName = file.name;

    setLoads(updated);
    localStorage.setItem("traconLoads", JSON.stringify(updated));
  };

  const uploadPODFile = (index: number, file: File | null) => {
    if (!file) return;

    const updated = [...loads];
    updated[index].podFileName = file.name;

    setLoads(updated);
    localStorage.setItem("traconLoads", JSON.stringify(updated));
  };

  return (
    <div className="min-h-screen bg-[#050A11] text-white p-6">
      <h1 className="text-3xl font-bold">
        TRACON <span className="text-blue-500 font-light">NEXUS</span>
      </h1>

      <p className="text-slate-400 mt-2">Driver View</p>

      <div className="mt-8 space-y-4">
        {loads.map((load, index) => (
          <div
            key={load.id}
            className="rounded-xl border border-slate-800 bg-[#07101A] p-5"
          >
            <p className="text-slate-400 text-sm">Load ID</p>
            <h2 className="text-2xl font-bold">{load.id}</h2>

            <div className="mt-4">
              <p>Driver: {load.driver}</p>
              <p>Pickup: {load.pickup}</p>
              <p>Dropoff: {load.dropoff}</p>
              <p className="mt-2">
                Current Status:{" "}
                <span className="text-blue-500 font-semibold">
                  {load.status}
                </span>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-5">
              <button
                onClick={() => updateStatus(index, "Arrived at Pickup")}
                className="bg-slate-800 p-3 rounded hover:bg-slate-700"
              >
                Arrived at Pickup
              </button>

              <button
                onClick={() => updateStatus(index, "Loaded")}
                className="bg-blue-600 p-3 rounded hover:bg-blue-500"
              >
                Loaded
              </button>

              <button
                onClick={() => updateStatus(index, "In Transit")}
                className="bg-blue-600 p-3 rounded hover:bg-blue-500"
              >
                In Transit
              </button>

              <button
                onClick={() => updateStatus(index, "Delivered")}
                className="bg-green-600 p-3 rounded hover:bg-green-500"
              >
                Delivered
              </button>
            </div>

            <div className="mt-5 rounded-lg border border-slate-800 p-4">
              <p className="font-semibold">Bill of Lading</p>

              <label className="mt-3 inline-block bg-blue-600 px-4 py-2 rounded cursor-pointer hover:bg-blue-500">
                Upload BOL
                <input
                  type="file"
                  onChange={(e) =>
                    uploadBOLFile(index, e.target.files?.[0] || null)
                  }
                  className="hidden"
                />
              </label>

              {load.bolFileName && (
                <p className="mt-3 text-green-400">
                  BOL uploaded: {load.bolFileName}
                </p>
              )}
            </div>

            <div className="mt-5 rounded-lg border border-slate-800 p-4">
              <p className="font-semibold">Proof of Delivery</p>

              <label className="mt-3 inline-block bg-blue-600 px-4 py-2 rounded cursor-pointer hover:bg-blue-500">
                Upload POD
                <input
                  type="file"
                  onChange={(e) =>
                    uploadPODFile(index, e.target.files?.[0] || null)
                  }
                  className="hidden"
                />
              </label>

              {load.podFileName && (
                <p className="mt-3 text-green-400">
                  POD uploaded: {load.podFileName}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}