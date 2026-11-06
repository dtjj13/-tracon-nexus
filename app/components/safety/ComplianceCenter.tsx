"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileQuestion,
  RefreshCw,
  Search,
  ShieldAlert,
} from "lucide-react";
import { supabase } from "@/app/lib/supabase";
import {
  formatComplianceDate,
  getComplianceStatus,
  getDaysUntilExpiration,
  type ComplianceDocument,
  type ComplianceEntityType,
  type ComplianceStatus,
} from "@/app/lib/complianceDocuments";

type DvirFailure = {
  id: string;
  truck_id: string | null;
  category: string | null;
  question: string | null;
  notes: string | null;
  photo_url: string | null;
  created_at: string | null;
};

type TruckReference = {
  id: string;
  truck_number: string;
};

type StatusFilter = ComplianceStatus | "all";
type EntityFilter = ComplianceEntityType | "all";

const statusRank: Record<ComplianceStatus, number> = {
  expired: 0,
  expiring: 1,
  missing: 2,
  current: 3,
};

const statusLabels: Record<ComplianceStatus, string> = {
  expired: "Expired",
  expiring: "Expiring soon",
  missing: "Missing date",
  current: "Current",
};

const statusClasses: Record<ComplianceStatus, string> = {
  expired: "border-red-500/30 bg-red-500/10 text-red-300",
  expiring: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  missing: "border-slate-600 bg-slate-800/70 text-slate-300",
  current: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
};

