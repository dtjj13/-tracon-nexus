"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BrainCircuit, Database, Route } from "lucide-react";
import Navbar from "../components/Navbar";
import LoadDecisionCard from "../components/dispatch/LoadDecisionCard";
import RoundTripDecisionPanel from "../components/dispatch/RoundTripDecisionPanel";
import {
  evaluateLoadBidGuidance,
  evaluateLoadDecision,
  type LoadMode,
} from "../lib/loadDecision";
import {
  isLoadDecisionDraft,
  LOAD_DECISION_DRAFT_KEY,
  type LoadDecisionDraft,
} from "../lib/loadDecisionDraft";

export default function LoadDecisionPage() {
  const [draft, setDraft] = useState<LoadDecisionDraft | null>(null);
  const [ready, setReady] = useState(false);
const [targetMarginPercent, setTargetMarginPercent] = useState(15);
const [loadMode, setLoadMode] = useState<LoadMode>("full");
  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(LOAD_DECISION_DRAFT_KEY);
      if (!stored) return;

      const parsed: unknown = JSON.parse(stored);
      if (isLoadDecisionDraft(parsed)) setDraft(parsed);
    } catch (error) {
      console.error("Unable to restore load decision draft:", error);
    } finally {
      setReady(true);
    }
  }, []);

  const decisionOptions = useMemo(
  () => ({
    targetMarginPercent,
    loadMode,
    enforceRevenuePerMilePolicy: loadMode === "full",
  }),
  [loadMode, targetMarginPercent]
);

const decision = useMemo(
  () =>
    draft
      ? evaluateLoadDecision(draft.input, decisionOptions)
      : null,
  [draft, decisionOptions]
);

