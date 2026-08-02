type Props = {
  score: number;
  dispatch: number;
  drivers: number;
  fleet: number | null;
  safety: number | null;
  financials: number;
};

type DepartmentHealth = {
  name: string;
  score: number | null;
};

export default function CompanyHealth({
  score,
  dispatch,
  drivers,
  fleet,
  safety,
  financials,
}: Props) {
  const departments: DepartmentHealth[] = [
    {
      name: "Dispatch",
      score: dispatch,
    },
    {
      name: "Drivers",
      score: drivers,
    },
    {
      name: "Fleet",
      score: fleet,
    },
    {
      name: "Safety",
      score: safety,
    },
    {
      name: "Financials",
      score: financials,
    },
  ];

  const safeScore = clampScore(score);

  const health =
    safeScore >= 95
      ? {
          label: "Excellent",
          textColor: "text-green-400",
          barColor: "bg-green-500",
          glow: "shadow-green-500/10",
        }
      : safeScore >= 80
        ? {
            label: "Healthy",
            textColor: "text-cyan-400",
            barColor: "bg-cyan-500",
            glow: "shadow-cyan-500/10",
          }
        : safeScore >= 65
          ? {
              label: "Needs Attention",
              textColor: "text-yellow-400",
              barColor: "bg-yellow-500",
              glow: "shadow-yellow-500/10",
            }
          : {
              label: "Critical",
              textColor: "text-red-400",
              barColor: "bg-red-500",
              glow: "shadow-red-500/10",
            };

  return (
    <section
      className={`rounded-2xl border border-slate-800 bg-[#09111C] p-6 shadow-xl ${health.glow}`}
    >
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#16BFFF]">
            Executive Health
          </p>

          <h2 className="mt-2 text-xl font-semibold text-white">
            Company Health
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Live operational health across connected departments.
          </p>
        </div>

        <div className="text-left sm:text-right">
          <p className="text-5xl font-bold tracking-tight text-white">
            {safeScore}%
          </p>

          <p className={`mt-2 text-sm font-semibold ${health.textColor}`}>
            {health.label}
          </p>
        </div>
      </div>

      <div className="mt-8">
        <div className="flex items-center justify-between gap-4 text-xs">
          <span className="uppercase tracking-[0.2em] text-slate-500">
            Overall Score
          </span>

          <span className={health.textColor}>
            {safeScore} of 100
          </span>
        </div>

        <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-800">
          <div
            className={`h-full rounded-full ${health.barColor} transition-all duration-700 ease-out`}
            style={{ width: `${safeScore}%` }}
          />
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {departments.map((department) => {
          const connected = department.score !== null;
          const departmentScore = clampScore(department.score ?? 0);

          const departmentHealth =
            !connected
              ? {
                  label: "Not Connected",
                  color: "text-slate-500",
                  border: "border-slate-800",
                  background: "bg-[#0B1522]",
                }
              : departmentScore >= 90
                ? {
                    label: "Healthy",
                    color: "text-green-400",
                    border: "border-green-500/20",
                    background: "bg-green-500/5",
                  }
                : departmentScore >= 75
                  ? {
                      label: "Needs Attention",
                      color: "text-yellow-400",
                      border: "border-yellow-500/20",
                      background: "bg-yellow-500/5",
                    }
                  : {
                      label: "Critical",
                      color: "text-red-400",
                      border: "border-red-500/20",
                      background: "bg-red-500/5",
                    };

          return (
            <div
              key={department.name}
              className={`rounded-xl border p-4 transition hover:-translate-y-0.5 ${departmentHealth.border} ${departmentHealth.background}`}
            >
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {department.name}
                </p>

                {connected && (
                  <span
                    className={`text-xs font-semibold ${departmentHealth.color}`}
                  >
                    {departmentScore}%
                  </span>
                )}
              </div>

              <p
                className={`mt-3 text-sm font-semibold ${departmentHealth.color}`}
              >
                {departmentHealth.label}
              </p>

              <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-800">
                <div
                  className={`h-full rounded-full ${
                    connected
                      ? departmentScore >= 90
                        ? "bg-green-500"
                        : departmentScore >= 75
                          ? "bg-yellow-500"
                          : "bg-red-500"
                      : "bg-slate-700"
                  }`}
                  style={{
                    width: connected ? `${departmentScore}%` : "0%",
                  }}
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