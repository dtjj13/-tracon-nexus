"use client";

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";

import { supabase } from "@/app/lib/supabase";
import type { ComplianceEntityType } from "@/app/lib/complianceDocuments";

type DriverOption = {
  id: string;
  name: string;
};

type TruckOption = {
  id: string;
  truck_number: string;
};

const driverDocumentTypes = [
  "Commercial driver license",
  "Medical certificate",
  "Motor vehicle record",
  "Drug and alcohol program",
  "Other driver document",
];

const truckDocumentTypes = [
  "Vehicle registration",
  "Insurance document",
  "Annual inspection",
  "Maintenance record",
  "Other truck document",
];

export default function ComplianceDocumentForm() {
  const [entityType, setEntityType] =
    useState<ComplianceEntityType>("driver");

  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [trucks, setTrucks] = useState<TruckOption[]>([]);

  const [entityId, setEntityId] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [documentNumber, setDocumentNumber] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [expirationDate, setExpirationDate] = useState("");
  const [notes, setNotes] = useState("");
const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadOptions() {
      setLoadingOptions(true);
      setError("");

      const [driversResult, trucksResult] = await Promise.all([
        supabase
          .from("drivers")
          .select("id,name")
          .order("name", { ascending: true }),

        supabase
          .from("trucks")
          .select("id,truck_number")
          .order("truck_number", { ascending: true }),
      ]);

      if (driversResult.error) {
        setError(driversResult.error.message);
      } else {
        setDrivers((driversResult.data ?? []) as DriverOption[]);
      }

      if (trucksResult.error) {
        setError((current) =>
          current
            ? `${current} ${trucksResult.error.message}`
            : trucksResult.error.message
        );
      } else {
        setTrucks((trucksResult.data ?? []) as TruckOption[]);
      }

      setLoadingOptions(false);
    }

    loadOptions();
  }, []);

  const entityOptions = useMemo(() => {
    if (entityType === "driver") {
      return drivers.map((driver) => ({
        id: driver.id,
        label: driver.name,
      }));
    }

    return trucks.map((truck) => ({
      id: truck.id,
      label: `Truck ${truck.truck_number}`,
    }));
  }, [drivers, entityType, trucks]);

  const documentTypes =
    entityType === "driver"
      ? driverDocumentTypes
      : truckDocumentTypes;

  function changeEntityType(value: ComplianceEntityType) {
    setEntityType(value);
    setEntityId("");
    setDocumentType("");
    setError("");
  }

  async function saveDocument(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();

  const selectedEntity = entityOptions.find(
    (item) => item.id === entityId
  );

  if (!selectedEntity) {
    setError(
      entityType === "driver" ? "Choose a driver." : "Choose a truck."
    );
    return;
  }

  if (!documentType) {
    setError("Choose a document type.");
    return;
  }

  if (!documentFile) {
    setError("Choose a document to upload.");
    return;
  }

  if (documentFile.size > 10 * 1024 * 1024) {
    setError("The document must be 10 MB or smaller.");
    return;
  }

  setSaving(true);
  setError("");

  const safeFileName = documentFile.name.replace(
    /[^a-zA-Z0-9._-]/g,
    "-"
  );

  const filePath =
    `compliance/${entityType}/${selectedEntity.id}/` +
    `${Date.now()}-${safeFileName}`;

  const { error: uploadError } = await supabase.storage
    .from("documents")
    .upload(filePath, documentFile, {
      cacheControl: "3600",
      upsert: false,
    });

  if (uploadError) {
    setError(uploadError.message);
    setSaving(false);
    return;
  }

  const { data: publicData } = supabase.storage
    .from("documents")
    .getPublicUrl(filePath);

  const { error: saveError } = await supabase
    .from("compliance_documents")
    .insert({
      entity_type: entityType,
      entity_id: selectedEntity.id,
      entity_name: selectedEntity.label,
      document_type: documentType,
      document_number: documentNumber.trim() || null,
      issue_date: issueDate || null,
      expiration_date: expirationDate || null,
      notes: notes.trim() || null,
      file_name: documentFile.name,
      file_path: filePath,
      file_url: publicData.publicUrl,
    });

  if (saveError) {
    await supabase.storage
      .from("documents")
      .remove([filePath]);

    setError(saveError.message);
    setSaving(false);
    return;
  }

  setEntityId("");
  setDocumentType("");
  setDocumentNumber("");
  setIssueDate("");
  setExpirationDate("");
  setNotes("");
  setDocumentFile(null);

  window.location.reload();
}

  return (
    <section className="rounded-3xl border border-cyan-500/20 bg-[#07101A] p-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-400">
          Add compliance record
        </p>

        <h2 className="mt-2 text-2xl font-bold text-white">
          Record a driver or truck document
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-400">
          Save document details and expiration dates so TRACON can
          identify missing, expired, and upcoming compliance items.
        </p>
      </div>

      <form onSubmit={saveDocument} className="mt-6 space-y-5">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Record category
            </span>

            <select
              value={entityType}
              onChange={(event) =>
                changeEntityType(
                  event.target.value as ComplianceEntityType
                )
              }
              className="w-full rounded-xl border border-slate-700 bg-[#050D16] px-4 py-3 text-white outline-none transition focus:border-cyan-500"
            >
              <option value="driver">Driver document</option>
              <option value="truck">Truck document</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              {entityType === "driver" ? "Driver" : "Truck"}
            </span>

            <select
              value={entityId}
              onChange={(event) => setEntityId(event.target.value)}
              disabled={loadingOptions}
              className="w-full rounded-xl border border-slate-700 bg-[#050D16] px-4 py-3 text-white outline-none transition focus:border-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <option value="">
                {loadingOptions
                  ? "Loading..."
                  : entityType === "driver"
                    ? "Choose a driver"
                    : "Choose a truck"}
              </option>

              {entityOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Document type
            </span>

            <select
              value={documentType}
              onChange={(event) =>
                setDocumentType(event.target.value)
              }
              className="w-full rounded-xl border border-slate-700 bg-[#050D16] px-4 py-3 text-white outline-none transition focus:border-cyan-500"
            >
              <option value="">Choose a document type</option>

              {documentTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Document number
            </span>

            <input
              type="text"
              value={documentNumber}
              onChange={(event) =>
                setDocumentNumber(event.target.value)
              }
              placeholder="Optional"
              className="w-full rounded-xl border border-slate-700 bg-[#050D16] px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-cyan-500"
            />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Issue date
            </span>

            <input
              type="date"
              value={issueDate}
              onChange={(event) => setIssueDate(event.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-[#050D16] px-4 py-3 text-white outline-none focus:border-cyan-500"
            />
          </label>

          <label className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Expiration date
            </span>

            <input
              type="date"
              value={expirationDate}
              onChange={(event) =>
                setExpirationDate(event.target.value)
              }
              className="w-full rounded-xl border border-slate-700 bg-[#050D16] px-4 py-3 text-white outline-none focus:border-cyan-500"
            />
          </label>
        </div>
<label className="block space-y-2 lg:col-span-2">
  <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
    Document file
  </span>

  <input
    type="file"
    accept=".pdf,.png,.jpg,.jpeg,.webp"
    onChange={(event) =>
      setDocumentFile(event.target.files?.[0] ?? null)
    }
    className="w-full rounded-2xl border border-dashed border-cyan-500/40 bg-[#07101A] px-4 py-4 text-sm text-slate-300 file:mr-4 file:rounded-xl file:border-0 file:bg-cyan-500/10 file:px-4 file:py-2 file:font-semibold file:text-cyan-300 hover:file:bg-cyan-500/20"
  />

  <p className="text-xs text-slate-500">
    PDF, PNG, JPG, or WebP. Maximum 10 MB.
  </p>
</label>
        <label className="block space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Notes
          </span>

          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Optional notes about this document"
            rows={3}
            className="w-full resize-none rounded-xl border border-slate-700 bg-[#050D16] px-4 py-3 text-white outline-none placeholder:text-slate-600 focus:border-cyan-500"
          />
        </label>

        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={saving || loadingOptions}
          className="rounded-xl bg-cyan-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving record..." : "Save compliance record"}
        </button>
      </form>
    </section>
  );
}