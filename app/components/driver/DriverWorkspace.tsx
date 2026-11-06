"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CircleDollarSign,
  ClipboardCheck,
  FileText,
  LoaderCircle,
  MapPin,
  Navigation,
  Radio,
  Route,
  Truck,
  Upload,
} from "lucide-react";

import Navbar from "@/app/components/Navbar";
import {
  openLoadDocument,
  privateDocumentReference,
} from "@/app/lib/loadDocuments";
import { supabase } from "@/app/lib/supabase";

type Load = {
  id: string;
  tracon_id?: string | null;
  broker_load_id?: string | null;
  broker_name?: string | null;
  pickup?: string | null;
  dropoff?: string | null;
  status?: string | null;
  driver?: string | null;
  driver_email?: string | null;
  truck_number?: string | null;
  loaded_miles?: number | null;
  driver_pay?: number | null;
  bol_url?: string | null;
  pod_url?: string | null;
  tracking_active?: boolean | null;
};

type LoadFilter = "active" | "completed" | "all";
type DocumentField = "bol_url" | "pod_url";

const workflow = ["Assigned", "Arrived at Pickup", "In Transit", "Delivered"];
const maxDocumentBytes = 10 * 1024 * 1024;
const allowedDocumentTypes = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

export default function DriverWorkspace() {
  const [loads, setLoads] = useState<Load[]>([]);
  const [email, setEmail] = useState("");
  const [selectedLoadId, setSelectedLoadId] = useState<string | null>(null);
  const [filter, setFilter] = useState<LoadFilter>("active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatingLoadId, setUpdatingLoadId] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [trackingLoadId, setTrackingLoadId] = useState<string | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const lastLocationSaveRef = useRef(0);

  const fetchLoads = useCallback(async (userEmail: string) => {
    if (!userEmail) return;

    setError("");
    const { data, error: loadsError } = await supabase
      .from("loads")
      .select("*")
      .or(`driver_email.eq.${userEmail},driver.eq.${userEmail}`)
      .order("created_at", { ascending: false });

    if (loadsError) {
      setError(loadsError.message);
      setLoading(false);
      return;
    }

    const nextLoads = (data ?? []) as Load[];
    setLoads(nextLoads);
    setSelectedLoadId((current) => {
      if (current && nextLoads.some((load) => load.id === current)) {
        return current;
      }

      return (
        nextLoads.find((load) => !isCompleted(load))?.id ??
        nextLoads[0]?.id ??
        null
      );
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    let active = true;

    async function loadDriverSession() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (!active) return;

      if (userError) {
        setError("Your session could not be verified. Refresh the page and try again.");
        setLoading(false);
        return;
      }

      const userEmail = user?.email ?? "";
      setEmail(userEmail);

      if (!userEmail) {
        setError("Your signed-in account does not have an email address.");
        setLoading(false);
        return;
      }

      await fetchLoads(userEmail);
    }

    void loadDriverSession();
    return () => {
      active = false;
    };
  }, [fetchLoads]);

  useEffect(() => {
    if (!email) return;

    const channel = supabase
      .channel(`driver-loads-${email}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "loads" },
        () => void fetchLoads(email)
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [email, fetchLoads]);

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, []);

  const selectedLoad =
    loads.find((load) => load.id === selectedLoadId) ?? null;
  const visibleLoads = useMemo(() => {
    if (filter === "all") return loads;
    if (filter === "completed") return loads.filter(isCompleted);
    return loads.filter((load) => !isCompleted(load));
  }, [filter, loads]);
  const activeCount = loads.filter((load) => !isCompleted(load)).length;
  const completedCount = loads.length - activeCount;
  const missingDocumentCount = loads.filter(
    (load) => !isCompleted(load) && (!load.bol_url || !load.pod_url)
  ).length;

  const updateStatus = async (load: Load, status: string) => {
    if (load.status === status || updatingLoadId) return;
    if (workflowIndex(status) <= workflowIndex(load.status)) {
      setError("Load status cannot move backward from the Driver App.");
      return;
    }

    setUpdatingLoadId(load.id);
    setError("");
    const timestamps: Record<string, string> = {};
    if (status === "Arrived at Pickup") {
      timestamps.arrived_pickup_at = new Date().toISOString();
    }
    if (status === "In Transit") {
      timestamps.in_transit_at = new Date().toISOString();
    }
    if (status === "Delivered") {
      timestamps.delivered_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from("loads")
      .update({
        status,
        ...timestamps,
        ...(status === "Delivered" ? { tracking_active: false } : {}),
      })
      .eq("id", load.id);

    if (updateError) {
      setError(updateError.message);
      setUpdatingLoadId(null);
      return;
    }

    if (status === "Delivered" && trackingLoadId === load.id) {
      clearLocationWatch();
      setTrackingLoadId(null);
    }

    await supabase.from("notifications").insert({
      title: `Load ${loadLabel(load)} Updated`,
      message: `Driver changed status to ${status}`,
      load_id: load.id,
      type: status.toLowerCase(),
    });

    await fetchLoads(email);
    setUpdatingLoadId(null);
  };

  const uploadDocument = async (
    load: Load,
    field: DocumentField,
    file: File | null
  ) => {
    if (!file) return;
    const validationError = validateDocument(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    const uploadKey = `${load.id}:${field}`;
    setUploading(uploadKey);
    setError("");
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "-");
    const filePath = `loads/${load.id}/${field}-${file.lastModified}-${file.size}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(filePath, file, { upsert: false, contentType: file.type });

    if (uploadError) {
      setError(uploadError.message);
      setUploading(null);
      return;
    }

    const updatePayload: {
      bol_url?: string;
      pod_url?: string;
      pod_uploaded_at?: string;
    } = { [field]: privateDocumentReference(filePath) };
    if (field === "pod_url") {
      updatePayload.pod_uploaded_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from("loads")
      .update(updatePayload)
      .eq("id", load.id);

    if (updateError) {
      setError(updateError.message);
      setUploading(null);
      return;
    }

    await supabase.from("notifications").insert({
      title: field === "pod_url" ? "POD Uploaded" : "BOL Uploaded",
      message: `Document uploaded for load ${loadLabel(load)}`,
      load_id: load.id,
      type: "document",
    });
    await fetchLoads(email);
    setUploading(null);
  };

  const openDocument = async (reference: string) => {
    setError("");
    try {
      await openLoadDocument(reference);
    } catch (openError) {
      setError(
        openError instanceof Error
          ? openError.message
          : "This document could not be opened."
      );
    }
  };

  function clearLocationWatch() {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    lastLocationSaveRef.current = 0;
  }

  const stopTracking = async (loadId: string) => {
    clearLocationWatch();
    setError("");
    const { error: trackingError } = await supabase
      .from("loads")
      .update({ tracking_active: false, updated_at: new Date().toISOString() })
      .eq("id", loadId);

    setTrackingLoadId(null);
    if (trackingError) {
      setError(trackingError.message);
      return;
    }
    await fetchLoads(email);
  };

  const startTracking = async (load: Load) => {
    if (!navigator.geolocation) {
      setError("Location tracking is not available on this device.");
      return;
    }

    clearLocationWatch();
    setError("");
    if (trackingLoadId && trackingLoadId !== load.id) {
      await supabase
        .from("loads")
        .update({ tracking_active: false, updated_at: new Date().toISOString() })
        .eq("id", trackingLoadId);
    }

    let firstUpdate = true;
    watchIdRef.current = navigator.geolocation.watchPosition(
      async (position) => {
        const now = Date.now();
        if (!firstUpdate && now - lastLocationSaveRef.current < 30_000) return;

        lastLocationSaveRef.current = now;
        const { error: trackingError } = await supabase
          .from("loads")
          .update({
            driver_lat: position.coords.latitude,
            driver_lng: position.coords.longitude,
            tracking_active: true,
            location_updated_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...(firstUpdate
              ? { tracking_started_at: new Date().toISOString() }
              : {}),
          })
          .eq("id", load.id);

        if (trackingError) {
          clearLocationWatch();
          setTrackingLoadId(null);
          setError(trackingError.message);
          return;
        }

        setTrackingLoadId(load.id);
        if (firstUpdate) {
          firstUpdate = false;
          await fetchLoads(email);
        }
      },
      (locationError) => {
        clearLocationWatch();
        setTrackingLoadId(null);
        if (locationError.code === locationError.PERMISSION_DENIED) {
          setError(
            "Location permission is blocked. Allow location access in your browser settings and try again."
          );
        } else if (locationError.code === locationError.POSITION_UNAVAILABLE) {
          setError(
            "Your current location is unavailable. Check Location Services and try again."
          );
        } else {
          setError("Location request timed out. Check your signal and try again.");
        }
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 }
    );
  };

  return (
    <main className="min-h-screen bg-[#020617] px-3 py-4 pb-28 text-white sm:px-6 sm:py-6">
      <div className="mx-auto max-w-5xl space-y-5">
        <Navbar />

        <header className="rounded-3xl border border-cyan-500/20 bg-[#07101d] p-5 sm:p-7">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-cyan-400">
                <Truck className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-cyan-400">
                  Driver workspace
                </p>
                <h1 className="mt-2 text-3xl font-bold">My Loads</h1>
                <p className="mt-2 text-sm text-slate-400">
                  Run the load, share progress, and turn in paperwork from one
                  road-ready screen.
                </p>
              </div>
            </div>

            <Link
              href="/driver/dvir"
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#1e6bff] to-[#00a3ff] px-4 py-3 text-sm font-bold text-white"
            >
              <ClipboardCheck className="h-4 w-4" /> Start DVIR
            </Link>
          </div>
        </header>

        {error && (
          <div
            role="alert"
            aria-live="assertive"
            className="flex items-start gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">Action could not be completed</p>
              <p className="mt-1 break-words text-sm text-red-200/80">{error}</p>
            </div>
            <button
              type="button"
              onClick={() => setError("")}
              className="text-xs font-bold uppercase tracking-wide"
            >
              Dismiss
            </button>
          </div>
        )}

        <section className="grid grid-cols-3 gap-3">
          <SummaryCard label="Active" value={activeCount} />
          <SummaryCard label="Completed" value={completedCount} />
          <SummaryCard label="Missing docs" value={missingDocumentCount} warn />
        </section>

        <div className="flex gap-2 overflow-x-auto pb-1">
          {(["active", "completed", "all"] as LoadFilter[]).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilter(value)}
              aria-pressed={filter === value}
              className={`shrink-0 rounded-full border px-4 py-2 text-xs font-bold capitalize transition ${
                filter === value
                  ? "border-cyan-400/50 bg-cyan-500/15 text-cyan-300"
                  : "border-slate-700 bg-[#07101d] text-slate-400"
              }`}
            >
              {value} loads
            </button>
          ))}
        </div>

        {loading ? (
          <div
            role="status"
            aria-live="polite"
            className="rounded-3xl border border-slate-800 bg-[#07101d] p-10 text-center"
          >
            <LoaderCircle className="mx-auto h-7 w-7 animate-spin text-cyan-400" />
            <p className="mt-3 text-sm text-slate-400">Loading assigned loads…</p>
          </div>
        ) : (
          <section className="space-y-4">
            {visibleLoads.map((load) => (
              <DriverLoadCard
                key={load.id}
                load={load}
                selected={selectedLoadId === load.id}
                onSelect={() => setSelectedLoadId(load.id)}
                onStatus={(status) => void updateStatus(load, status)}
                onUpload={(field, file) =>
                  void uploadDocument(load, field, file)
                }
                onOpen={(reference) => void openDocument(reference)}
                onTracking={() =>
                  trackingLoadId === load.id || load.tracking_active
                    ? void stopTracking(load.id)
                    : void startTracking(load)
                }
                updating={updatingLoadId === load.id}
                uploading={uploading}
                tracking={
                  trackingLoadId === load.id || load.tracking_active === true
                }
              />
            ))}

            {visibleLoads.length === 0 && (
              <div className="rounded-3xl border border-dashed border-slate-800 bg-[#07101d] p-10 text-center">
                <CheckCircle2 className="mx-auto h-7 w-7 text-emerald-400" />
                <p className="mt-3 font-semibold text-white">
                  {filter === "active"
                    ? "No active loads assigned"
                    : "No loads in this view"}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  New dispatch assignments will appear here automatically.
                </p>
              </div>
            )}
          </section>
        )}
      </div>

      {selectedLoad && !isCompleted(selectedLoad) && (
        <MobileNextAction
          load={selectedLoad}
          updating={updatingLoadId === selectedLoad.id}
          onStatus={(status) => void updateStatus(selectedLoad, status)}
        />
      )}
    </main>
  );
}

function DriverLoadCard({
  load,
  selected,
  onSelect,
  onStatus,
  onUpload,
  onOpen,
  onTracking,
  updating,
  uploading,
  tracking,
}: {
  load: Load;
  selected: boolean;
  onSelect: () => void;
  onStatus: (status: string) => void;
  onUpload: (field: DocumentField, file: File | null) => void;
  onOpen: (reference: string) => void;
  onTracking: () => void;
  updating: boolean;
  uploading: string | null;
  tracking: boolean;
}) {
  const next = nextStatus(load.status);

  return (
    <article
      className={`overflow-hidden rounded-3xl border bg-[#07101d] transition ${
        selected
          ? "border-cyan-500/50 shadow-[0_0_28px_rgba(22,191,255,0.1)]"
          : "border-slate-800"
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        className="flex w-full items-start justify-between gap-4 p-5 text-left sm:p-6"
        aria-expanded={selected}
      >
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold text-cyan-300 sm:text-2xl">
              {loadLabel(load)}
            </h2>
            <StatusBadge status={load.status} />
          </div>
          <p className="mt-2 truncate text-sm font-semibold text-white">
            {load.pickup || "Pickup not set"}
            <span className="mx-2 text-slate-600">→</span>
            {load.dropoff || "Delivery not set"}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            {load.broker_name || "Broker not listed"}
            {load.truck_number ? ` · Truck ${load.truck_number}` : ""}
          </p>
        </div>
        {selected ? (
          <ChevronUp className="mt-1 h-5 w-5 shrink-0 text-cyan-400" />
        ) : (
          <ChevronDown className="mt-1 h-5 w-5 shrink-0 text-slate-500" />
        )}
      </button>

      {selected && (
        <div className="border-t border-slate-800 px-5 pb-6 pt-5 sm:px-6">
          <StatusTimeline status={load.status} />

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <LocationCard label="Pickup" address={load.pickup} />
            <LocationCard label="Delivery" address={load.dropoff} delivery />
          </div>

          <div className="mt-3 grid grid-cols-3 gap-3">
            <InfoCard label="Truck" value={load.truck_number || "Not set"} icon={Truck} />
            <InfoCard
              label="Miles"
              value={
                load.loaded_miles == null
                  ? "Not set"
                  : Number(load.loaded_miles).toLocaleString()
              }
              icon={Route}
            />
            <InfoCard
              label="Pay"
              value={formatCurrency(load.driver_pay)}
              icon={CircleDollarSign}
              highlight
            />
          </div>

          {next && (
            <button
              type="button"
              disabled={updating}
              onClick={() => onStatus(next)}
              className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#1e6bff] to-[#00a3ff] px-4 py-4 text-base font-bold text-white shadow-[0_0_20px_rgba(22,191,255,0.2)] disabled:cursor-wait disabled:opacity-60"
            >
              {updating ? (
                <LoaderCircle className="h-5 w-5 animate-spin" />
              ) : (
                <CheckCircle2 className="h-5 w-5" />
              )}
              {updating ? "Updating load…" : nextActionLabel(next)}
            </button>
          )}

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <DocumentControl
              title="Bill of Lading"
              reference={load.bol_url}
              busy={uploading === `${load.id}:bol_url`}
              onOpen={onOpen}
              onUpload={(file) => onUpload("bol_url", file)}
            />
            <DocumentControl
              title="Proof of Delivery"
              reference={load.pod_url}
              busy={uploading === `${load.id}:pod_url`}
              onOpen={onOpen}
              onUpload={(file) => onUpload("pod_url", file)}
              green
            />
          </div>

          <button
            type="button"
            onClick={onTracking}
            disabled={isCompleted(load)}
            aria-pressed={tracking}
            className={`mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border py-4 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${
              tracking
                ? "border-red-500/40 bg-red-500/10 text-red-300"
                : "border-cyan-500/40 bg-cyan-500/10 text-cyan-300"
            }`}
          >
            {tracking ? <Radio className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
            {tracking ? "Stop live location" : "Share live location"}
          </button>

          {load.status === "Delivered" && !load.pod_url && (
            <p className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-center text-xs font-semibold text-amber-200">
              Delivery is complete, but the POD still needs to be uploaded.
            </p>
          )}
        </div>
      )}
    </article>
  );
}

function StatusTimeline({ status }: { status?: string | null }) {
  const current = workflowIndex(status);
  return (
    <div className="grid grid-cols-4 gap-1">
      {workflow.map((step, index) => (
        <div key={step} className="min-w-0">
          <div
            className={`h-1.5 rounded-full ${
              index <= current ? "bg-cyan-400" : "bg-slate-800"
            }`}
          />
          <p
            className={`mt-2 truncate text-[10px] font-semibold ${
              index <= current ? "text-cyan-300" : "text-slate-600"
            }`}
          >
            {step === "Arrived at Pickup" ? "Arrived" : step}
          </p>
        </div>
      ))}
    </div>
  );
}

function LocationCard({
  label,
  address,
  delivery = false,
}: {
  label: string;
  address?: string | null;
  delivery?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#0b1626] p-4">
      <p
        className={`text-xs font-bold uppercase tracking-[0.22em] ${
          delivery ? "text-emerald-400" : "text-cyan-400"
        }`}
      >
        {label}
      </p>
      <p className="mt-3 min-h-10 text-sm font-semibold leading-5 text-white">
        {address || `${label} address not set`}
      </p>
      {address && (
        <a
          href={`https://maps.apple.com/?q=${encodeURIComponent(address)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-cyan-300"
        >
          <Navigation className="h-3.5 w-3.5" /> Open navigation
        </a>
      )}
    </div>
  );
}

function InfoCard({
  label,
  value,
  icon: Icon,
  highlight = false,
}: {
  label: string;
  value: string;
  icon: typeof Truck;
  highlight?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-800 bg-[#0b1626] p-3 sm:p-4">
      <Icon className="h-4 w-4 text-slate-500" />
      <p className="mt-2 text-[10px] uppercase tracking-wide text-slate-500">
        {label}
      </p>
      <p
        className={`mt-1 truncate text-sm font-bold ${
          highlight ? "text-amber-300" : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function DocumentControl({
  title,
  reference,
  busy,
  onOpen,
  onUpload,
  green = false,
}: {
  title: string;
  reference?: string | null;
  busy: boolean;
  onOpen: (reference: string) => void;
  onUpload: (file: File | null) => void;
  green?: boolean;
}) {
  const color = green
    ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
    : "border-indigo-500/25 bg-indigo-500/10 text-indigo-300";

  function handleFile(event: ChangeEvent<HTMLInputElement>) {
    onUpload(event.target.files?.[0] ?? null);
    event.target.value = "";
  }

  return (
    <div className={`rounded-2xl border p-4 ${color}`}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4" />
          <p className="text-sm font-bold">{title}</p>
        </div>
        <span className="text-[10px] font-bold uppercase tracking-wide">
          {reference ? "On file" : "Needed"}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2">
        {reference ? (
          <button
            type="button"
            onClick={() => onOpen(reference)}
            className="rounded-xl border border-current/20 px-3 py-2 text-center text-xs font-bold"
          >
            View
          </button>
        ) : (
          <div className="rounded-xl border border-current/10 px-3 py-2 text-center text-xs opacity-60">
            No file
          </div>
        )}

        <label className="cursor-pointer rounded-xl border border-current/20 px-3 py-2 text-center text-xs font-bold">
          {busy ? (
            <span className="inline-flex items-center gap-1">
              <LoaderCircle className="h-3 w-3 animate-spin" /> Uploading
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <Upload className="h-3 w-3" /> {reference ? "Replace" : "Upload"}
            </span>
          )}
          <input
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            capture="environment"
            disabled={busy}
            onChange={handleFile}
            className="hidden"
          />
        </label>
      </div>
    </div>
  );
}

function MobileNextAction({
  load,
  updating,
  onStatus,
}: {
  load: Load;
  updating: boolean;
  onStatus: (status: string) => void;
}) {
  const next = nextStatus(load.status);
  if (!next) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-800 bg-[#020617]/95 p-3 backdrop-blur-xl sm:hidden">
      <button
        type="button"
        disabled={updating}
        onClick={() => onStatus(next)}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#1e6bff] to-[#00a3ff] px-4 py-4 text-sm font-bold text-white disabled:opacity-60"
      >
        {updating && <LoaderCircle className="h-4 w-4 animate-spin" />}
        {updating ? "Updating load…" : nextActionLabel(next)}
      </button>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  warn = false,
}: {
  label: string;
  value: number;
  warn?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#07101d] p-4 text-center">
      <p
        className={`text-2xl font-bold ${
          warn && value > 0 ? "text-amber-300" : "text-white"
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
        {label}
      </p>
    </div>
  );
}

function StatusBadge({ status }: { status?: string | null }) {
  const delivered = status === "Delivered";
  return (
    <span
      className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
        delivered
          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
          : "border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
      }`}
    >
      {status || "Assigned"}
    </span>
  );
}

function validateDocument(file: File) {
  if (!allowedDocumentTypes.has(file.type)) {
    return "Documents must be PDF, JPG, PNG, or WebP files.";
  }
  if (file.size > maxDocumentBytes) {
    return "Documents must be 10 MB or smaller.";
  }
  return "";
}

function workflowIndex(status?: string | null) {
  const index = workflow.indexOf(status || "Assigned");
  return index >= 0 ? index : 0;
}

function nextStatus(status?: string | null) {
  return workflow[workflowIndex(status) + 1] ?? null;
}

function nextActionLabel(status: string) {
  if (status === "Arrived at Pickup") return "Mark arrived at pickup";
  if (status === "In Transit") return "Start trip";
  return "Complete delivery";
}

function isCompleted(load: Load) {
  return load.status === "Delivered" || load.status === "Cancelled";
}

function loadLabel(load: Load) {
  return load.broker_load_id || load.tracon_id || load.id.slice(0, 6);
}

function formatCurrency(value?: number | null) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value ?? 0));
}
