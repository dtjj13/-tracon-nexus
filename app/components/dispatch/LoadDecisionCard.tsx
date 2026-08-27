import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  CircleDollarSign,
  Gauge,
  Route,
  ShieldAlert,
} from "lucide-react";
import type {
  LoadBidGuidance,
  LoadDecisionFactorTone,
  LoadDecisionRecommendation,
  LoadDecisionResult,
} from "../../lib/loadDecision";

type LoadDecisionCardProps = {
  decision: LoadDecisionResult | null;
  bidGuidance?: LoadBidGuidance | null;
};

const recommendationStyles: Record<
  LoadDecisionRecommendation,
  {
    label: string;
    border: string;
    background: string;
    badge: string;
    score: string;
    bar: string;
  }
> = {
  book: {
    label: "Book",
    border: "border-emerald-500/30",
    background: "bg-emerald-500/[0.06]",
    badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    score: "text-emerald-300",
    bar: "bg-emerald-400",
  },
  review: {
    label: "Review",
    border: "border-amber-500/30",
    background: "bg-amber-500/[0.06]",
    badge: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    score: "text-amber-300",
    bar: "bg-amber-400",
  },
  pass: {
    label: "Pass",
    border: "border-red-500/30",
    background: "bg-red-500/[0.06]",
    badge: "border-red-500/30 bg-red-500/10 text-red-300",
    score: "text-red-300",
    bar: "bg-red-400",
  },
};

const factorStyles: Record<
  LoadDecisionFactorTone,
  { border: string; value: string }
> = {
  positive: {
    border: "border-emerald-500/20",
    value: "text-emerald-300",
  },
  warning: {
    border: "border-amber-500/20",
    value: "text-amber-300",
  },
  danger: { border: "border-red-500/20", value: "text-red-300" },
  neutral: { border: "border-slate-700", value: "text-slate-100" },
};

export default function LoadDecisionCard({
  decision,
  bidGuidance,
}: LoadDecisionCardProps) {
  if (!decision) {
    return (
      <section className="mt-5 rounded-2xl border border-slate-800 bg-[#07101A] p-5">
        <div className="flex items-start gap-3">
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-2.5 text-cyan-300">
            <Gauge className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-400">
              Load Decision Engine
            </p>
            <h3 className="mt-1 text-lg font-semibold text-white">
              Enter the load details for a decision
            </h3>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-400">
              Add revenue and loaded miles, then select a driver. TRACON will
              score the load using your live fuel, insurance, factoring, driver
              pay, and deadhead assumptions.
            </p>
          </div>
        </div>
      </section>
    );
  }

  const appearance = recommendationStyles[decision.recommendation];
  const RecommendationIcon =
    decision.recommendation === "book"
      ? CheckCircle2
      : decision.recommendation === "review"
        ? AlertTriangle
        : ShieldAlert;

  return (
    <section
      className={`mt-5 overflow-hidden rounded-2xl border ${appearance.border} ${appearance.background}`}
    >
      <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1fr)_180px] lg:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-400">
              Load Decision Engine
            </p>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${appearance.badge}`}
            >
              <RecommendationIcon className="h-3.5 w-3.5" />
              {appearance.label}
            </span>
          </div>
          <h3 className="mt-3 text-xl font-bold text-white">
            {decision.headline}
          </h3>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-300">
            {decision.summary}
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
                Load score
              </p>
              <p className={`mt-1 text-4xl font-black ${appearance.score}`}>
                {decision.score}
              </p>
            </div>
            <p className="pb-1 text-xs text-slate-500">of 100</p>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
            <div
              className={`h-full rounded-full transition-all ${appearance.bar}`}
              style={{ width: `${decision.score}%` }}
            />
          </div>
        </div>
      </div>

      <div className="grid gap-3 border-t border-white/10 p-5 sm:grid-cols-2 xl:grid-cols-4">
        {decision.factors.map((factor, index) => {
          const style = factorStyles[factor.tone];
          const Icon = [CircleDollarSign, Route, Gauge, ArrowRight][index] ?? Gauge;

          return (
            <div
              key={factor.label}
              className={`rounded-xl border bg-[#07101A]/80 p-4 ${style.border}`}
            >
              <div className="flex items-center gap-2 text-slate-500">
                <Icon className="h-4 w-4" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em]">
                  {factor.label}
                </p>
              </div>
              <p className={`mt-2 text-lg font-bold ${style.value}`}>
                {factor.value}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {factor.detail}
              </p>
            </div>
          );
        })}
      </div>

      {bidGuidance && (
        <div className="border-t border-white/10 p-5">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-400">
                Bid guidance
              </p>
              <h4 className="mt-1 text-lg font-bold text-white">
                Negotiate with a protected floor
              </h4>
            </div>
            <p
              className={`text-xs font-semibold ${
                bidGuidance.status === "below-break-even"
                  ? "text-red-300"
                  : bidGuidance.status === "target-met"
                    ? "text-emerald-300"
                    : "text-amber-300"
              }`}
            >
              {bidGuidance.status === "below-break-even"
                ? `${money(Math.abs(bidGuidance.roomAboveBreakEven))} below break-even`
                : bidGuidance.status === "target-met"
                  ? `${money(bidGuidance.currentOffer - bidGuidance.suggestedBid)} above suggested bid`
                  : `${money(bidGuidance.suggestedBid - bidGuidance.currentOffer)} below suggested bid`}
            </p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <BidMetric
              label="Current broker offer"
              value={money(bidGuidance.currentOffer)}
              detail={`${money(bidGuidance.currentOfferPerLoadedMile)}/loaded mi`}
              tone="text-white"
            />
            <BidMetric
              label="Do not bid below"
              value={money(bidGuidance.breakEvenBid)}
              detail={`${money(bidGuidance.breakEvenPerLoadedMile)}/loaded mi · $0 projected profit`}
              tone="text-red-300"
            />
            <BidMetric
              label="Suggested bid"
              value={money(bidGuidance.suggestedBid)}
              detail={`${money(bidGuidance.suggestedPerLoadedMile)}/loaded mi · protects ${bidGuidance.targetMarginPercent}% margin`}
              tone="text-emerald-300"
              accent
            />
          </div>
        </div>
      )}

      <div className="border-t border-white/10 px-5 py-3 text-xs text-slate-500">
        Advisory only — the dispatcher keeps final approval.
      </div>
    </section>
  );
}

function BidMetric({
  label,
  value,
  detail,
  tone,
  accent = false,
}: {
  label: string;
  value: string;
  detail: string;
  tone: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        accent
          ? "border-emerald-500/30 bg-emerald-500/[0.06]"
          : "border-white/10 bg-[#07101A]/80"
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        {label}
      </p>
      <p className={`mt-2 text-xl font-bold ${tone}`}>{value}</p>
      <p className="mt-1 text-xs leading-5 text-slate-500">{detail}</p>
    </div>
  );
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(value || 0));
}
