"use client";

import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { supabase } from "../lib/supabase";

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
  driver_phone?: string;
  truck_number?: string;
  loaded_miles?: number;
  driver_pay?: number;
  bol_url?: string;
  pod_url?: string;
};

export default function DriverPage() {
  const [loads, setLoads] = useState<Load[]>([]);
  const [email, setEmail] = useState("");
  const [selectedLoad, setSelectedLoad] = useState<Load | null>(null);

  useEffect(() => {
    getUser();

    const channel = supabase
      .channel("driver-loads-realtime")
      .on(
  "postgres_changes",
  { event: "*", schema: "public", table: "loads" },
  () => fetchLoads()
)
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [email]);

  const getUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const userEmail = user?.email || "";
    setEmail(userEmail);

    if (userEmail) fetchLoads(userEmail);
  };

  const fetchLoads = async (userEmail = email) => {
    if (!userEmail) return;

    const { data, error } = await supabase
      .from("loads")
      .select("*")
      .or(`driver_email.eq.${userEmail},driver.eq.${userEmail}`)
      .order("created_at", { ascending: false });

    if (error) return alert(error.message);

    setLoads(data || []);

    if (!selectedLoad && data && data.length > 0) {
      setSelectedLoad(data[0]);
    }
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

    fetchLoads();
  };

  const uploadDoc = async (load: Load, field: "bol_url" | "pod_url", file: File | null) => {
    if (!file) return;

    const fileName = `${field}-${load.id}-${Date.now()}-${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(fileName, file, { upsert: true });

    if (uploadError) return alert(uploadError.message);

    const { data } = supabase.storage.from("documents").getPublicUrl(fileName);

    const updatePayload: any = {
      [field]: data.publicUrl,
    };

    if (field === "pod_url") {
      updatePayload.pod_uploaded_at = new Date().toISOString();
    }

    const { error } = await supabase.from("loads").update(updatePayload).eq("id", load.id);

    if (error) return alert(error.message);

    await supabase.from("notifications").insert({
      title: field === "pod_url" ? "POD Uploaded" : "BOL Uploaded",
      message: `Document uploaded for load ${load.broker_load_id || load.tracon_id || load.id.slice(0, 6)}`,
      load_id: load.id,
      type: "document",
    });

    fetchLoads();
  };

  const startTracking = async (load: Load) => {
    if (!navigator.geolocation) {
      alert("Location tracking is not available on this device.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;

        const { error } = await supabase
          .from("loads")
          .update({
            driver_lat: latitude,
            driver_lng: longitude,
            updated_at: new Date().toISOString(),
          })
          .eq("id", load.id);

        if (error) return alert(error.message);

        alert("Tracking updated");
        fetchLoads();
      },
      () => {
        alert("Location permission denied.");
      }
    );
  };

  return (
    <div className="min-h-screen bg-[#020617] p-3 pb-32 text-white sm:p-6">
      <Navbar />

      <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-[#07101A] to-[#050A11] p-5">
        <p className="text-xs uppercase tracking-[0.3em] text-[#16BFFF]">Driver View</p>
        <h1 className="mt-2 text-xl font-semibold">My Loads</h1>
      </div>

      <div className="mt-5 space-y-5">
        {loads.map((load) => (
          <DriverLoadCard
            key={load.id}
            load={load}
            selected={selectedLoad?.id === load.id}
            setSelectedLoad={setSelectedLoad}
            updateStatus={updateStatus}
            uploadDoc={uploadDoc}
            startTracking={startTracking}
          />
        ))}

        {loads.length === 0 && (
          <div className="rounded-2xl border border-dashed border-slate-800 p-8 text-center text-slate-500">
            No assigned loads.
          </div>
        )}
      </div>

      {selectedLoad && (
        <StickyDriverActions load={selectedLoad} updateStatus={updateStatus} />
      )}
    </div>
  );
}

function DriverLoadCard({
  load,
  selected,
  setSelectedLoad,
  updateStatus,
  uploadDoc,
  startTracking,
}: any) {
  return (
    <div
      onClick={() => setSelectedLoad(load)}
      className={`rounded-3xl border p-5 transition ${
        selected
          ? "border-[#16BFFF]/50 bg-[#07101A] shadow-[0_0_28px_rgba(22,191,255,0.12)]"
          : "border-slate-800 bg-[#07101A]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-[#16BFFF]">
            {load.broker_load_id || load.tracon_id || load.id.slice(0, 6)}
          </h2>
          <p className="text-sm text-slate-500">{load.tracon_id}</p>
        </div>

        <span className="rounded-xl border border-indigo-400/40 bg-indigo-500/10 px-3 py-2 text-xs font-semibold text-indigo-300">
          {load.status || "Assigned"}
        </span>
      </div>

      {!selected ? (
        <div className="mt-4 rounded-2xl border border-slate-800 bg-[#0B1522] p-4">
          <p className="text-sm font-semibold text-white">
            {load.pickup || "-"} → {load.dropoff || "-"}
          </p>
        </div>
      ) : (
        <>
          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
  <div className="rounded-2xl border border-slate-800 bg-[#0B1522] p-4">
    <p className="text-xs uppercase tracking-[0.25em] text-[#16BFFF]">
      Pickup
    </p>
    <p className="mt-3 text-base font-semibold leading-relaxed text-white">
      {load.pickup || "-"}
    </p>
  </div>

  <div className="rounded-2xl border border-slate-800 bg-[#0B1522] p-4">
    <p className="text-xs uppercase tracking-[0.25em] text-green-400">
      Delivery
    </p>
    <p className="mt-3 text-base font-semibold leading-relaxed text-white">
      {load.dropoff || "-"}
    </p>
  </div>
</div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <InfoBox title="Truck" value={load.truck_number || "-"} />
            <InfoBox
              title="Loaded Miles"
              value={load.loaded_miles ? String(load.loaded_miles) : "-"}
            />
            <InfoBox
              title="Driver Pay"
              value={`$${Number(load.driver_pay || 0).toLocaleString()}`}
              highlight
            />
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3">
            <BigStatusButton
              label="Arrived"
              active={load.status === "Arrived at Pickup"}
              onClick={(e: any) => {
                e.stopPropagation();
                updateStatus(load.id, "Arrived at Pickup");
              }}
            />

            <BigStatusButton
              label="In Transit"
              active={load.status === "In Transit"}
              onClick={(e: any) => {
                e.stopPropagation();
                updateStatus(load.id, "In Transit");
              }}
            />

            <BigStatusButton
              label="Delivered"
              active={load.status === "Delivered"}
              onClick={(e: any) => {
                e.stopPropagation();
                updateStatus(load.id, "Delivered");
              }}
            />
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
  {load.bol_url ? (
    <>
      <a
        href={load.bol_url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="rounded-2xl bg-indigo-500/20 py-4 text-center font-semibold text-indigo-300"
      >
        View BOL
      </a>

      <UploadButton
        label="Replace BOL"
        onUpload={(file: File | null) => uploadDoc(load, "bol_url", file)}
      />
    </>
  ) : (
    <UploadButton
      label="Upload BOL"
      onUpload={(file: File | null) => uploadDoc(load, "bol_url", file)}
    />
  )}

  {load.pod_url ? (
    <>
      <a
        href={load.pod_url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className="rounded-2xl bg-green-500/20 py-4 text-center font-semibold text-green-300"
      >
        View POD
      </a>

      <UploadButton
        label="Replace POD"
        green
        onUpload={(file: File | null) => uploadDoc(load, "pod_url", file)}
      />
    </>
  ) : (
    <UploadButton
      label="Upload POD"
      green
      onUpload={(file: File | null) => uploadDoc(load, "pod_url", file)}
    />
  )}
</div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              startTracking(load);
            }}
            className="mt-4 w-full rounded-2xl border border-[#16BFFF]/40 bg-[#16BFFF]/10 py-4 text-base font-semibold text-[#16BFFF]"
          >
            Start Tracking
          </button>
        </>
      )}
    </div>
  );
}

function StickyDriverActions({ load, updateStatus }: any) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-800 bg-[#020617]/95 p-3 backdrop-blur-xl sm:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-3 gap-2">
        <button
          onClick={() => updateStatus(load.id, "Arrived at Pickup")}
          className="rounded-xl bg-[#0B1522] px-2 py-4 text-xs font-semibold text-white"
        >
          Arrived
        </button>

        <button
          onClick={() => updateStatus(load.id, "In Transit")}
          className="rounded-xl bg-[#16BFFF] px-2 py-4 text-xs font-semibold text-white"
        >
          Transit
        </button>

        <button
          onClick={() => updateStatus(load.id, "Delivered")}
          className="rounded-xl bg-green-600 px-2 py-4 text-xs font-semibold text-white"
        >
          Delivered
        </button>
      </div>
    </div>
  );
}

