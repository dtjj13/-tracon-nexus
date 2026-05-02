"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Load = {
  id: string;
  pickup: string;
  dropoff: string;
  driver: string;
  status: string;
  bolFileName?: string;
  podFileName?: string;
};

export default function TrackingPage() {
  const params = useParams();
  const loadId = params.loadId as string;

  const [load, setLoad] = useState<Load | null>(null);

  useEffect(() => {
    const savedLoads = localStorage.getItem("traconLoads");

    if (savedLoads) {
      const loads: Load[] = JSON.parse(savedLoads);
      const foundLoad = loads.find((item) => item.id === loadId);
      setLoad(foundLoad || null);
    }
  }, [loadId]);

  if (!load) {
    return (
      <div className="min-h-screen bg-[#050A11] text-white p-6">
        <h1 className="text-3xl font-bold">
          TRACON <span className="text-blue-500 font-light">NEXUS</span>
        </h1>
        <p className="mt-6 text-slate-400">Load not found.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050A11] text-white p-6">
      <h1 className="text-3xl font-bold">
        TRACON <span className="text-blue-500 font-light">NEXUS</span>
      </h1>

      <p className="text-slate-400 mt-2">Broker Tracking View</p>

      <div className="mt-6 rounded-xl border border-blue-900 bg-blue-950/30 p-6">
        <h2 className="text-xl font-bold">{load.id}</h2>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <p className="text-slate-400">Status</p>
            <p className="font-semibold">{load.status}</p>
          </div>

          <div>
            <p className="text-slate-400">Driver</p>
            <p className="font-semibold">{load.driver}</p>
          </div>

          <div>
            <p className="text-slate-400">Pickup</p>
            <p className="font-semibold">{load.pickup}</p>
          </div>

          <div>
            <p className="text-slate-400">Dropoff</p>
            <p className="font-semibold">{load.dropoff}</p>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-blue-900 bg-blue-950/30 p-4">
          <p className="font-semibold text-blue-400">Live Tracking</p>
          <p className="text-slate-400 mt-2">
            GPS map and real-time driver location will appear here.
          </p>
        </div>

        <div className="mt-4">
          <p className="font-semibold">Bill of Lading</p>
          {load.bolFileName ? (
            <a href={load.bolFileName} target="_blank" className="text-green-400 underline">
              View BOL
            </a>
          ) : (
            <p className="text-slate-500 mt-2">No BOL uploaded yet</p>
          )}
        </div>

        <div className="mt-4">
          <p className="font-semibold">Proof of Delivery</p>
          {load.podFileName ? (
            <a href={load.podFileName} target="_blank" className="text-green-400 underline">
              View POD
            </a>
          ) : (
            <p className="text-slate-500 mt-2">No POD uploaded yet</p>
          )}
        </div>
      </div>
    </div>
  );
}