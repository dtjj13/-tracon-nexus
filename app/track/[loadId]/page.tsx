"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "../../lib/supabase";

type Load = {
  id: string;
  tracon_id: string;
  broker_load_id?: string;
  pickup: string;
  dropoff: string;
  status: string;
  driver_name?: string;
  driver_phone?: string;
  driver_lat?: number;
  driver_lng?: number;
  bol_url?: string;
  pod_url?: string;
  rate_con_url?: string;
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

  useEffect(() => {
    fetchLoad();

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
        () => fetchLoad()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadId]);

  const fetchLoad = async () => {
    const { data, error } = await supabase
      .from("loads")
      .select("*")
      .eq("id", loadId)
      .single();

    if (!error && data) setLoad(data);
  };

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

  const hasLocation = !!load.driver_lat && !!load.driver_lng;

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
                hasLocation
                  ? "border-green-500/30 bg-green-500/10 text-green-300"
                  : "border-yellow-500/30 bg-yellow-500/10 text-yellow-300"
              }`}
            >
              {hasLocation ? "Live Location Active" : "Awaiting Location"}
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
                      Last reported location
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-3 text-sm">
                  <div>
                    <p className="text-slate-500">Latitude</p>
                    <p className="font-mono text-white">{load.driver_lat}</p>
                  </div>

                  <div>
                    <p className="text-slate-500">Longitude</p>
                    <p className="font-mono text-white">{load.driver_lng}</p>
                  </div>

                  <a
                    href={`https://www.google.com/maps?q=${load.driver_lat},${load.driver_lng}`}
                    target="_blank"
                    className="block rounded-xl bg-gradient-to-r from-[#1E6BFF] to-[#00A3FF] px-4 py-2 text-center text-sm font-semibold text-white"
                  >
                    Open in Google Maps
                  </a>
                </div>
              </div>

              <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0B1522] lg:col-span-2">
                <iframe
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

        {/* DRIVER + DOCS */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-800 bg-[#07101A] p-5">
            <h2 className="text-lg font-semibold text-white">
              Driver Information
            </h2>

            <div className="mt-4 space-y-3 text-sm">
              <div>
                <p className="text-slate-500">Driver</p>
                <p className="text-white">{load.driver_name || "Assigned"}</p>
              </div>

              <div>
                <p className="text-slate-500">Driver Phone</p>
                <p className="text-white">{load.driver_phone || "Not available"}</p>
              </div>

              <div>
                <p className="text-slate-500">Tracking Status</p>
                <p className={`${statusColor(load.status)} font-semibold`}>
                  {load.status}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#07101A] p-5">
            <h2 className="text-lg font-semibold text-white">
              Shipment Documents
            </h2>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <DocumentCard label="Rate Con" url={load.rate_con_url} />
              <DocumentCard label="BOL" url={load.bol_url} />
              <DocumentCard label="POD" url={load.pod_url} highlight={!!load.pod_url} />
            </div>
          </div>
        </div>

        {load.status?.toLowerCase() === "delivered" && !load.pod_url && (
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-5 shadow-[0_0_25px_rgba(239,68,68,0.15)]">
            <h2 className="text-lg font-semibold text-red-300">
              Waiting for Proof of Delivery
            </h2>
            <p className="mt-2 text-sm text-slate-300">
              Shipment has been marked delivered but POD documentation has not yet been uploaded.
            </p>
          </div>
        )}

        {load.pod_url && (
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

function DocumentCard({
  label,
  url,
  highlight,
}: {
  label: string;
  url?: string;
  highlight?: boolean;
}) {
  if (!url) {
    return (
      <div className="rounded-xl border border-slate-800 bg-[#0B1522] p-4 text-center">
        <p className="text-sm text-slate-500">{label}</p>
        <p className="mt-2 text-xs text-slate-600">Not Uploaded</p>
      </div>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      className={`rounded-xl border p-4 text-center transition hover:scale-[1.02] ${
        highlight
          ? "border-green-500/40 bg-green-500/10"
          : "border-[#16BFFF]/30 bg-[#16BFFF]/10"
      }`}
    >
      <p className="text-sm font-semibold text-white">{label}</p>
      <p className={`mt-2 text-xs ${highlight ? "text-green-300" : "text-[#16BFFF]"}`}>
        View Document
      </p>
    </a>
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