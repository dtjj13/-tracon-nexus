"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Load = {
  id: string;
  tracon_id: string;
  broker_load_id?: string;
  bol_number?: string;
  pickup: string;
  dropoff: string;
  driver: string;
  status: string;
  rate_con_url?: string;
  bol_url?: string;
  pod_url?: string;
  driver_lat?: number;
  driver_lng?: number;
  location_updated_at?: string;
};

const timelineSteps = ["Arrived at Pickup", "Loaded", "In Transit", "Delivered"];

export default function TrackingPage() {
  const params = useParams();
  const loadId = params.loadId as string;

  const [load, setLoad] = useState<Load | null>(null);

  useEffect(() => {
    const loadOnce = async () => {
      const { data, error } = await supabase
        .from("loads")
        .select("*")
        .eq("id", loadId)
        .single();

      if (error) {
        console.error(error);
        setLoad(null);
        return;
      }

      setLoad(data);
    };

    loadOnce();

    const channel = supabase
      .channel(`load-${loadId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "loads",
          filter: `id=eq.${loadId}`,
        },
        (payload) => {
          setLoad(payload.new as Load);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
        <h2 className="text-xl font-bold">{load.tracon_id}</h2>

        <div className="grid grid-cols-2 gap-4 mt-4">
          <Info label="Broker Load ID" value={load.broker_load_id || "-"} />
          <Info label="BOL Number" value={load.bol_number || "-"} />
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
                  <div
                    key={step}
                    className="relative z-10 flex flex-col items-center w-1/4"
                  >
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

                    <p
                      className={`mt-3 text-xs text-center ${
                        isComplete || isCurrent
                          ? "text-white"
                          : "text-slate-500"
                      }`}
                    >
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

          {load.driver_lat && load.driver_lng ? (
            <div className="mt-2">
              <p className="text-slate-300">
                Location updated:{" "}
                {load.location_updated_at
                  ? new Date(load.location_updated_at).toLocaleString()
                  : "Just now"}
              </p>

              <p className="text-slate-400 mt-2">
                Lat: {load.driver_lat}, Lng: {load.driver_lng}
              </p>

              <a
                href={`https://www.google.com/maps?q=${load.driver_lat},${load.driver_lng}`}
                target="_blank"
                className="inline-block mt-3 text-green-400 underline"
              >
                Open Location on Map
              </a>
            </div>
          ) : (
            <p className="text-slate-400 mt-2">
              Driver location has not been shared yet.
            </p>
          )}
        </div>

        <DocumentLink
          title="Rate Confirmation"
          fileUrl={load.rate_con_url}
          linkText="View Rate Con"
          emptyText="No Rate Con uploaded yet"
        />

        <DocumentLink
          title="Bill of Lading"
          fileUrl={load.bol_url}
          linkText="View BOL"
          emptyText="No BOL uploaded yet"
        />

        <DocumentLink
          title="Proof of Delivery"
          fileUrl={load.pod_url}
          linkText="View POD"
          emptyText="No POD uploaded yet"
        />
      </div>
    </div>
  );
}

function Info({
  label,
  value,
  blue,
}: {
  label: string;
  value: string;
  blue?: boolean;
}) {
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