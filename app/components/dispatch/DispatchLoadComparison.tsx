"use client";

import { useState } from "react";
import { GitCompareArrows, X } from "lucide-react";

export type ComparableDispatchLoad = {
  id: string;
  tracon_id: string;
  broker_load_id?: string;
  pickup: string;
  dropoff: string;
  driver_name?: string;
  status: string;
  rate?: number;
  loaded_miles?: number;
  deadhead_miles?: number;
  total_expenses?: number;
  net_profit?: number;
  profit?: number;
  profit_margin?: number;
};

type DispatchLoadComparisonProps = {
  loads: ComparableDispatchLoad[];
  onRemove: (loadId: string) => void;
  onClear: () => void;
};

export default function DispatchLoadComparison({
  loads,
  onRemove,
  onClear,
}: DispatchLoadComparisonProps) {
  const [open, setOpen] = useState(false);

  if (loads.length === 0) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-24 left-5 z-40 inline-flex items-center gap-3 rounded-2xl border border-violet-400/40 bg-[#111027]/95 px-4 py-3 text-left shadow-[0_16px_45px_rgba(0,0,0,0.55),0_0_28px_rgba(139,92,246,0.2)] backdrop-blur transition hover:-translate-y-0.5 hover:border-violet-300/70 sm:bottom-5"
      >
        <span className="grid h-10 w-10 place-items-center rounded-xl border border-violet-400/30 bg-violet-400/10 text-violet-300">
          <GitCompareArrows className="h-5 w-5" />
        </span>
        <span>
          <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-violet-300">
            Compare loads
          </span>
          <span className="block text-xs font-semibold text-white">
            {loads.length}/3 selected
          </span>
        </span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-black/75 p-3 backdrop-blur-sm sm:p-6">
          <section className="mx-auto max-w-6xl overflow-hidden rounded-3xl border border-violet-400/25 bg-[#060d18] shadow-2xl">
            <header className="flex flex-col gap-4 border-b border-slate-800 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-violet-300">
                  Dispatch comparison
                </p>
                <h2 className="mt-2 text-2xl font-bold text-white">
                  Compare active opportunities
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  Compare saved revenue, miles, expenses, and profit without
                  changing any load.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="grid h-11 w-11 place-items-center self-end rounded-xl border border-slate-700 text-slate-300 transition hover:border-slate-500 hover:text-white sm:self-auto"
                aria-label="Close load comparison"
              >
                <X className="h-5 w-5" />
              </button>
            </header>

            <div className="p-4 sm:p-6">
              {loads.length < 2 && (
                <div className="mb-5 rounded-2xl border border-amber-400/25 bg-amber-400/10 p-4 text-sm text-amber-200">
                  Select one more Dispatch card to begin the comparison.
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {loads.map((load) => (
                  <ComparisonCard
                    key={load.id}
                    load={load}
                    bestProfit={bestProfit(loads)}
                    comparisonCount={loads.length}
                    onRemove={() => onRemove(load.id)}
                  />
                ))}
              </div>

              <div className="mt-6 flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={onClear}
                  className="rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white"
                >
                  Clear selection
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-violet-500"
                >
                  Return to Dispatch
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </>
  );
}

function ComparisonCard({
  load,
  bestProfit,
  comparisonCount,
  onRemove,
}: {
  load: ComparableDispatchLoad;
  bestProfit: number;
  comparisonCount: number;
  onRemove: () => void;
}) {
  const revenue = amount(load.rate);
  const loadedMiles = amount(load.loaded_miles);
  const deadheadMiles = amount(load.deadhead_miles);
  const totalMiles = loadedMiles + deadheadMiles;
  const netProfit = amount(load.net_profit ?? load.profit);
  const margin =
    load.profit_margin == null
      ? revenue > 0
        ? (netProfit / revenue) * 100
        : 0
      : amount(load.profit_margin);
  const revenuePerMile = totalMiles > 0 ? revenue / totalMiles : 0;
  const isBest =
    comparisonCount > 1 &&
    loadsComparable(bestProfit, netProfit) &&
    netProfit > 0;

  return (
    <article
      className={`rounded-2xl border p-5 ${
        isBest
          ? "border-emerald-400/40 bg-emerald-400/[0.06]"
          : "border-slate-800 bg-[#091522]"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-bold text-white">
            {load.broker_load_id || load.tracon_id}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {load.status} · {load.driver_name || "Unassigned"}
          </p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs font-semibold text-slate-500 transition hover:text-red-300"
        >
          Remove
        </button>
      </div>

      {isBest && (
        <span className="mt-4 inline-flex rounded-full border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
          Best saved profit
        </span>
      )}

      <p className="mt-4 text-sm font-medium text-slate-200">
        {shortLocation(load.pickup)} → {shortLocation(load.dropoff)}
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <ComparisonMetric label="Revenue" value={money(revenue)} />
        <ComparisonMetric label="Total miles" value={number(totalMiles)} />
        <ComparisonMetric
          label="Revenue / mile"
          value={`${money(revenuePerMile)}/mi`}
        />
        <ComparisonMetric
          label="Total expenses"
          value={money(load.total_expenses)}
        />
        <ComparisonMetric
          label="Net profit"
          value={money(netProfit)}
          tone={netProfit >= 0 ? "good" : "bad"}
        />
        <ComparisonMetric
          label="Margin"
          value={`${number(margin, 1)}%`}
          tone={margin >= 15 ? "good" : margin < 0 ? "bad" : "normal"}
        />
      </div>
    </article>
  );
}

function ComparisonMetric({
  label,
  value,
  tone = "normal",
}: {
  label: string;
  value: string;
  tone?: "normal" | "good" | "bad";
}) {
  return (
    <div className="rounded-xl border border-white/5 bg-black/20 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </p>
      <p
        className={`mt-2 text-sm font-bold ${
          tone === "good"
            ? "text-emerald-400"
            : tone === "bad"
              ? "text-red-400"
              : "text-white"
        }`}
      >
        {value}
      </p>
    </div>
  );
}

function bestProfit(loads: ComparableDispatchLoad[]) {
  return Math.max(
    ...loads.map((load) => amount(load.net_profit ?? load.profit))
  );
}

function loadsComparable(left: number, right: number) {
  return Math.abs(left - right) < 0.005;
}

function amount(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: unknown) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(amount(value));
}

function number(value: unknown, decimals = 0) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(amount(value));
}

function shortLocation(value?: string) {
  if (!value) return "Not entered";

  const parts = value.split(",").map((part) => part.trim());
  if (parts.length >= 2) {
    return `${parts[parts.length - 2]}, ${parts[parts.length - 1].split(" ")[0]}`;
  }

  return value;
}
