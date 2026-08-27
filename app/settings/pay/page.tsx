"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Banknote,
  CheckCircle2,
  Clock3,
  Settings2,
  Users,
} from "lucide-react";
import Navbar from "@/app/components/Navbar";
import { supabase } from "@/app/lib/supabase";

type PayPeriod =
  | "this-week"
  | "last-week"
  | "month"
  | "30-days"
  | "all";

type PaymentStatus = "paid" | "unpaid";

type DriverRecord = {
  id: string;
  name?: string | null;
  pay_type?: string | null;
  pay_rate?: number | string | null;
};

type LoadRecord = {
  id: string;
  driver_name?: string | null;
  broker_load_id?: string | null;
  pickup?: string | null;
  dropoff?: string | null;
  status?: string | null;
  driver_pay?: number | string | null;
  loaded_miles?: number | string | null;
  delivered_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

type PayrollPaymentRecord = {
  load_id: string;
  status: PaymentStatus;
  paid_at?: string | null;
  period_start?: string | null;
  period_end?: string | null;
};

type DriverPayRow = {
  driver: DriverRecord;
  loads: LoadRecord[];
  deliveredLoads: LoadRecord[];
  activeLoads: LoadRecord[];
  paidLoads: LoadRecord[];
  unpaidLoads: LoadRecord[];
  total: number;
  delivered: number;
  projected: number;
  paid: number;
  unpaid: number;
};

type PaymentControlProps = {
  payments: Record<string, PayrollPaymentRecord>;
  savingLoadId: string | null;
  paymentTrackingAvailable: boolean;
  onPaymentChange: (
    load: LoadRecord,
    status: PaymentStatus
  ) => Promise<void>;
};

const periodOptions: Array<{
  value: PayPeriod;
  label: string;
}> = [
  { value: "this-week", label: "This week" },
  { value: "last-week", label: "Last week" },
  { value: "month", label: "This month" },
  { value: "30-days", label: "Last 30 days" },
  { value: "all", label: "All time" },
];

export default function PayrollPage() {
  const [drivers, setDrivers] = useState<DriverRecord[]>([]);
  const [loads, setLoads] = useState<LoadRecord[]>([]);
  const [payments, setPayments] = useState<
    Record<string, PayrollPaymentRecord>
  >({});
  const [period, setPeriod] = useState<PayPeriod>("this-week");
  const [savingLoadId, setSavingLoadId] = useState<string | null>(
    null
  );
  const [
    paymentTrackingAvailable,
    setPaymentTrackingAvailable,
  ] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void fetchPayroll();

    const channel = supabase
      .channel("payroll-center-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "drivers",
        },
        () => void fetchPayroll()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "loads",
        },
        () => void fetchPayroll()
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "payroll_payments",
        },
        () => void fetchPayroll()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const fetchPayroll = async () => {
    setLoading(true);
    setError("");

    const [driversResult, loadsResult, paymentsResult] =
  await Promise.all([
    supabase
      .from("drivers")
      .select("id,name,pay_type,pay_rate")
      .order("name", { ascending: true }),

    supabase
      .from("loads")
      .select(
        "id,driver_name,broker_load_id,pickup,dropoff,status,driver_pay,loaded_miles,delivered_at,created_at,updated_at"
      )
      .order("created_at", { ascending: false }),

    supabase
      .from("payroll_payments")
      .select("load_id,status,paid_at,period_start,period_end"),
  ]);

    if (driversResult.error) {
      setError(driversResult.error.message);
    }

    if (loadsResult.error) {
      setError((current) =>
        current
          ? `${current} ${loadsResult.error?.message}`
          : loadsResult.error?.message || ""
      );
    }

    setDrivers(
      (driversResult.data || []) as DriverRecord[]
    );
    setLoads((loadsResult.data || []) as LoadRecord[]);

    if (paymentsResult.error) {
      console.error(
        "Unable to load payroll payment records:",
        paymentsResult.error
      );
      setPaymentTrackingAvailable(false);
      setPayments({});
    } else {
      setPaymentTrackingAvailable(true);

      const paymentMap = (
        (paymentsResult.data || []) as PayrollPaymentRecord[]
      ).reduce<Record<string, PayrollPaymentRecord>>(
        (map, payment) => {
          map[payment.load_id] = payment;
          return map;
        },
        {}
      );

      setPayments(paymentMap);
    }

    setLoading(false);
  };

  const updatePaymentStatus = async (
    load: LoadRecord,
    status: PaymentStatus
  ) => {
    if (!paymentTrackingAvailable) return;

    setSavingLoadId(load.id);

    const effectiveDate = loadDate(load) || new Date();
    const bounds = weekBounds(effectiveDate);
    const periodEnd = new Date(bounds.end);
    periodEnd.setDate(periodEnd.getDate() - 1);

    const payload = {
      load_id: load.id,
      status,
      paid_at:
        status === "paid"
          ? new Date().toISOString()
          : null,
      period_start: dateKey(bounds.start),
      period_end: dateKey(periodEnd),
      updated_at: new Date().toISOString(),
    };

    const { data, error: saveError } = await supabase
      .from("payroll_payments")
      .upsert(payload, { onConflict: "load_id" })
      .select(
        "load_id,status,paid_at,period_start,period_end"
      )
      .single();

    if (saveError) {
      alert(saveError.message);
      setSavingLoadId(null);
      return;
    }

    if (data) {
      const payment = data as PayrollPaymentRecord;

      setPayments((current) => ({
        ...current,
        [payment.load_id]: payment,
      }));
    }

    setSavingLoadId(null);
  };

  const payroll = useMemo(() => {
    const eligibleLoads = loads.filter((load) => {
      const driverPay = toNumber(load.driver_pay);

      return (
        driverPay > 0 &&
        loadInPeriod(load, period) &&
        !isCancelled(load.status)
      );
    });

    const driverRows: DriverPayRow[] = drivers
      .map((driver) => {
        const matchingLoads = eligibleLoads.filter(
  (load) =>
    normalized(load.driver_name) ===
    normalized(driverDisplayName(driver))
);

        const deliveredLoads = matchingLoads.filter(
          (load) => isDelivered(load.status)
        );

        const activeLoads = matchingLoads.filter(
          (load) => !isDelivered(load.status)
        );

        const paidLoads = deliveredLoads.filter(
          (load) =>
            payments[load.id]?.status === "paid"
        );

        const unpaidLoads = deliveredLoads.filter(
          (load) =>
            payments[load.id]?.status !== "paid"
        );

        return {
          driver,
          loads: matchingLoads,
          deliveredLoads,
          activeLoads,
          paidLoads,
          unpaidLoads,
          total: sumDriverPay(matchingLoads),
          delivered: sumDriverPay(deliveredLoads),
          projected: sumDriverPay(activeLoads),
          paid: sumDriverPay(paidLoads),
          unpaid: sumDriverPay(unpaidLoads),
        };
      })
      .filter((row) => row.loads.length > 0)
      .sort((a, b) => b.total - a.total);

    const matchedLoadIds = new Set(
      driverRows.flatMap((row) =>
        row.loads.map((load) => load.id)
      )
    );

    const unmatchedLoads = eligibleLoads.filter(
      (load) => !matchedLoadIds.has(load.id)
    );

    const deliveredLoads = eligibleLoads.filter((load) =>
      isDelivered(load.status)
    );

    const activeLoads = eligibleLoads.filter(
      (load) => !isDelivered(load.status)
    );

    const paidLoads = deliveredLoads.filter(
      (load) => payments[load.id]?.status === "paid"
    );

    const unpaidLoads = deliveredLoads.filter(
      (load) => payments[load.id]?.status !== "paid"
    );

    return {
      driverRows,
      unmatchedLoads,
      total: sumDriverPay(eligibleLoads),
      delivered: sumDriverPay(deliveredLoads),
      projected: sumDriverPay(activeLoads),
      paid: sumDriverPay(paidLoads),
      unpaid: sumDriverPay(unpaidLoads),
      loadCount: eligibleLoads.length,
    };
  }, [drivers, loads, payments, period]);

  const paymentControls: PaymentControlProps = {
    payments,
    savingLoadId,
    paymentTrackingAvailable,
    onPaymentChange: updatePaymentStatus,
  };

  return (
    <main className="min-h-screen bg-[#020617] text-white">
      <div className="mx-auto max-w-[1600px] p-3 sm:p-6">
        <Navbar />

        <section className="mt-6 overflow-hidden rounded-3xl border border-cyan-500/20 bg-[#07101d]">
          <div className="flex flex-col gap-6 border-b border-slate-800 p-6 sm:flex-row sm:items-center sm:justify-between lg:p-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-400">
                Company payroll
              </p>

              <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
                Payroll Center
              </h1>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
                Review driver earnings, separate completed
                pay from active projections, and track which
                delivered loads have been paid.
              </p>
            </div>

            <Link
              href="/owner"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900/50 px-4 py-3 text-sm font-semibold text-slate-200 transition hover:border-cyan-500/40 hover:text-cyan-300"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Owner
            </Link>
          </div>

          <div className="space-y-6 p-4 sm:p-6 lg:p-8">
            <section className="rounded-2xl border border-slate-800 bg-[#050d18] p-4 sm:p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-500">
                    Reporting period
                  </p>

                  <p className="mt-2 text-sm text-slate-400">
                    Payroll totals use each load&apos;s delivery,
                    creation, or last-update date.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {periodOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setPeriod(option.value)}
                      className={`rounded-xl border px-3 py-2.5 text-xs font-semibold transition ${
                        period === option.value
                          ? "border-cyan-500/50 bg-cyan-500/15 text-cyan-300"
                          : "border-slate-800 bg-slate-950/30 text-slate-400 hover:border-slate-700 hover:text-white"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            {!paymentTrackingAvailable && (
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-200">
                Payroll amounts are available, but paid/unpaid
                tracking could not connect to the
                payroll_payments table.
              </div>
            )}

            {error && (
              <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
                {error}
              </div>
            )}

            <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
              <MetricCard
                label="Saved driver pay"
                value={money(payroll.total)}
                helper={`${payroll.loadCount} load${
                  payroll.loadCount === 1 ? "" : "s"
                }`}
                icon={Banknote}
                color="text-white"
              />

              <MetricCard
                label="Delivered earnings"
                value={money(payroll.delivered)}
                helper="Completed load pay"
                icon={CheckCircle2}
                color="text-cyan-300"
              />

              <MetricCard
                label="Paid"
                value={money(payroll.paid)}
                helper="Marked paid"
                icon={CheckCircle2}
                color="text-green-400"
              />

              <MetricCard
                label="Unpaid"
                value={money(payroll.unpaid)}
                helper="Delivered and outstanding"
                icon={Clock3}
                color="text-amber-400"
              />

              <MetricCard
                label="Active projected"
                value={money(payroll.projected)}
                helper="Not delivered yet"
                icon={Settings2}
                color="text-blue-400"
              />
            </section>

            {loading ? (
              <div className="rounded-2xl border border-slate-800 bg-[#050d18] p-10 text-center text-sm text-slate-400">
                Loading payroll…
              </div>
            ) : payroll.driverRows.length === 0 &&
              payroll.unmatchedLoads.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-700 bg-[#050d18] p-10 text-center">
                <Users className="mx-auto h-8 w-8 text-slate-500" />

                <h2 className="mt-4 text-lg font-semibold">
                  No payroll records in this period
                </h2>

                <p className="mt-2 text-sm text-slate-400">
                  Loads with saved driver pay will appear here.
                </p>
              </div>
            ) : (
              <section className="grid gap-5 xl:grid-cols-2">
                {payroll.driverRows.map((row) => (
                  <DriverPayCard
                    key={row.driver.id}
                    row={row}
                    {...paymentControls}
                  />
                ))}

                {payroll.unmatchedLoads.length > 0 && (
                  <UnmatchedPayCard
                    loads={payroll.unmatchedLoads}
                    {...paymentControls}
                  />
                )}
              </section>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function DriverPayCard({
  row,
  payments,
  savingLoadId,
  paymentTrackingAvailable,
  onPaymentChange,
}: {
  row: DriverPayRow;
} & PaymentControlProps) {
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-800 bg-[#050d18]">
      <div className="border-b border-slate-800 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-400">
              Driver payroll
            </p>

            <h2 className="mt-2 text-xl font-bold">
              {driverDisplayName(row.driver)}
            </h2>

            <p className="mt-1 text-xs text-slate-500">
              {row.driver.pay_type || "Pay method not set"}
              {row.driver.pay_rate
                ? ` · ${formatPayRate(row.driver)}`
                : ""}
            </p>
          </div>

          <div className="sm:text-right">
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500">
              Total
            </p>

            <p className="mt-1 text-2xl font-bold text-white">
              {money(row.total)}
            </p>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MiniTotal
            label="Delivered"
            value={row.delivered}
            color="text-cyan-300"
          />

          <MiniTotal
            label="Active"
            value={row.projected}
            color="text-blue-400"
          />

          <MiniTotal
            label="Paid"
            value={row.paid}
            color="text-green-400"
          />

          <MiniTotal
            label="Unpaid"
            value={row.unpaid}
            color="text-amber-400"
          />
        </div>
      </div>

      <div className="divide-y divide-slate-800">
        {row.loads.map((load) => (
          <LoadPayRow
            key={load.id}
            load={load}
            payments={payments}
            savingLoadId={savingLoadId}
            paymentTrackingAvailable={
              paymentTrackingAvailable
            }
            onPaymentChange={onPaymentChange}
          />
        ))}
      </div>
    </article>
  );
}

function UnmatchedPayCard({
  loads,
  payments,
  savingLoadId,
  paymentTrackingAvailable,
  onPaymentChange,
}: {
  loads: LoadRecord[];
} & PaymentControlProps) {
  const deliveredLoads = loads.filter((load) =>
    isDelivered(load.status)
  );

  const paid = sumDriverPay(
    deliveredLoads.filter(
      (load) => payments[load.id]?.status === "paid"
    )
  );

  const unpaid = sumDriverPay(
    deliveredLoads.filter(
      (load) => payments[load.id]?.status !== "paid"
    )
  );

  return (
    <article className="overflow-hidden rounded-2xl border border-amber-500/30 bg-[#050d18]">
      <div className="border-b border-slate-800 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-400">
          Needs attention
        </p>

        <h2 className="mt-2 text-xl font-bold">
          Unmatched driver pay
        </h2>

        <p className="mt-2 text-sm text-slate-400">
          These loads contain driver pay but are not connected
          to a current driver record.
        </p>

        <div className="mt-5 grid grid-cols-3 gap-3">
          <MiniTotal
            label="Total"
            value={sumDriverPay(loads)}
            color="text-white"
          />

          <MiniTotal
            label="Paid"
            value={paid}
            color="text-green-400"
          />

          <MiniTotal
            label="Unpaid"
            value={unpaid}
            color="text-amber-400"
          />
        </div>
      </div>

      <div className="divide-y divide-slate-800">
        {loads.map((load) => (
          <LoadPayRow
            key={load.id}
            load={load}
            payments={payments}
            savingLoadId={savingLoadId}
            paymentTrackingAvailable={
              paymentTrackingAvailable
            }
            onPaymentChange={onPaymentChange}
          />
        ))}
      </div>
    </article>
  );
}

function LoadPayRow({
  load,
  payments,
  savingLoadId,
  paymentTrackingAvailable,
  onPaymentChange,
}: {
  load: LoadRecord;
} & PaymentControlProps) {
  const delivered = isDelivered(load.status);
  const paid = payments[load.id]?.status === "paid";
  const saving = savingLoadId === load.id;

  return (
    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-white">
            {load.broker_load_id || "Load"}
          </p>

          <span
            className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase ${
              delivered
                ? "border-green-500/30 bg-green-500/10 text-green-400"
                : "border-blue-500/30 bg-blue-500/10 text-blue-400"
            }`}
          >
            {load.status || "Active"}
          </span>
        </div>

        <p className="mt-1 break-words text-xs leading-5 text-slate-500">
          {load.pickup || "Pickup not provided"}
          {" → "}
          {load.dropoff || "Delivery not provided"}
        </p>

        {toNumber(load.loaded_miles) > 0 && (
          <p className="mt-1 text-xs text-slate-600">
            {number(toNumber(load.loaded_miles), 1)} miles
          </p>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <div className="text-right">
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
            Driver pay
          </p>

          <p className="mt-1 font-bold text-amber-400">
            {money(toNumber(load.driver_pay))}
          </p>
        </div>

        {delivered && (
          <button
            type="button"
            disabled={
              !paymentTrackingAvailable || saving
            }
            onClick={() =>
              void onPaymentChange(
                load,
                paid ? "unpaid" : "paid"
              )
            }
            className={`min-w-[92px] rounded-xl border px-3 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
              paid
                ? "border-green-500/40 bg-green-500/15 text-green-400 hover:bg-green-500/20"
                : "border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/15"
            }`}
          >
            {saving
              ? "Saving…"
              : paid
                ? "Paid"
                : "Mark paid"}
          </button>
        )}
      </div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  helper,
  icon: Icon,
  color,
}: {
  label: string;
  value: string;
  helper: string;
  icon: typeof Banknote;
  color: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#050d18] p-4 sm:p-5">
      <div className="flex items-center gap-2 text-slate-500">
        <Icon className="h-4 w-4" />

        <p className="text-[10px] font-semibold uppercase tracking-[0.2em]">
          {label}
        </p>
      </div>

      <p className={`mt-3 text-xl font-bold ${color}`}>
        {value}
      </p>

      <p className="mt-2 text-xs text-slate-500">
        {helper}
      </p>
    </div>
  );
}

function MiniTotal({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {label}
      </p>

      <p className={`mt-2 font-bold ${color}`}>
        {money(value)}
      </p>
    </div>
  );
}

function driverDisplayName(driver: DriverRecord) {
  return driver.name || "Unnamed driver";
}

function formatPayRate(driver: DriverRecord) {
  const rate = toNumber(driver.pay_rate);
  const payType = normalized(driver.pay_type);

  if (payType.includes("cpm")) {
    return `${money(rate)}/mile`;
  }

  if (payType.includes("percent")) {
    return `${number(rate, 2)}%`;
  }

  if (payType.includes("flat")) {
    return `${money(rate)} flat`;
  }

  return String(driver.pay_rate || "");
}

function sumDriverPay(loads: LoadRecord[]) {
  const totalCents = loads.reduce(
    (total, load) =>
      total + Math.round(toNumber(load.driver_pay) * 100),
    0
  );

  return totalCents / 100;
}

function isDelivered(status?: string | null) {
  return normalized(status) === "delivered";
}

function isCancelled(status?: string | null) {
  return normalized(status) === "cancelled";
}

function normalized(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function toNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function loadDate(load: LoadRecord) {
  const value =
    load.delivered_at ||
    load.created_at ||
    load.updated_at;

  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function loadInPeriod(
  load: LoadRecord,
  period: PayPeriod
) {
  if (period === "all") return true;

  const date = loadDate(load);
  if (!date) return false;

  const now = new Date();

  if (period === "month") {
    return (
      date.getFullYear() === now.getFullYear() &&
      date.getMonth() === now.getMonth()
    );
  }

  if (period === "30-days") {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - 29);

    return date >= start && date <= now;
  }

  const bounds =
    period === "this-week"
      ? weekBounds(now)
      : previousWeekBounds(now);

  return date >= bounds.start && date < bounds.end;
}

function weekBounds(reference: Date) {
  const start = new Date(reference);
  start.setHours(0, 0, 0, 0);

  const daysSinceMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - daysSinceMonday);

  const end = new Date(start);
  end.setDate(end.getDate() + 7);

  return { start, end };
}

function previousWeekBounds(reference: Date) {
  const currentWeek = weekBounds(reference);
  const end = new Date(currentWeek.start);
  const start = new Date(end);
  start.setDate(start.getDate() - 7);

  return { start, end };
}

function dateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(
    2,
    "0"
  );
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value || 0);
}

function number(value: number, decimals = 0) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value || 0);
}