"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/app/lib/supabase";
import {
  type ComplianceDocument,
  getComplianceStatus,
} from "@/app/lib/complianceDocuments";

export default function ComplianceCenter() {
  const [documents, setDocuments] = useState<ComplianceDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadDocuments() {
      setLoading(true);
      setError("");

      const { data, error: loadError } = await supabase
        .from("compliance_documents")
        .select("*")
        .order("created_at", { ascending: false });

      if (loadError) {
        setError(loadError.message);
        setDocuments([]);
      } else {
        setDocuments((data ?? []) as ComplianceDocument[]);
      }

      setLoading(false);
    }

    loadDocuments();
  }, []);

  const totals = useMemo(() => {
    return documents.reduce(
      (result, document) => {
        const status = getComplianceStatus(document.expiration_date);
        result[status] += 1;
        return result;
      },
      {
        current: 0,
        expiring: 0,
        expired: 0,
        missing: 0,
      }
    );
  }, [documents]);

  if (loading) {
    return (
      <p className="text-sm text-slate-400">
        Loading compliance records...
      </p>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
        {error}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Summary
        label="Current"
        value={totals.current}
        color="text-green-400"
      />

      <Summary
        label="Expiring soon"
        value={totals.expiring}
        color="text-yellow-400"
      />

      <Summary
        label="Expired"
        value={totals.expired}
        color="text-red-400"
      />

      <Summary
        label="Missing date"
        value={totals.missing}
        color="text-slate-300"
      />
    </div>
  );
}

function Summary({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#07101A] p-4">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>

      <p className={`mt-2 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}