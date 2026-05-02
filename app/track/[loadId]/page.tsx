"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

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

const timelineSteps = ["Arrived at Pickup", "Loaded", "In Transit", "Delivered"];

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

  const currentIndex = timelineSteps.indexOf(load.status);

  return (
    <div className="min-h-screen bg-[#050A11] text-white p-6">
      <h1 className="text-3xl font-bold">
        TRACON <span className="text-blue-500 font-light">NEXUS</span>
      </h1>

      <p className="text-slate-400 mt-2">Broker Tracking View</p>

      <div className="mt-6 rounded-xl border border-blue-900 bg-blue-950/30 p-6">
        <h2 className="text-xl font-bold">{load.id}</h2>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <Info label="Broker Load ID" value={load.brokerLoadId || "-"} />
          <Info label="BOL Number" value={load.bolNumber || "-"} />
          <Info label="Current Status" value={load.status} blue />
          <Info label="Driver" value={load.driver} />
          <Info label="Pickup" value={load.pickup} />
          <Info label="Dropoff" value={load.dropoff} />
        </div>

        <div className="mt-6 rounded-lg border border-slate-800 bg-[#07101A] p-4">
          <p className="font-semibold text-blue-400">Status Timeline</p>

          <div className="mt-6">
            <div className="relative flex items-center justify-between">
              <div className="absolute left-0 right-0 top-4 h-1 bg-slate-800 rounded" />

              <div
                className="absolute left-0 top-4 h-1 bg-blue-500 rounded transition-all duration-500"
                style={{
                  width:
                    currentIndex <= 0
                      ? "0%"
                      : `${(currentIndex / (timelineSteps.length - 1)) * 100}%`,
                }}
              />

              {timelineSteps.map((step, index) => {
                const isComplete = index < currentIndex;
                const isCurrent = index === currentIndex;

                return (
                  <div key={step} className="relative z-10 flex flex-col items-center w-1/4">
                    <div
                      className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold border ${
                        isComplete
                          ? "bg-green-500 border-green-500 text-white"
                          : isCurrent
                          ? "bg-blue-500 border-blue-500 text-white"
                          : "bg-[#050A11] border-slate-600 text-slate-500"
                      }`}
                    >
                      {isComplete ? "✓" : index + 1}
                    </div>

                    <p className={`mt-3 text-xs text-center ${isComplete || isCurrent ? "text-white" : "text-slate-500"}`}>
                      {step}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-lg border border-blue-900 bg-blue-950/30 p-4">
          <p className="font-semibold text-blue-400">Live Tracking</p>
          <p className="text-slate-400 mt-2">
            GPS map and real-time driver location will appear here.
          </p>
        </div>

        <DocumentLink title="Rate Confirmation" fileUrl={load.rateConFileName} linkText="View Rate Con" emptyText="No Rate Con uploaded yet" />
        <DocumentLink title="Bill of Lading" fileUrl={load.bolFileName} linkText="View BOL" emptyText="No BOL uploaded yet" />
        <DocumentLink title="Proof of Delivery" fileUrl={load.podFileName} linkText="View POD" emptyText="No POD uploaded yet" />
      </div>
    </div>
  );
}

function Info({ label, value, blue }: { label: string; value: string; blue?: boolean }) {
  return (
    <div>
      <p className="text-slate-400">{label}</p>
      <p className={`font-semibold ${blue ? "text-blue-400" : ""}`}>{value}</p>
    </div>
  );
}

function DocumentLink({
  title,
  fileUrl,
  linkText,
  emptyText,
}: {
  title: string;
  fileUrl?: string;
  linkText: string;
  emptyText: string;
}) {
  return (
    <div className="mt-4">
      <p className="font-semibold">{title}</p>
      {fileUrl ? (
        <a href={fileUrl} target="_blank" className="text-green-400 underline">
          {linkText}
        </a>
      ) : (
        <p className="text-slate-500 mt-2">{emptyText}</p>
      )}
    </div>
  );
}
