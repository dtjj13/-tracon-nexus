"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

type Load = {
  id: string;
  pickup: string;
  dropoff: string;
  driver: string;
  status: string;
  bolFileName?: string;
  podFileName?: string;
};

export default function DriverPage() {
  const [loads, setLoads] = useState<Load[]>([]);

  useEffect(() => {
    const savedLoads = localStorage.getItem("traconLoads");

    if (savedLoads) {
      setLoads(JSON.parse(savedLoads));
    }
  }, []);

  const saveLoads = (updatedLoads: Load[]) => {
    setLoads(updatedLoads);
    localStorage.setItem("traconLoads", JSON.stringify(updatedLoads));
  };

  const updateStatus = (index: number, status: string) => {
    const updated = [...loads];
    updated[index].status = status;
    saveLoads(updated);
  };

  const uploadFile = async (
    index: number,
    file: File | null,
    documentType: "BOL" | "POD"
  ) => {
    if (!file) return;

    alert(`Uploading ${documentType}: ${file.name}`);

    const fileName = `${documentType.toLowerCase()}-${Date.now()}-${file.name}`;

    const { error } = await supabase.storage
      .from("documents")
      .upload(fileName, file);

    if (error) {
      alert(`Upload failed: ${error.message}`);
      console.error(error);
      return;
    }

    const { data } = supabase.storage
      .from("documents")
      .getPublicUrl(fileName);

    const updated = [...loads];

    if (documentType === "BOL") {
      updated[index].bolFileName = data.publicUrl;
    }

    if (documentType === "POD") {
      updated[index].podFileName = data.publicUrl;
    }

    saveLoads(updated);

    alert(`${documentType} upload complete`);
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
                    uploadFile(index, e.target.files?.[0] || null, "BOL")
                  }
                  className="hidden"
                />
              </label>

              {load.bolFileName && (
                <p className="mt-3">
                  <a
                    href={load.bolFileName}
                    target="_blank"
                    className="text-green-400 underline"
                  >
                    View BOL
                  </a>
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
                    uploadFile(index, e.target.files?.[0] || null, "POD")
                  }
                  className="hidden"
                />
              </label>

              {load.podFileName && (
                <p className="mt-3">
                  <a
                    href={load.podFileName}
                    target="_blank"
                    className="text-green-400 underline"
                  >
                    View POD
                  </a>
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}