function BigStatusButton({ label, active, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-2xl py-4 text-base font-semibold transition-all duration-200 ${
        active
          ? "bg-[#16BFFF] text-white shadow-[0_0_20px_rgba(22,191,255,0.35)]"
          : "border border-slate-700 bg-[#0B1522] text-slate-300"
      }`}
    >
      {label}
    </button>
  );
}

function InfoBox({ title, value, highlight }: any) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#0B1522] p-4">
      <p className="text-xs text-slate-500">{title}</p>
      <p className={`mt-2 font-semibold ${highlight ? "text-yellow-400" : "text-white"}`}>
        {value}
      </p>
    </div>
  );
}

function UploadButton({
  label,
  url,
  green,
  onUpload,
}: {
  label: string;
  url?: string;
  green?: boolean;
  onUpload: (file: File | null) => void;
}) {
  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        className={`rounded-2xl py-4 text-center font-semibold ${
          green
            ? "bg-green-500/20 text-green-300"
            : "bg-indigo-500/20 text-indigo-300"
        }`}
      >
        {label}
      </a>
    );
  }

  return (
    <label
      onClick={(e) => e.stopPropagation()}
      className={`cursor-pointer rounded-2xl py-4 text-center font-semibold ${
        green
          ? "bg-green-500/20 text-green-300"
          : "bg-indigo-500/20 text-indigo-300"
      }`}
    >
      {label}
      <input
        type="file"
        className="hidden"
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => onUpload(e.target.files?.[0] || null)}
      />
    </label>
  );
}