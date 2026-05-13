"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../components/Navbar";
import { supabase } from "../lib/supabase";
import { hasRole } from "../lib/getUserRole";

type Load = {
  id: string;
  tracon_id?: string;
  broker_load_id?: string;
  pickup?: string;
  dropoff?: string;
  status?: string;
  driver?: string;
  driver_email?: string;
  driver_name?: string;
  driver_pay?: number;
  loaded_miles?: number;
  bol_url?: string;
  pod_url?: string;
  rate_con_url?: string;
  assigned_at?: string;
  arrived_pickup_at?: string;
  in_transit_at?: string;
  delivered_at?: string;
  pod_uploaded_at?: string;
  truck_number?: string;
};

export default function DriverPage() {
  const router = useRouter();

  const [loads, setLoads] = useState<Load[]>([]);
  const [email, setEmail] = useState("");
  const [trackingLoadId, setTrackingLoadId] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      const allowed = await hasRole(["driver", "owner", "admin"]);
      if (!allowed) router.push("/dispatch");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user?.email) return;

      setEmail(user.email);
      fetchLoads(user.email);
    };

    init();

    const channel = supabase
      .channel("driver-mobile-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "loads" },
        async () => {
          const {
            data: { user },
          } = await supabase.auth.getUser();

          if (user?.email) fetchLoads(user.email);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  const fetchLoads = async (userEmail: string) => {
    const { data, error } = await supabase
      .from("loads")
      .select("*")
      .or(`driver_email.eq.${userEmail},driver.eq.${userEmail}`)
      .order("created_at", { ascending: false });

    if (error) return alert(error.message);
    setLoads(data || []);
  };

  const updateStatus = async (loadId: string, status: string) => {
    const cleanStatus = status.trim();

    const timestampUpdate: {
      assigned_at?: string;
      arrived_pickup_at?: string;
      in_transit_at?: string;
      delivered_at?: string;
    } = {};

    if (cleanStatus === "Assigned") timestampUpdate.assigned_at = new Date().toISOString();
    if (cleanStatus === "Arrived at Pickup") timestampUpdate.arrived_pickup_at = new Date().toISOString();
    if (cleanStatus === "In Transit") timestampUpdate.in_transit_at = new Date().toISOString();
    if (cleanStatus === "Delivered") timestampUpdate.delivered_at = new Date().toISOString();

    const { error } = await supabase
      .from("loads")
      .update({
        status: cleanStatus,
        ...timestampUpdate,
      })
      .eq("id", loadId);

    if (error) return alert(error.message);

    await supabase.from("notifications").insert({
      title: `Load ${loadId.slice(0, 6)} Updated`,
      message: `Driver changed status to ${cleanStatus}`,
      load_id: loadId,
      type: cleanStatus.toLowerCase(),
    });

    fetchLoads(email);
  };

  const uploadFile = async (loadId: string, file: File | null, field: "bol_url" | "pod_url") => {
    if (!file) return;

    const fileName = `${field}-${loadId}-${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(fileName, file, { upsert: true });

    if (uploadError) return alert(uploadError.message);

    const { data } = supabase.storage.from("documents").getPublicUrl(fileName);

    const updateData: any = {
      [field]: data.publicUrl,
    };

    if (field === "pod_url") {
      updateData.pod_uploaded_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("loads")
      .update(updateData)
      .eq("id", loadId);

    if (error) return alert(error.message);

    await supabase.from("notifications").insert({
      title: field === "pod_url" ? "POD Uploaded" : "BOL Uploaded",
      message: `Document uploaded for load ${loadId.slice(0, 6)}`,
      load_id: loadId,
      type: "document",
    });

    fetchLoads(email);
  };

  const startTracking = (loadId: string) => {
  if (!navigator.geolocation) {
    alert("GPS is not supported on this device");
    return;
  }

  setTrackingLoadId(loadId);

  navigator.geolocation.watchPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;

      await supabase
        .from("loads")
       .update({
  driver_lat: position.coords.latitude,
  driver_lng: position.coords.longitude,
  tracking_active: true,
tracking_started_at: new Date().toISOString(),
})
        .eq("id", loadId);
    },
    () => {
      alert("Unable to access location. Please allow location permissions.");
    },
    {
      enableHighAccuracy: true,
      maximumAge: 10000,
      timeout: 10000,
    }
  );
};

   

  return (
    <div className="min-h-screen bg-[#020617] p-3 text-white sm:p-6">
      <div className="space-y-5">
        <Navbar />

        <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-[#07101A] to-[#050A11] p-5">
          <p className="text-xs uppercase tracking-[0.3em] text-[#16BFFF]">
            Driver View
          </p>
          <h1 className="mt-2 text-xl font-semibold text-white">My Loads</h1>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {loads.map((load) => (
            <DriverLoadCard
              key={load.id}
              load={load}
              trackingLoadId={trackingLoadId}
              updateStatus={updateStatus}
              uploadFile={uploadFile}
              startTracking={startTracking}
            />
          ))}

          {loads.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-800 bg-[#07101A] p-8 text-center text-slate-500">
              No assigned loads.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function DriverLoadCard({
  load,
  trackingLoadId,
  updateStatus,
  uploadFile,
  startTracking,
}: {
  load: Load;
  trackingLoadId: string | null;
  updateStatus: (loadId: string, status: string) => void;
  uploadFile: (loadId: string, file: File | null, field: "bol_url" | "pod_url") => void;
  startTracking: (loadId: string) => void;
}) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-[#07101A] p-5 shadow-[0_0_30px_rgba(0,0,0,0.35)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-2xl font-bold text-[#16BFFF]">
            {load.broker_load_id || load.tracon_id || "Load"}
          </p>
          <p className="mt-1 text-xs text-slate-500">{load.tracon_id}</p>
        </div>

        <div className={`rounded-xl border px-3 py-2 text-xs font-semibold ${statusBadge(load.status)}`}>
          {load.status || "Assigned"}
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-slate-800 bg-[#0B1522] p-4">
        <p className="text-xs uppercase tracking-[0.25em] text-slate-500">Route</p>
        <p className="mt-2 text-lg font-semibold text-white">
          {load.pickup || "-"} → {load.dropoff || "-"}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        {load.truck_number && (
          <InfoBox title="Truck" value={load.truck_number || "-"} />
        )}

        <InfoBox
          title="Loaded Miles"
          value={load.loaded_miles ? `${load.loaded_miles}` : "-"}
        />

        <InfoBox
          title="Driver Pay"
          value={`$${Number(load.driver_pay || 0).toLocaleString()}`}
          highlight
        />
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <BigStatusButton
          label="Arrived"
          onClick={() => updateStatus(load.id, "Arrived at Pickup")}
          active={load.status === "Arrived at Pickup"}
        />

        <BigStatusButton
          label="In Transit"
          onClick={() => updateStatus(load.id, "In Transit")}
          active={load.status === "In Transit"}
        />

        <BigStatusButton
          label="Delivered"
          onClick={() => updateStatus(load.id, "Delivered")}
          active={load.status === "Delivered"}
          green
        />
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex h-14 cursor-pointer items-center justify-center rounded-2xl bg-[#111B35] text-sm font-semibold text-[#7BB7FF]">
          {load.bol_url ? "BOL Uploaded" : "Upload BOL"}
          <input
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={(e) =>
              uploadFile(load.id, e.target.files?.[0] || null, "bol_url")
            }
          />
        </label>

        <label className="flex h-14 cursor-pointer items-center justify-center rounded-2xl bg-green-500/15 text-sm font-semibold text-green-300">
          {load.pod_url ? "POD Uploaded" : "Upload POD"}
          <input
            type="file"
            accept="image/*,.pdf"
            className="hidden"
            onChange={(e) =>
              uploadFile(load.id, e.target.files?.[0] || null, "pod_url")
            }
          />
        </label>
      </div>

      <button
        onClick={() => startTracking(load.id)}
        className="mt-4 h-14 w-full rounded-2xl border border-[#16BFFF]/40 bg-[#16BFFF]/10 text-sm font-semibold text-[#16BFFF]"
      >
        {trackingLoadId === load.id ? "Tracking Active" : "Start Tracking"}
      </button>
    </div>
  );
}

function InfoBox({
  title,
  value,
  highlight,
}: {
  title: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#0B1522] p-4">
      <p className="text-xs text-slate-500">{title}</p>
      <p className={`mt-2 text-lg font-semibold ${highlight ? "text-yellow-400" : "text-white"}`}>
        {value}
      </p>
    </div>
  );
}

function BigStatusButton({
  label,
  onClick,
  active,
  green,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  green?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`h-16 rounded-2xl text-sm font-bold uppercase tracking-wide shadow-[0_0_20px_rgba(0,0,0,0.25)] transition ${
        active
          ? green
            ? "bg-green-500 text-white"
            : "bg-[#16BFFF] text-white"
          : green
          ? "border border-green-500/30 bg-green-500/10 text-green-300"
          : "border border-[#16BFFF]/30 bg-[#16BFFF]/10 text-[#16BFFF]"
      }`}
    >
      {label}
    </button>
  );
}

function statusBadge(status?: string) {
  const clean = status?.toLowerCase();

  if (clean === "pending") return "border-yellow-500/40 bg-yellow-500/10 text-yellow-300";
  if (clean === "assigned") return "border-cyan-500/40 bg-cyan-500/10 text-cyan-300";
  if (clean === "arrived at pickup") return "border-indigo-500/40 bg-indigo-500/10 text-indigo-300";
  if (clean === "in transit") return "border-[#16BFFF]/40 bg-[#16BFFF]/10 text-[#16BFFF]";
  if (clean === "delivered") return "border-green-500/40 bg-green-500/10 text-green-300";

  return "border-slate-700 bg-slate-800 text-slate-300";
}