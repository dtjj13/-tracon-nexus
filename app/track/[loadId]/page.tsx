"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

type Load = {
  id: string;
  pickup: string;
  dropoff: string;
  driver: string;
  status: string;
  podFileName?: string;
  bolFileName?: string;
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

        <div className="mt-8 rounded-xl border border-red-900 bg-red-950/30 p-6">
          <p className="text-red-400 font-semibold">Load Not Found</p>
          <p className="text-slate-300 mt-2">
            This tracking link does not match an active load in the system.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050A11] text-white p-6">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold">
          TRACON <span className="text-blue-500 font-light">NEXUS</span>
        </h1>

        <p className="text-slate-400 mt-2">Broker Tracking View</p>

        <div className="mt-8 rounded-xl border border-slate-800 bg-[#07101A] p-6">
          <p className="text-slate-400 text-sm">Tracking Load</p>
          <h2 className="text-4xl font-bold mt-2">{load.id}</h2>

          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-slate-800 p-4">
              <p className="text-slate-400 text-sm">Status</p>
              <p className="text-blue-500 font-semibold mt-1">{load.status}</p>
            </div>

            <div className="rounded-lg border border-slate-800 p-4">
              <p className="text-slate-400 text-sm">Driver</p>
              <p className="font-semibold mt-1">{load.driver}</p>
            </div>

            <div className="rounded-lg border border-slate-800 p-4">
              <p className="text-slate-400 text-sm">Pickup</p>
              <p className="font-semibold mt-1">{load.pickup}</p>
            </div>

            <div className="rounded-lg border border-slate-800 p-4">
              <p className="text-slate-400 text-sm">Dropoff</p>
              <p className="font-semibold mt-1">{load.dropoff}</p>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-blue-900 bg-blue-950/30 p-6">
            <p className="text-blue-400 font-semibold">Live Tracking</p>
            <p className="text-slate-300 mt-2">
              GPS map and real-time driver location will appear here.
            </p>
            <div className="mt-4">
  <p className="font-semibold">Bill of Lading</p>

  {load.bolFileName ? (
    <p className="text-green-400 mt-2">{load.bolFileName}</p>
  ) : (
    <p className="text-slate-500 mt-2">No BOL uploaded yet</p>
  )}
</div>
            <div className="mt-4">
  <p className="font-semibold">Proof of Delivery</p>

  {load.podFileName ? (
    <p className="text-green-400 mt-2">
      {load.podFileName}
    </p>
  ) : (
    <p className="text-slate-500 mt-2">
      No POD uploaded yet
    </p>
  )}
</div>
          </div>
        </div>
      </div>
    </div>
  );
}