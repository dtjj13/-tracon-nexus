"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  BadgeDollarSign,
  CircleAlert,
  Database,
} from "lucide-react";
import { supabase } from "../../lib/supabase";
import {
  evaluateRoundTripDecision,
  findBidForNetProfit,
  type DriverPayRule,
  type LaneRateEstimate,
} from "../../lib/loadDecision";
import type { LoadProfitInput } from "../../lib/loadProfit";
import {
  estimateReturnLaneRate,
  type HistoricalLaneLoad,
} from "../../lib/laneRateHistory";

type RoundTripDecisionPanelProps = {
  outbound: LoadProfitInput;
  pickup: string;
  dropoff: string;
  driverPayRule?: DriverPayRule;
};

export default function RoundTripDecisionPanel({
  outbound,
  pickup,
  dropoff,
  driverPayRule,
}: RoundTripDecisionPanelProps) {
  const [history, setHistory] = useState<HistoricalLaneLoad[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [returnLoadedMiles, setReturnLoadedMiles] = useState(
    Math.max(0, outbound.loadedMiles)
  );
  const [returnDeadheadMiles, setReturnDeadheadMiles] = useState(50);
  const [emptyReturnMiles, setEmptyReturnMiles] = useState(
    Math.max(0, outbound.loadedMiles)
  );
  const [manualRatePerMile, setManualRatePerMile] = useState("");
  const [reloadProbability, setReloadProbability] = useState(55);
  const [waitDays, setWaitDays] = useState(1);

  useEffect(() => {
    let active = true;

    async function fetchHistory() {
      setHistoryLoading(true);
      const { data, error } = await supabase
        .from("loads")
        .select("pickup,dropoff,rate,loaded_miles,status,updated_at")
        .order("updated_at", { ascending: false })
        .limit(1000);

      if (!active) return;
      if (!error && data) setHistory(data as HistoricalLaneLoad[]);
      setHistoryLoading(false);
    }

    fetchHistory();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setReturnLoadedMiles(Math.max(0, outbound.loadedMiles));
    setEmptyReturnMiles(Math.max(0, outbound.loadedMiles));
  }, [outbound.loadedMiles]);

  const historicalEstimate = useMemo(
    () =>
      estimateReturnLaneRate(history, pickup, dropoff, returnLoadedMiles),
    [dropoff, history, pickup, returnLoadedMiles]
  );

  const manualRate = Number(manualRatePerMile);
  const activeEstimate: LaneRateEstimate =
    manualRatePerMile.trim() && Number.isFinite(manualRate) && manualRate > 0
      ? {
          source: "manual",
          ratePerMile: manualRate,
          estimatedRevenue: manualRate * returnLoadedMiles,
          sampleSize: 0,
          confidence: "high",
          newestLoadAgeDays: null,
          laneLabel: historicalEstimate.laneLabel,
        }
      : historicalEstimate;

  const decision = useMemo(
    () =>
      evaluateRoundTripDecision({
        outbound,
        returnLoadedMiles,
        returnDeadheadMiles,
        emptyReturnMiles,
        returnRatePerMile: activeEstimate.ratePerMile,
        reloadProbability: reloadProbability / 100,
        waitDays,
      }),
    [
      activeEstimate.ratePerMile,
      emptyReturnMiles,
      outbound,
      reloadProbability,
      returnDeadheadMiles,
      returnLoadedMiles,
      waitDays,
    ]
  );

  const roundTripProtectedBid = useMemo(() => {
    const expectedScenario = decision.scenarios.find(
      (scenario) => scenario.id === "expected"
    );
    const expectedCombinedProfit =
      expectedScenario?.netProfit ?? decision.outbound.profit.netProfit;
    const expectedReturnProfit =
      expectedCombinedProfit - decision.outbound.profit.netProfit;

    return findBidForNetProfit(
      outbound,
      Math.max(0, -expectedReturnProfit),
      driverPayRule
    );
  }, [decision, driverPayRule, outbound]);

  return (
    <section className="overflow-hidden rounded-2xl border border-cyan-500/20 bg-[#07101A] shadow-[0_24px_80px_rgba(0,0,0,0.22)]">
      <div className="flex flex-col gap-4 border-b border-white/10 px-5 py-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-400">
            <ArrowLeftRight className="h-4 w-4" />
            Round-trip planner
          </div>
          <h3 className="mt-2 text-xl font-bold text-white">
            Check the money going and coming back
          </h3>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
            Models a likely reload, the empty return risk, and the minimum return
            rate needed for this trip.
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-right">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
            Return lane
          </p>
          <p className="mt-1 font-semibold text-white">{activeEstimate.laneLabel}</p>
          <p className="mt-1 text-xs text-slate-400">
            {sourceLabel(activeEstimate, historyLoading)}
          </p>
        </div>
      </div>

      <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_minmax(330px,0.78fr)]">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <NumberField
              label="Return loaded miles"
              value={returnLoadedMiles}
              onChange={setReturnLoadedMiles}
              suffix="mi"
            />
            <NumberField
              label="Reload deadhead"
              value={returnDeadheadMiles}
              onChange={setReturnDeadheadMiles}
              suffix="mi"
            />
            <NumberField
              label="Empty return miles"
              value={emptyReturnMiles}
              onChange={setEmptyReturnMiles}
              suffix="mi"
            />
            <label className="rounded-xl border border-white/10 bg-[#091522] p-3">
              <span className="text-xs font-medium text-slate-300">
                Return rate override
              </span>
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-700 bg-[#050C14] px-3">
                <span className="text-slate-500">$</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={manualRatePerMile}
                  onChange={(event) => setManualRatePerMile(event.target.value)}
                  placeholder={
                    historicalEstimate.ratePerMile?.toFixed(2) ?? "Enter rate"
                  }
                  className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-white outline-none"
                />
                <span className="text-xs text-slate-500">/mi</span>
              </div>
            </label>
            <NumberField
              label="Reload probability"
              value={reloadProbability}
              onChange={(value) =>
                setReloadProbability(Math.min(100, Math.max(0, value)))
              }
              suffix="%"
            />
            <NumberField
              label="Expected wait"
              value={waitDays}
              onChange={setWaitDays}
              suffix="days"
              step={0.5}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {decision.scenarios.map((scenario) => (
              <div
                key={scenario.id}
                className={`rounded-xl border p-4 ${
                  scenario.id === "expected"
                    ? "border-cyan-500/30 bg-cyan-500/[0.06]"
                    : "border-white/10 bg-white/[0.025]"
                }`}
              >
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                  {scenario.name}
                </p>
                <p
                  className={`mt-2 text-xl font-bold ${
                    scenario.netProfit >= 0 ? "text-emerald-400" : "text-red-400"
                  }`}
                >
                  {money(scenario.netProfit)}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {money(scenario.profitPerMile)}/mi · {money(scenario.profitPerDay)}/day
                </p>
                <p className="mt-3 text-xs leading-5 text-slate-500">
                  {scenario.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        <aside className="rounded-2xl border border-white/10 bg-[#091522] p-5">
          <div className="flex items-center gap-2 text-cyan-400">
            <BadgeDollarSign className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-[0.18em]">
              Round-trip verdict
            </span>
          </div>
          <p className="mt-4 text-2xl font-bold text-white">{decision.headline}</p>
          <p className="mt-2 text-sm leading-6 text-slate-400">{decision.summary}</p>

          <div className="mt-5 rounded-xl border border-white/10 bg-black/20 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Minimum return rate
            </p>
            <p className="mt-1 text-2xl font-bold text-white">
              {decision.minimumReturnRatePerMile === null
                ? "Not available"
                : `${money(decision.minimumReturnRatePerMile)}/mi`}
            </p>
          </div>

          <div className="mt-3 rounded-xl border border-cyan-500/20 bg-cyan-500/[0.05] p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-400">
              Round-trip protected bid
            </p>
            <p className="mt-1 text-2xl font-bold text-white">
              {money(roundTripProtectedBid)}
            </p>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Outbound bid floor that covers the expected return-trip downside.
            </p>
          </div>

          <div className="mt-4 flex gap-3 rounded-xl border border-amber-500/20 bg-amber-500/[0.05] p-4">
            {activeEstimate.source === "tracon-history" ? (
              <Database className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            ) : (
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            )}
            <p className="text-xs leading-5 text-amber-100/70">
              {activeEstimate.source === "tracon-history"
                ? `Uses ${activeEstimate.sampleSize} reverse-lane load${
                    activeEstimate.sampleSize === 1 ? "" : "s"
                  } from your TRACON history. Older records are downweighted, so treat ${activeEstimate.confidence} confidence as guidance—not a live market quote.`
                : activeEstimate.source === "manual"
                  ? "Manual return pricing is active. Replace it when you receive a current broker quote or market-rate feed."
                  : "No matching reverse-lane history was found. Enter a return rate or use the minimum rate as your negotiation floor."}
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}

function NumberField({
  label,
  value,
  onChange,
  suffix,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  suffix: string;
  step?: number;
}) {
  return (
    <label className="rounded-xl border border-white/10 bg-[#091522] p-3">
      <span className="text-xs font-medium text-slate-300">{label}</span>
      <div className="mt-2 flex items-center gap-2 rounded-lg border border-slate-700 bg-[#050C14] px-3">
        <input
          type="number"
          min="0"
          step={step}
          value={value}
          onChange={(event) => onChange(Math.max(0, Number(event.target.value) || 0))}
          className="min-w-0 flex-1 bg-transparent py-2.5 text-sm text-white outline-none"
        />
        <span className="text-xs text-slate-500">{suffix}</span>
      </div>
    </label>
  );
}

function sourceLabel(estimate: LaneRateEstimate, loading: boolean) {
  if (loading) return "Checking TRACON history…";
  if (estimate.source === "manual") return "Manual current estimate";
  if (estimate.source === "tracon-history") {
    return `${estimate.confidence} confidence · ${estimate.sampleSize} historical`;
  }
  return "No return-rate history yet";
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}
