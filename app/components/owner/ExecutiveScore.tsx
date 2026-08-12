import { Award, Gauge } from "lucide-react";

type Props = {
  companyHealth: number;
  dispatchHealth: number;
  driverHealth: number;
  financialHealth: number;
};

export default function ExecutiveScore({
  companyHealth,
  dispatchHealth,
  driverHealth,
  financialHealth,
}: Props) {
  const score = clampScore(
    companyHealth * 0.4 +
      dispatchHealth * 0.25 +
      driverHealth * 0.15 +
      financialHealth * 0.2
  );

  const grade =
    score >= 95
      ? "A+"
      : score >= 90
        ? "A"
        : score >= 85
          ? "B+"
          : score >= 80
            ? "B"
            : score >= 75
              ? "C+"
              : score >= 70
                ? "C"
                : score >= 60
                  ? "D"
                  : "F";

  const status =
    score >= 90
      ? {
          label: "Excellent",
          color: "text-green-400",
          bar: "bg-green-500",
        }
      : score >= 80
        ? {
            label: "Strong",
            color: "text-cyan-400",
            bar: "bg-cyan-500",
          }
        : score >= 70
          ? {
              label: "Needs Attention",
              color: "text-yellow-400",
              bar: "bg-yellow-500",
            }
          : {
              label: "At Risk",
              color: "text-red-400",
              bar: "bg-red-500",
            };

  const categories = [
    {
      title: "Company",
      score: companyHealth,
    },
    {
      title: "Dispatch",
      score: dispatchHealth,
    },
    {
      title: "Drivers",
      score: driverHealth,
    },
    {
      title: "Financials",
      score: financialHealth,
    },
  ];

  return (
    <section className="rounded-2xl border border-slate-800 bg-[#09111C] p-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/10 p-3">
              <Award className="h-6 w-6 text-[#16BFFF]" />
            </div>

            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#16BFFF]">
                Executive Performance
              </p>

              <h2 className="mt-1 text-xl font-semibold text-white">
                Executive Score
              </h2>
            </div>
          </div>

          <p className="mt-4 max-w-xl text-sm leading-6 text-slate-500">
            A weighted score based on connected operational, driver, and
            financial performance.
          </p>
        </div>

        <div className="flex items-end gap-5">
          <div className="text-right">
            <p className="text-5xl font-bold text-white">{grade}</p>

            <p className={`mt-2 text-sm font-semibold ${status.color}`}>
              {status.label}
            </p>
          </div>

          <div className="border-l border-slate-800 pl-5">
            <p className="text-4xl font-bold text-white">{score}</p>

            <p className="mt-1 text-xs uppercase tracking-wider text-slate-500">
              Out of 100
            </p>
          </div>
        </div>
      </div>

      <div className="mt-7">
        <div className="h-3 overflow-hidden rounded-full bg-slate-800">
          <div
            className={`h-full rounded-full ${status.bar} transition-all duration-700`}
            style={{ width: `${score}%` }}
          />
        </div>
      </div>

      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {categories.map((category) => {
          const categoryScore = clampScore(category.score);

          return (
            <div
              key={category.title}
              className="rounded-xl border border-slate-800 bg-[#0B1522] p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {category.title}
                </p>

                <Gauge className="h-4 w-4 text-slate-600" />
              </div>

              <p className="mt-3 text-2xl font-bold text-white">
                {categoryScore}%
              </p>

              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div
                  className={
                    categoryScore >= 90
                      ? "h-full rounded-full bg-green-500"
                      : categoryScore >= 75
                        ? "h-full rounded-full bg-yellow-500"
                        : "h-full rounded-full bg-red-500"
                  }
                  style={{ width: `${categoryScore}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}