const bidGuidance = useMemo(
  () =>
    draft
      ? evaluateLoadBidGuidance(
          draft.input,
          draft.driverPayRule,
          decisionOptions
        )
      : null,
  [draft, decisionOptions]
);

  return (
    <main className="min-h-screen bg-[#020617] p-3 text-white sm:p-6">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <Navbar />

        <section className="overflow-hidden rounded-3xl border border-cyan-500/20 bg-[#07111f] shadow-[0_24px_70px_rgba(0,0,0,0.35)]">
          <div className="flex flex-col gap-5 border-b border-slate-800 p-5 sm:p-7 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-300">
                <BrainCircuit className="h-6 w-6" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-300">
                  Decision intelligence
                </p>
                <h1 className="mt-2 text-2xl font-bold sm:text-3xl">
                  Load Decision Engine
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                  Review outbound profit, protect the return trip, and set a
                  negotiation floor before booking.
                </p>
              </div>
            </div>
            <Link
              href="/dispatch"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-[#0a1626] px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-cyan-400/40 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Dispatch
            </Link>
          </div>

          {ready && draft ? (
            <div className="space-y-5 p-4 sm:p-6">
              <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                <div className="rounded-2xl border border-slate-800 bg-[#050e1a] p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                    Current load
                  </p>
                  <p className="mt-2 break-words text-sm font-semibold text-white">
                    {draft.pickup || "Pickup not entered"}{" "}
                    <span className="text-cyan-400">→</span>{" "}
                    {draft.dropoff || "Dropoff not entered"}
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    Analysis captured {formatSavedTime(draft.savedAt)}
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <ContextStat
                    label="Revenue"
                    value={formatMoney(draft.input.revenue)}
                  />
                  <ContextStat
                    label="Loaded miles"
                    value={`${formatNumber(draft.input.loadedMiles)} mi`}
                  />
                </div>
              </div>
<section className="rounded-3xl border border-slate-800 bg-[#050e1a] p-5 sm:p-6">
  <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-300">
        Booking targets
      </p>

      <h2 className="mt-2 text-xl font-semibold text-white">
        Set how TRACON should judge this load
      </h2>

      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
        Use Full load for normal freight. Use Add-on / partial when
        the truck is already moving and this load only needs to cover
        its additional costs.
      </p>
    </div>

    <div className="grid gap-4 sm:grid-cols-2 lg:min-w-[540px]">
      <label className="block">
        <span className="text-xs font-semibold text-slate-300">
          Target profit margin
        </span>

        <div className="mt-2 flex items-center rounded-xl border border-slate-700 bg-[#081525] px-3">
          <input
            type="number"
            min="0"
            max="80"
            step="1"
            value={targetMarginPercent}
            onChange={(event) => {
              const value = Number(event.target.value);

              setTargetMarginPercent(
                Number.isFinite(value)
                  ? Math.min(Math.max(value, 0), 80)
                  : 0
              );
            }}
            className="min-w-0 flex-1 bg-transparent py-3 text-sm font-semibold text-white outline-none"
          />

          <span className="text-sm text-slate-400">%</span>
        </div>
      </label>

      <div>
        <span className="text-xs font-semibold text-slate-300">
          Load type
        </span>

        <div className="mt-2 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setLoadMode("full")}
            className={`rounded-xl border px-3 py-3 text-xs font-semibold transition ${
              loadMode === "full"
                ? "border-cyan-400/50 bg-cyan-400/15 text-cyan-200"
                : "border-slate-700 bg-[#081525] text-slate-400 hover:text-white"
            }`}
          >
            Full load
          </button>

          <button
            type="button"
            onClick={() => setLoadMode("partial")}
            className={`rounded-xl border px-3 py-3 text-xs font-semibold transition ${
              loadMode === "partial"
                ? "border-cyan-400/50 bg-cyan-400/15 text-cyan-200"
                : "border-slate-700 bg-[#081525] text-slate-400 hover:text-white"
            }`}
          >
            Add-on / partial
          </button>
        </div>
      </div>
    </div>
  </div>

  <p className="mt-4 rounded-xl border border-slate-800 bg-[#081525] px-4 py-3 text-xs leading-5 text-slate-400">
    {loadMode === "partial"
      ? "Partial mode relaxes the normal revenue-per-mile rule and focuses on whether this add-on improves the trip."
      : `TRACON will protect at least a ${targetMarginPercent}% modeled profit margin and its normal revenue-per-mile policy.`}
  </p>
</section>
          <LoadDecisionCard decision={decision} bidGuidance={bidGuidance} />
          <RoundTripDecisionPanel
            outbound={draft.input}
            pickup={draft.pickup}
            dropoff={draft.dropoff}
            driverPayRule={draft.driverPayRule}
          />

              <section className="rounded-3xl border border-dashed border-cyan-400/30 bg-cyan-400/[0.04] p-5 sm:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-300">
                      <Database className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-300">
                        Future data connection
                      </p>
                      <h2 className="mt-1 text-lg font-semibold text-white">
                        Market lane rates — API connection planned
                      </h2>
                      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                        Today, the return analysis uses your company load
                        history and manual rate overrides. A future provider
                        can supply current lane-pay estimates without changing
                        the decision model.
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex w-fit rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-300">
                    Provider not connected
                  </span>
                </div>
              </section>
            </div>
          ) : ready ? (
            <div className="p-5 sm:p-7">
              <div className="flex min-h-[360px] flex-col items-center justify-center rounded-3xl border border-dashed border-slate-700 bg-[#050e1a] px-6 text-center">
                <div className="grid h-14 w-14 place-items-center rounded-2xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-300">
                  <Route className="h-7 w-7" />
                </div>
                <h2 className="mt-5 text-xl font-semibold">
                  Start with a load in Dispatch
                </h2>
                <p className="mt-2 max-w-lg text-sm leading-6 text-slate-400">
                  Enter the driver, revenue, and mileage, then use the floating
                  Load Engine button to open the full decision workspace.
                </p>
                <Link
                  href="/dispatch"
                  className="mt-6 rounded-xl bg-gradient-to-r from-[#1E6BFF] to-[#00A3FF] px-5 py-3 text-sm font-semibold text-white"
                >
                  Open Dispatch
                </Link>
              </div>
            </div>
          ) : (
            <div className="p-5 sm:p-7">
              <div className="h-[360px] animate-pulse rounded-3xl border border-slate-800 bg-[#050e1a]" />
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function ContextStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-[140px] rounded-2xl border border-slate-800 bg-[#050e1a] p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
        {label}
      </p>
      <p className="mt-2 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function formatSavedTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "recently";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
  }).format(Number(value || 0));
}
