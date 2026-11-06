"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Load = {
  id: string;
  tracon_id: string;
  broker_load_id?: string;
  pickup: string;
  dropoff: string;
  status: string;
  driver_lat?: number;
  driver_lng?: number;
  tracking_active?: boolean;
tracking_started_at?: string;
  created_at?: string;
  updated_at?: string;
  assigned_at?: string;
  arrived_pickup_at?: string;
  in_transit_at?: string;
  delivered_at?: string;
  pod_uploaded_at?: string;
};

const statuses = [
  {
    label: "Pending",
    key: "created_at",
  },
  {
    label: "Assigned",
    key: "assigned_at",
  },
  {
    label: "Arrived at Pickup",
    key: "arrived_pickup_at",
  },
  {
    label: "In Transit",
    key: "in_transit_at",
  },
  {
    label: "Delivered",
    key: "delivered_at",
  },
];

export default function TrackingPage() {
  const params = useParams();
  const loadId = params.loadId as string;

  const [load, setLoad] = useState<Load | null>(null);
  const [loadError, setLoadError] = useState("");
const [currentTime, setCurrentTime] = useState(
  () => Date.now()
);

useEffect(() => {
  const timer = window.setInterval(() => {
    setCurrentTime(Date.now());
  }, 30_000);

  return () => {
    window.clearInterval(timer);
  };
}, []);

  const fetchLoad = useCallback(async () => {
    const { data, error } = await supabase
      .from("loads")
      .select(
        "id,tracon_id,broker_load_id,pickup,dropoff,status,driver_lat,driver_lng,tracking_active,tracking_started_at,created_at,updated_at,assigned_at,arrived_pickup_at,in_transit_at,delivered_at,pod_uploaded_at"
      )
      .eq("id", loadId)
      .single();

    if (error || !data) {
      setLoadError("This tracking link is invalid or no longer available.");
      return;
    }

    setLoadError("");
    setLoad(data);
  }, [loadId]);

  useEffect(() => {
    // Load the public tracking snapshot when the route becomes available.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchLoad();

    const channel = supabase
      .channel(`tracking-${loadId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "loads",
          filter: `id=eq.${loadId}`,
        },
        () => void fetchLoad()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchLoad, loadId]);

  if (loadError) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020617] p-6 text-center text-white">
        <div className="max-w-md rounded-2xl border border-slate-800 bg-[#07101A] p-8">
          <h1 className="text-xl font-semibold">Tracking unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-slate-400">{loadError}</p>
        </div>
      </div>
    );
  }

  if (!load) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020617] text-white">
        Loading shipment...
      </div>
    );
  }

  const currentStep = statuses.findIndex(
    (step) => step.label.toLowerCase() === load.status?.toLowerCase()
  );

  const hasLocation =
  load.driver_lat != null &&
  load.driver_lng != null;

const lastLocationTime = load.updated_at
  ? new Date(load.updated_at).getTime()
  : 0;

const locationIsFresh =
  lastLocationTime > 0 &&
  currentTime - lastLocationTime <= 120_000;

const isTrackingActive =
  hasLocation &&
  load.tracking_active === true &&
  locationIsFresh;

const hasSignalLoss =
  hasLocation &&
  load.tracking_active === true &&
  !locationIsFresh;

const trackingLabel = isTrackingActive
  ? "Live Tracking Active"
  : hasSignalLoss
    ? "Signal Lost"
    : hasLocation
      ? "Tracking Stopped"
      : "Awaiting Location";

  return (
    <div className="min-h-screen bg-[#020617] p-4 text-white sm:p-6">
      <div className="mx-auto max-w-6xl space-y-6">
        {/* HEADER */}
        <div className="rounded-3xl border border-slate-800 bg-gradient-to-r from-[#07101A] to-[#050A11] p-6 shadow-[0_0_40px_rgba(0,0,0,0.45)]">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[#16BFFF]">
                Live Shipment Tracking
              </p>

              <h1 className="mt-2 text-2xl font-bold text-white">
                {load.broker_load_id || load.tracon_id}
              </h1>

              
            </div>

            <div className="rounded-2xl border border-slate-700 bg-[#0B1522] px-5 py-4">
              <p className="text-xs uppercase tracking-widest text-slate-500">
                Current Status
              </p>

              <p className={`mt-2 text-lg font-bold ${statusColor(load.status)}`}>
                {load.status}
              </p>
            </div>
          </div>
        </div>

        {/* LIVE TRACKING MAP */}
        <div className="rounded-3xl border border-slate-800 bg-[#07101A] p-5 shadow-[0_0_30px_rgba(0,0,0,0.45)]">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-[#16BFFF]">
                Live Tracking
              </p>
              <h2 className="mt-2 text-lg font-semibold text-white">
                Driver Location
              </h2>
              
            </div>

           <div
  className={`rounded-xl border px-4 py-2 text-sm ${
    isTrackingActive
      ? "border-green-500/30 bg-green-500/10 text-green-300"
      : hasSignalLoss
        ? "border-red-500/40 bg-red-500/10 text-red-300"
        : hasLocation
          ? "border-slate-600 bg-slate-500/10 text-slate-300"
          : "border-yellow-500/30 bg-yellow-500/10 text-yellow-300"
  }`}
>
  {trackingLabel}
</div>
          </div>

          {hasLocation ? (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="rounded-2xl border border-slate-800 bg-[#0B1522] p-4">
                <div className="flex items-center gap-3">
                  <div className="relative flex h-12 w-12 items-center justify-center rounded-full bg-[#16BFFF]/20">
                    <div className="absolute h-12 w-12 animate-ping rounded-full bg-[#16BFFF]/20" />
                    <span className="relative text-xl">🚚</span>
                  </div>

                  <div>
                    <p className="text-sm font-semibold text-white">
                      Truck Position
                    </p>
                    <p className="text-xs text-slate-400">
  {hasLocation
    ? `Last location updated ${formatDateTime(load.updated_at)}`
    : "No location reported yet"}
</p>
                  </div>
                </div>

                <div className="mt-4 space-y-3 text-sm">
                  <a
                    href={`https://www.google.com/maps?q=${load.driver_lat},${load.driver_lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block rounded-xl bg-gradient-to-r from-[#1E6BFF] to-[#00A3FF] px-4 py-2 text-center text-sm font-semibold text-white"
                  >
                    Open in Google Maps
                  </a>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0B1522] lg:col-span-2">
                <iframe
                  title="Current shipment location"
                  src={`https://www.google.com/maps?q=${load.driver_lat},${load.driver_lng}&z=10&output=embed`}
                  className="h-[320px] w-full border-0"
                  loading="lazy"
                />
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-700 bg-[#0B1522] p-8 text-center">
              <p className="text-lg font-semibold text-white">
                No driver location reported yet
              </p>
              
            </div>
          )}
        </div>

        {/* ROUTE */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <InfoCard title="Pickup" value={load.pickup} />
          <InfoCard title="Delivery" value={load.dropoff} />
        </div>

        {/* TIMELINE */}
        <div className="rounded-2xl border border-slate-800 bg-[#07101A] p-6">
          <div className="mb-6">
            <h2 className="text-xl font-bold text-white">Shipment Timeline</h2>
            
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
            {statuses.map((step, index) => {
              const active = index <= currentStep;
              const timestamp = load[step.key as keyof Load] as string | undefined;

              return (
                <div
                  key={step.label}
                  className={`rounded-2xl border p-4 transition ${
                    active
                      ? "border-[#16BFFF]/40 bg-[#16BFFF]/10"
                      : "border-slate-800 bg-[#0B1522]"
                  }`}
                >
                  <div
                    className={`mb-3 flex h-10 w-10 items-center justify-center rounded-full border text-sm font-bold ${
                      active
                        ? "border-[#16BFFF] bg-[#16BFFF]/20 text-[#16BFFF]"
                        : "border-slate-700 text-slate-500"
                    }`}
                  >
                    {index + 1}
                  </div>

                  <p className={`text-sm font-semibold ${active ? "text-white" : "text-slate-500"}`}>
                    {step.label}
                  </p>

                  <p className="mt-1 text-xs text-slate-500">
                    {timestamp ? formatDateTime(timestamp) : "No timestamp yet"}
                  </p>

                  {index < currentStep && (
                    <p className="mt-2 text-xs text-[#16BFFF]">Completed</p>
                  )}

                  {index === currentStep && (
                    <p className="mt-2 text-xs text-green-400">Active</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* DRIVER */}
        <div>
          <div className="rounded-2xl border border-slate-800 bg-[#07101A] p-5">
            <h2 className="text-lg font-semibold text-white">
              Driver Information
            </h2>

            <div className="mt-4 space-y-3 text-sm">
              <div>
                <p className="text-slate-500">Driver</p>
                <p className="text-white">Assigned carrier driver</p>
              </div>

              <div>
                <p className="text-slate-500">Tracking Status</p>
                <p className={`${statusColor(load.status)} font-semibold`}>
                  {load.status}
                </p>
              </div>
            </div>
          </div>

        </div>

        {load.status?.toLowerCase() === "delivered" && !load.pod_uploaded_at && (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-5 shadow-[0_0_25px_rgba(239,68,68,0.15)]">
            <h2 className="text-lg font-semibold text-red-300">
              Waiting for Proof of Delivery
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              Shipment has been marked delivered but POD documentation has not yet been uploaded.
            </p>
          </div>
        )}

        {load.pod_uploaded_at && (
          <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-5 shadow-[0_0_25px_rgba(34,197,94,0.15)]">
            <h2 className="text-lg font-semibold text-green-300">
              Proof of Delivery Uploaded
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              Final delivery documentation has been completed successfully.
            </p>
          </div>
        )}
      </div>

      <div className="fixed bottom-3 right-4 text-[11px] tracking-wide text-slate-500">
        Powered by <span className="text-[#16BFFF]">TRACON Nexus</span>
      </div>
    </div>
  );
}

function InfoCard({ title, value }: { title: string; value?: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#07101A] p-5">
      <p className="text-xs uppercase tracking-[0.25em] text-slate-500">
        {title}
      </p>
      <h2 className="mt-2 text-lg font-semibold text-white">{value || "-"}</h2>
    </div>
  );
}

function formatDateTime(value?: string) {
  if (!value) return "No timestamp yet";

  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function statusColor(status?: string) {
  const clean = status?.toLowerCase();

  if (clean === "pending") return "text-yellow-400";
  if (clean === "assigned") return "text-cyan-400";
  if (clean === "arrived at pickup") return "text-indigo-400";
  if (clean === "in transit") return "text-[#16BFFF]";
  if (clean === "delivered") return "text-green-400";

  return "text-slate-300";
}