export default function ComplianceCenter() {
  const [documents, setDocuments] = useState<ComplianceDocument[]>([]);
  const [dvirFailures, setDvirFailures] = useState<DvirFailure[]>([]);
  const [failureCount, setFailureCount] = useState(0);
  const [truckNumbers, setTruckNumbers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [inspectionError, setInspectionError] = useState("");
  const [documentError, setDocumentError] = useState("");
  const [openingDocument, setOpeningDocument] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [entityFilter, setEntityFilter] = useState<EntityFilter>("all");

  const loadSafetyData = useCallback(async () => {
    setLoading(true);
    setError("");
    setInspectionError("");

    const [documentsResult, failuresResult, trucksResult] = await Promise.all([
      supabase
        .from("compliance_documents")
        .select("*")
        .order("created_at", { ascending: false }),
      supabase
        .from("dvirs")
        .select(
          "id,truck_id,category,question,notes,photo_url,created_at",
          { count: "exact" }
        )
        .eq("status", "Fail")
        .order("created_at", { ascending: false })
        .limit(12),
      supabase.from("trucks").select("id,truck_number"),
    ]);

    if (documentsResult.error) {
      setError(documentsResult.error.message);
      setDocuments([]);
    } else {
      setDocuments((documentsResult.data ?? []) as ComplianceDocument[]);
    }

    if (failuresResult.error) {
      setInspectionError(failuresResult.error.message);
      setDvirFailures([]);
      setFailureCount(0);
    } else {
      setDvirFailures((failuresResult.data ?? []) as DvirFailure[]);
      setFailureCount(failuresResult.count ?? failuresResult.data?.length ?? 0);
    }

    if (trucksResult.error) {
      setInspectionError((current) =>
        current
          ? `${current} ${trucksResult.error.message}`
          : trucksResult.error.message
      );
    } else {
      const references = (trucksResult.data ?? []) as TruckReference[];
      setTruckNumbers(
        Object.fromEntries(
          references.map((truck) => [truck.id, truck.truck_number])
        )
      );
    }

    setLoading(false);
  }, []);

  /* eslint-disable react-hooks/set-state-in-effect -- Initial async safety-data hydration. */
  useEffect(() => {
    void loadSafetyData();

    const refresh = () => void loadSafetyData();
    window.addEventListener("tracon:compliance-updated", refresh);

    return () =>
      window.removeEventListener("tracon:compliance-updated", refresh);
  }, [loadSafetyData]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const totals = useMemo(() => {
    return documents.reduce(
      (result, document) => {
        result[getComplianceStatus(document.expiration_date)] += 1;
        return result;
      },
      { current: 0, expiring: 0, expired: 0, missing: 0 }
    );
  }, [documents]);

  const actionItems = useMemo(() => {
    return documents
      .filter(
        (document) =>
          getComplianceStatus(document.expiration_date) !== "current"
      )
      .sort((left, right) => {
        const leftStatus = getComplianceStatus(left.expiration_date);
        const rightStatus = getComplianceStatus(right.expiration_date);
        const rankDifference = statusRank[leftStatus] - statusRank[rightStatus];

        if (rankDifference !== 0) return rankDifference;
        return (left.expiration_date ?? "").localeCompare(
          right.expiration_date ?? ""
        );
      });
  }, [documents]);

  const filteredDocuments = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return documents.filter((document) => {
      const status = getComplianceStatus(document.expiration_date);
      const matchesStatus =
        statusFilter === "all" || status === statusFilter;
      const matchesEntity =
        entityFilter === "all" || document.entity_type === entityFilter;
      const matchesQuery =
        !normalizedQuery ||
        [
          document.entity_name,
          document.document_type,
          document.document_number,
          document.file_name,
        ].some((value) => value?.toLowerCase().includes(normalizedQuery));

      return matchesStatus && matchesEntity && matchesQuery;
    });
  }, [documents, entityFilter, query, statusFilter]);

  async function openDocument(document: ComplianceDocument) {
    setDocumentError("");
    setOpeningDocument(document.id);

    const previewWindow = window.open("", "_blank");
    if (previewWindow) {
      previewWindow.opener = null;
      previewWindow.document.title = "Opening compliance document…";
    }

    let target = document.file_url;

    if (document.file_path) {
      const { data, error: signedUrlError } = await supabase.storage
        .from("documents")
        .createSignedUrl(document.file_path, 10 * 60);

      if (!signedUrlError && data?.signedUrl) {
        target = data.signedUrl;
      } else if (!target) {
        setDocumentError(
          signedUrlError?.message ?? "This document could not be opened."
        );
        previewWindow?.close();
        setOpeningDocument(null);
        return;
      }
    }

    if (!target) {
      setDocumentError("No file is attached to this compliance record.");
      previewWindow?.close();
      setOpeningDocument(null);
      return;
    }

    if (previewWindow) {
      previewWindow.location.href = target;
    } else {
      window.location.href = target;
    }
    setOpeningDocument(null);
  }

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-800 bg-[#07101d] p-8 text-center">
        <RefreshCw className="mx-auto h-6 w-6 animate-spin text-cyan-400" />
        <p className="mt-3 text-sm text-slate-400">Loading safety records…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5">
        <p className="font-semibold text-red-300">Safety records unavailable</p>
        <p className="mt-1 text-sm text-red-200/80">{error}</p>
        <button
          type="button"
          onClick={() => void loadSafetyData()}
          className="mt-4 rounded-xl border border-red-400/30 px-4 py-2 text-sm font-semibold text-red-200 hover:bg-red-500/10"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section aria-label="Safety summary" className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Summary label="Current" value={totals.current} tone="green" icon={CheckCircle2} />
        <Summary label="Expiring soon" value={totals.expiring} tone="yellow" icon={Clock3} />
        <Summary label="Expired" value={totals.expired} tone="red" icon={AlertTriangle} />
        <Summary label="Missing date" value={totals.missing} tone="slate" icon={FileQuestion} />
        <Summary label="Failed DVIR items" value={failureCount} tone="red" icon={ShieldAlert} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="rounded-3xl border border-slate-800 bg-[#07101d] p-5 sm:p-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">Priority queue</p>
              <h2 className="mt-2 text-xl font-bold">Documents needing attention</h2>
            </div>
            <span className="w-fit rounded-full border border-slate-700 px-3 py-1 text-xs font-semibold text-slate-300">
              {actionItems.length} open
            </span>
          </div>

          {actionItems.length === 0 ? (
            <EmptyState
              title="No document alerts"
              message="Every saved document with an expiration date is currently in good standing."
            />
          ) : (
            <div className="mt-5 divide-y divide-slate-800">
              {actionItems.slice(0, 8).map((document) => (
                <DocumentRow
                  key={document.id}
                  document={document}
                  opening={openingDocument === document.id}
                  onOpen={openDocument}
                  compact
                />
              ))}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-slate-800 bg-[#07101d] p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">Inspection follow-up</p>
              <h2 className="mt-2 text-xl font-bold">Recent failed DVIR items</h2>
            </div>
            <button
              type="button"
              onClick={() => void loadSafetyData()}
              aria-label="Refresh safety records"
              className="rounded-xl border border-slate-700 p-2.5 text-slate-400 transition hover:border-cyan-500/40 hover:text-cyan-300"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          {inspectionError ? (
            <p className="mt-5 rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-200">
              DVIR follow-up could not be loaded: {inspectionError}
            </p>
          ) : dvirFailures.length === 0 ? (
            <EmptyState
              title="No failed inspection items"
              message="Failed DVIR answers will appear here for safety follow-up."
            />
          ) : (
            <div className="mt-5 space-y-3">
              {dvirFailures.slice(0, 5).map((failure) => (
                <article key={failure.id} className="rounded-2xl border border-red-500/20 bg-red-500/[0.06] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="rounded-full bg-red-500/10 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-red-300">
                      Failed
                    </span>
                    <span className="text-xs text-slate-500">
                      {failure.created_at
                        ? new Date(failure.created_at).toLocaleDateString()
                        : "Date unavailable"}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-100">
                    {failure.question || "Inspection item"}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {failure.truck_id
                      ? `Truck ${truckNumbers[failure.truck_id] ?? "unmatched"}`
                      : "Truck not linked"}
                    {failure.category ? ` · ${failure.category}` : ""}
                  </p>
                  {failure.notes && (
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">
                      {failure.notes}
                    </p>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-slate-800 bg-[#07101d] p-5 sm:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">Compliance library</p>
            <h2 className="mt-2 text-xl font-bold">All driver and truck documents</h2>
            <p className="mt-1 text-sm text-slate-400">
              Search records or narrow the list by status and category.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:w-[680px]">
            <label className="relative sm:col-span-1">
              <span className="sr-only">Search compliance documents</span>
              <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-500" />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search records"
                className="w-full rounded-xl border border-slate-700 bg-[#050d16] py-3 pl-9 pr-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-cyan-500"
              />
            </label>

            <label>
              <span className="sr-only">Filter by status</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
                className="w-full rounded-xl border border-slate-700 bg-[#050d16] px-3 py-3 text-sm text-white outline-none focus:border-cyan-500"
              >
                <option value="all">All statuses</option>
                <option value="current">Current</option>
                <option value="expiring">Expiring soon</option>
                <option value="expired">Expired</option>
                <option value="missing">Missing date</option>
              </select>
            </label>

            <label>
              <span className="sr-only">Filter by record category</span>
              <select
                value={entityFilter}
                onChange={(event) => setEntityFilter(event.target.value as EntityFilter)}
                className="w-full rounded-xl border border-slate-700 bg-[#050d16] px-3 py-3 text-sm text-white outline-none focus:border-cyan-500"
              >
                <option value="all">Drivers and trucks</option>
                <option value="driver">Driver records</option>
                <option value="truck">Truck records</option>
              </select>
            </label>
          </div>
        </div>

        {documentError && (
          <p role="alert" className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
            {documentError}
          </p>
        )}

        {filteredDocuments.length === 0 ? (
          <EmptyState
            title={documents.length ? "No matching records" : "No compliance records yet"}
            message={documents.length ? "Try changing the search or filters." : "Use the form below to add the first driver or truck document."}
          />
        ) : (
          <div className="mt-5 divide-y divide-slate-800">
            {filteredDocuments.map((document) => (
              <DocumentRow
                key={document.id}
                document={document}
                opening={openingDocument === document.id}
                onOpen={openDocument}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function Summary({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: number;
  tone: "green" | "yellow" | "red" | "slate";
  icon: typeof CheckCircle2;
}) {
  const tones = {
    green: "border-emerald-500/20 bg-emerald-500/[0.06] text-emerald-400",
    yellow: "border-amber-500/20 bg-amber-500/[0.06] text-amber-400",
    red: "border-red-500/20 bg-red-500/[0.06] text-red-400",
    slate: "border-slate-800 bg-[#07101d] text-slate-300",
  };

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-slate-500">{label}</p>
        <Icon className="h-4 w-4" />
      </div>
      <p className="mt-3 text-2xl font-bold text-white">{value}</p>
    </div>
  );
}

function DocumentRow({
  document,
  opening,
  onOpen,
  compact = false,
}: {
  document: ComplianceDocument;
  opening: boolean;
  onOpen: (document: ComplianceDocument) => Promise<void>;
  compact?: boolean;
}) {
  const status = getComplianceStatus(document.expiration_date);
  const days = getDaysUntilExpiration(document.expiration_date);
  const timing =
    days === null
      ? "Add an expiration date"
      : days < 0
        ? `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} overdue`
        : days === 0
          ? "Expires today"
          : `${days} day${days === 1 ? "" : "s"} remaining`;

  return (
    <article className={`flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between ${compact ? "first:pt-0 last:pb-0" : ""}`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-semibold text-slate-100">{document.entity_name}</p>
          <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            {document.entity_type}
          </span>
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusClasses[status]}`}>
            {statusLabels[status]}
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-300">{document.document_type}</p>
        <p className="mt-1 text-xs text-slate-500">
          {formatComplianceDate(document.expiration_date)} · {timing}
          {document.document_number ? ` · #${document.document_number}` : ""}
        </p>
      </div>

      <button
        type="button"
        onClick={() => void onOpen(document)}
        disabled={opening}
        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-slate-700 bg-[#0b1626] px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-cyan-500/40 hover:text-cyan-300 disabled:cursor-wait disabled:opacity-60"
      >
        {opening ? "Opening…" : "View document"}
        {!opening && <ExternalLink className="h-3.5 w-3.5" />}
      </button>
    </article>
  );
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="mt-5 rounded-2xl border border-dashed border-slate-700 p-6 text-center">
      <CheckCircle2 className="mx-auto h-6 w-6 text-slate-600" />
      <p className="mt-2 text-sm font-semibold text-slate-300">{title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{message}</p>
    </div>
  );
}
