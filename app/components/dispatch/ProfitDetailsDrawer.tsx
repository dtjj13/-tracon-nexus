"use client";

import {
  Calculator,
  Fuel,
  Gauge,
  Percent,
  Route,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { useEffect } from "react";

export type ProfitDetailsLoad = {
  id: string;
  tracon_id?: string;
  broker_load_id?: string;
  pickup?: string;
  dropoff?: string;
  rate?: number;
  loaded_miles?: number;
  deadhead_miles?: number;
  driver_pay?: number;
  fuel_cost?: number;
  fuel_cost_source?:
    | "manual"
    | "estimated"
    | "existing";
  fuel_mpg_used?: number | null;
fuel_price_used?: number | null;
fuel_price_source?: string | null;
fuel_price_as_of?: string | null;
  insurance_rate_per_mile?: number;
  insurance_cost?: number;
  factoring_percent_used?: number;
  factoring_cost?: number;
  other_expenses?: number;
  total_expenses?: number;
  net_profit?: number;
  profit_margin?: number;
  profit?: number;
};

type Props = {
  load: ProfitDetailsLoad | null;
  onClose: () => void;
};

export default function ProfitDetailsDrawer({
  load,
  onClose,
}: Props) {
  useEffect(() => {
    if (!load) return;

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = "hidden";

    const handleKeyDown = (
      event: KeyboardEvent
    ) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener(
      "keydown",
      handleKeyDown
    );

    return () => {
      document.body.style.overflow =
        previousOverflow;

      window.removeEventListener(
        "keydown",
        handleKeyDown
      );
    };
  }, [load, onClose]);

  if (!load) return null;

  const revenue = Number(load.rate || 0);
  const driverPay = Number(
    load.driver_pay || 0
  );
  const fuelCost = Number(load.fuel_cost || 0);
  const insuranceCost = Number(
    load.insurance_cost || 0
  );
  const factoringCost = Number(
    load.factoring_cost || 0
  );
  const otherExpenses = Number(
    load.other_expenses || 0
  );

  const totalExpenses = Number(
    load.total_expenses ||
      driverPay +
        fuelCost +
        insuranceCost +
        factoringCost +
        otherExpenses
  );

  const netProfit = Number(
    load.net_profit ??
      load.profit ??
      revenue - totalExpenses
  );

  const profitMargin = Number(
    load.profit_margin ??
      (revenue > 0
        ? (netProfit / revenue) * 100
        : 0)
  );

  const totalMiles =
    Number(load.loaded_miles || 0) +
    Number(load.deadhead_miles || 0);

  const profitable = netProfit >= 0;

  return (
    <div
      className="fixed inset-0 z-[100]"
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        aria-label="Close profit details"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/75 backdrop-blur-sm"
      />

      <aside className="absolute bottom-0 right-0 top-0 flex w-full max-w-[480px] flex-col border-l border-slate-800 bg-[#050B13] text-white shadow-[-24px_0_70px_rgba(0,0,0,0.45)]">
        <header className="border-b border-slate-800 bg-[#07101A] px-6 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.24em] text-cyan-400">
                Profit details
              </p>

              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                {load.broker_load_id ||
                  load.tracon_id ||
                  "Load"}
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                {load.pickup || "Pickup"} →{" "}
                {load.dropoff || "Dropoff"}
              </p>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close profit details"
              className="rounded-xl border border-slate-700 bg-[#0B1522] p-2.5 text-slate-400 transition hover:border-cyan-500/40 hover:text-white"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-6 py-6">
          <section
            className={`rounded-2xl border p-5 ${
              profitable
                ? "border-emerald-500/25 bg-emerald-500/[0.07]"
                : "border-red-500/25 bg-red-500/[0.07]"
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Net load profit
                </p>

                <p
                  className={`mt-2 text-4xl font-bold tracking-tight ${
                    profitable
                      ? "text-emerald-400"
                      : "text-red-400"
                  }`}
                >
                  {formatMoney(netProfit)}
                </p>
              </div>

              <div
                className={`flex h-11 w-11 items-center justify-center rounded-xl border ${
                  profitable
                    ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-400"
                    : "border-red-500/25 bg-red-500/10 text-red-400"
                }`}
              >
                {profitable ? (
                  <TrendingUp className="h-5 w-5" />
                ) : (
                  <TrendingDown className="h-5 w-5" />
                )}
              </div>
            </div>

            <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
              <span className="text-sm text-slate-400">
                Profit margin
              </span>

              <span
                className={`text-lg font-semibold ${
                  profitable
                    ? "text-emerald-300"
                    : "text-red-300"
                }`}
              >
                {profitMargin.toFixed(1)}%
              </span>
            </div>
          </section>

          <section className="mt-5 rounded-2xl border border-slate-800 bg-[#07101A] p-5">
            <div className="mb-4 flex items-center gap-3">
              <Calculator className="h-5 w-5 text-cyan-400" />

              <h3 className="font-semibold text-white">
                Profit calculation
              </h3>
            </div>

            <div className="space-y-1">
              <MoneyRow
                label="Gross revenue"
                value={revenue}
                revenue
              />

              <MoneyRow
                label="Driver pay"
                value={driverPay}
              />

              <MoneyRow
                label="Fuel"
                value={fuelCost}
                badge={fuelSourceLabel(
                  load.fuel_cost_source
                )}
              />

              <MoneyRow
                label="Insurance"
                value={insuranceCost}
              />

              <MoneyRow
                label="Factoring"
                value={factoringCost}
              />

              <MoneyRow
                label="Other expenses"
                value={otherExpenses}
              />
            </div>

            <div className="mt-4 border-t border-slate-700 pt-4">
              <div className="flex items-center justify-between gap-4 text-sm">
                <span className="font-medium text-slate-300">
                  Total expenses
                </span>

                <span className="font-semibold text-red-300">
                  -{formatMoney(totalExpenses)}
                </span>
              </div>

              <div className="mt-4 flex items-center justify-between gap-4 rounded-xl bg-[#0B1522] px-4 py-3">
                <span className="font-semibold text-white">
                  Net profit
                </span>

                <span
                  className={`text-lg font-bold ${
                    profitable
                      ? "text-emerald-400"
                      : "text-red-400"
                  }`}
                >
                  {formatMoney(netProfit)}
                </span>
              </div>
            </div>
          </section>

          <section className="mt-5 rounded-2xl border border-slate-800 bg-[#07101A] p-5">
            <h3 className="font-semibold text-white">
              Calculation inputs
            </h3>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <DetailCard
                icon={<Route className="h-4 w-4" />}
                label="Total miles"
                value={`${formatNumber(
                  totalMiles
                )} mi`}
              />

              <DetailCard
                icon={
                  <ShieldCheck className="h-4 w-4" />
                }
                label="Insurance rate"
                value={`${formatMoney(
                  Number(
                    load.insurance_rate_per_mile ||
                      0
                  ),
                  4
                )}/mi`}
              />

              <DetailCard
                icon={
                  <Percent className="h-4 w-4" />
                }
                label="Factoring rate"
                value={`${Number(
                  load.factoring_percent_used || 0
                ).toFixed(3)}%`}
              />

              <DetailCard
  icon={<Fuel className="h-4 w-4" />}
  label="Fuel basis"
  value={fuelBasis(load)}
/>
</div>

<div className="mt-3 rounded-xl border border-slate-800 bg-[#0B1522] p-4">
  <div className="flex items-start justify-between gap-4">
    <span className="text-xs text-slate-500">
      Fuel price source
    </span>

    <span className="text-right text-xs font-medium text-slate-300">
      {load.fuel_price_source || "Company default"}
    </span>
  </div>

  <div className="mt-3 flex items-center justify-between gap-4 border-t border-slate-800 pt-3">
    <span className="text-xs text-slate-500">
      Price effective date
    </span>

    <span className="text-xs font-medium text-slate-300">
      {formatFuelPriceDate(load.fuel_price_as_of)}
    </span>
  </div>
</div>
</section>

          <div className="mt-5 flex items-start gap-3 rounded-2xl border border-cyan-500/20 bg-cyan-500/[0.05] p-4">
            <Gauge className="mt-0.5 h-5 w-5 shrink-0 text-cyan-400" />

            <p className="text-sm leading-6 text-slate-400">
              These values are saved with this load,
              so its historical profit remains stable
              when company defaults change later.
            </p>
          </div>
        </div>
      </aside>
    </div>
  );
}

function MoneyRow({
  label,
  value,
  revenue = false,
  badge,
}: {
  label: string;
  value: number;
  revenue?: boolean;
  badge?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl px-3 py-2.5 text-sm transition hover:bg-[#0B1522]">
      <div className="flex items-center gap-2">
        <span className="text-slate-400">
          {label}
        </span>

        {badge && (
          <span className="rounded-full border border-slate-700 bg-slate-800/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {badge}
          </span>
        )}
      </div>

      <span
        className={`font-semibold ${
          revenue
            ? "text-emerald-400"
            : "text-slate-200"
        }`}
      >
        {revenue ? "" : "-"}
        {formatMoney(value)}
      </span>
    </div>
  );
}

function DetailCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-[#0B1522] p-3">
      <div className="flex items-center gap-2 text-cyan-400">
        {icon}

        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
          {label}
        </span>
      </div>

      <p className="mt-2 text-sm font-semibold text-slate-200">
        {value}
      </p>
    </div>
  );
}

function fuelSourceLabel(
  source?: ProfitDetailsLoad["fuel_cost_source"]
) {
  if (source === "estimated") return "Estimated";
  if (source === "manual") return "Manual";
  if (source === "existing") return "Existing";

  return undefined;
}

function fuelBasis(load: ProfitDetailsLoad) {
  if (load.fuel_cost_source !== "estimated") {
    return (
      fuelSourceLabel(load.fuel_cost_source) ||
      "Recorded cost"
    );
  }

  const mpg = Number(load.fuel_mpg_used || 0);
  const price = Number(
    load.fuel_price_used || 0
  );

  if (mpg <= 0 || price <= 0) {
    return "Estimated";
  }

  return `${mpg.toFixed(1)} MPG · ${formatMoney(
    price,
    3
  )}/gal`;
}
function formatFuelPriceDate(value?: string | null) {
  if (!value) return "Not applicable";

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
function formatMoney(
  value: number,
  decimals = 2
) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(Number(value || 0));
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 1,
  }).format(Number(value || 0));
}