import Link from "next/link";
import {
  ArrowRight,
  BrainCircuit,
  CircleAlert,
  CircleCheck,
  TrendingDown,
} from "lucide-react";

type Props = {
  companyHealth: number;
  missingPODs: number;
  missingRateCons: number;
  negativeProfitLoads: number;
  revenueAtRisk: number;
  activeLoads: number;
  activeDrivers: number;
  totalProfit: number;
  onReviewNegativeProfit?: () => void;
};

export default function ExecutiveAI({
  companyHealth,
  missingPODs,
  missingRateCons,
  negativeProfitLoads,
  revenueAtRisk,
  activeLoads,
  activeDrivers,
  totalProfit,
  onReviewNegativeProfit,
}: Props) {
  const greeting = getGreeting();

  const insights: Array<{
    label: string;
    important: boolean;
    onClick?: () => void;
  }> = [
    {
      label: `${activeLoads} active ${
        activeLoads === 1 ? "load" : "loads"
      } currently in operation.`,
      important: false,
    },
    {
      label: `${activeDrivers} active ${
        activeDrivers === 1 ? "driver" : "drivers"
      } available.`,
      important: false,
    },
    {
      label:
        missingPODs > 0
          ? `${missingPODs} delivered ${
              missingPODs === 1 ? "load is" : "loads are"
            } missing POD documents.`
          : "No delivered loads are currently missing POD documents.",
      important: missingPODs > 0,
    },
    {
      label:
        missingRateCons > 0
          ? `${missingRateCons} ${
              missingRateCons === 1 ? "load is" : "loads are"
            } missing a rate confirmation.`
          : "All current loads have rate confirmations.",
      important: missingRateCons > 0,
    },
    {
      label:
        negativeProfitLoads > 0
          ? `${negativeProfitLoads} ${
              negativeProfitLoads === 1 ? "load is" : "loads are"
            } showing a negative profit.`
          : "No current loads are showing a negative profit.",
      important: negativeProfitLoads > 0,
      onClick:
        negativeProfitLoads > 0
          ? onReviewNegativeProfit
          : undefined,
    },
  ];

  const recommendation = getRecommendation({
    missingPODs,
    missingRateCons,
    negativeProfitLoads,
    revenueAtRisk,
    totalProfit,
  });

  const healthy =
    missingPODs === 0 &&
    missingRateCons === 0 &&
    negativeProfitLoads === 0 &&
    totalProfit >= 0;

  return (
    <section className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-500/10 via-[#07101A] to-[#020617] p-6 shadow-xl shadow-cyan-500/5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        <div className="shrink-0 rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-3">
          <BrainCircuit className="h-7 w-7 text-[#16BFFF]" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#16BFFF]">
            AI Executive Brief
          </p>

          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold text-white">
                {greeting}, Derrick
              </h2>

              <p className="mt-1 text-sm text-slate-400">
                Live summary generated from your current operational data.
              </p>
            </div>

            <div className="text-left lg:text-right">
              <p className="text-xs uppercase tracking-wider text-slate-500">
                Company Health
              </p>

              <p
                className={`mt-1 text-3xl font-bold ${
                  companyHealth >= 80
                    ? "text-cyan-400"
                    : companyHealth >= 65
                      ? "text-yellow-400"
                      : "text-red-400"
                }`}
              >
                {companyHealth}%
              </p>
            </div>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {insights.map((insight) => (
              <button
                key={insight.label}
                type="button"
                onClick={insight.onClick}
                disabled={!insight.onClick}
                className={`flex w-full items-start gap-3 rounded-xl border border-slate-800 bg-black/20 p-3 text-left ${
                  insight.onClick
                    ? "cursor-pointer transition hover:border-cyan-500/40 hover:bg-cyan-500/10"
                    : "cursor-default"
                }`}
              >
                {insight.important ? (
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-yellow-400" />
                ) : (
                  <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-green-400" />
                )}

                <p className="flex-1 text-sm leading-6 text-slate-300">
                  {insight.label}
                </p>

                {insight.onClick && (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-cyan-400">
                    Review
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                )}
              </button>
            ))}
          </div>

          <div
            className={`mt-5 rounded-xl border p-4 ${
              healthy
                ? "border-green-500/20 bg-green-500/5"
                : "border-cyan-500/20 bg-cyan-500/5"
            }`}
          >
            <div className="flex items-start gap-3">
              {totalProfit < 0 ? (
                <TrendingDown className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
              ) : (
                <BrainCircuit className="mt-0.5 h-5 w-5 shrink-0 text-[#16BFFF]" />
              )}

              <div>
                <p className="text-sm font-semibold text-[#16BFFF]">
                  Recommended Action
                </p>

                <p className="mt-1 text-sm leading-6 text-slate-300">
                  {recommendation}
                </p>

                {revenueAtRisk > 0 && (
                  <p className="mt-2 text-sm font-semibold text-red-400">
                    Revenue At Risk: {money(revenueAtRisk)}
                  </p>
                )}
              </div>
            </div>
          </div>

          <Link
            href="/owner/ai"
            className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-[#16BFFF] transition hover:text-cyan-300"
          >
            Open AI Executive
                       <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

function getGreeting() {
  const hour = new Date().getHours();

  if (hour < 12) return "Good Morning";
  if (hour < 18) return "Good Afternoon";
  return "Good Evening";
}

function getRecommendation({
  missingPODs,
  missingRateCons,
  negativeProfitLoads,
  revenueAtRisk,
  totalProfit,
}: {
  missingPODs: number;
  missingRateCons: number;
  negativeProfitLoads: number;
  revenueAtRisk: number;
  totalProfit: number;
}) {
  if (missingPODs > 0) {
    return `Collect the missing POD ${
      missingPODs === 1 ? "document" : "documents"
    } first to help release ${money(revenueAtRisk)} for invoicing.`;
  }

  if (negativeProfitLoads > 0) {
    return `Review the ${negativeProfitLoads} negative-profit ${
      negativeProfitLoads === 1 ? "load" : "loads"
    } and verify rates, driver pay, fuel costs, and other expenses.`;
  }

  if (missingRateCons > 0) {
    return `Upload the missing rate ${
      missingRateCons === 1 ? "confirmation" : "confirmations"
    } so the load records remain complete and ready for billing.`;
  }

  if (totalProfit < 0) {
    return "Review current load expenses and pricing because total profit is currently negative.";
  }

  return "Current connected operations look healthy. Continue monitoring load profitability and documentation.";
}

function money(value: number) {
  return `$${Number(value || 0).toLocaleString("en-US", {
    maximumFractionDigits: 2,
  })}`;
} 