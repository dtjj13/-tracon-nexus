import Navbar from "../components/Navbar";

const reportCards = [
  {
    title: "Profitability",
    description:
      "Review revenue, operating expenses, profit margins, and load performance.",
    status: "Coming next",
  },
  {
    title: "Lane Performance",
    description:
      "Compare outbound and return lanes using saved TRACON load history.",
    status: "Preparing data",
  },
  {
    title: "Driver Pay",
    description:
      "Summarize driver earnings by load, pay method, and reporting period.",
    status: "Coming next",
  },
  {
    title: "Fleet Utilization",
    description:
      "Measure active trucks, loaded miles, deadhead, and equipment usage.",
    status: "Preparing data",
  },
];

export default function ReportsPage() {
  return (
    <main className="min-h-screen bg-[#020617] px-4 py-3 text-white sm:px-6 sm:py-6">
      <div className="mx-auto max-w-[1600px] space-y-6">
        <Navbar />

        <section className="overflow-hidden rounded-3xl border border-cyan-500/20 bg-[#07101d]">
          <div className="flex flex-col gap-6 border-b border-slate-800 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-cyan-400">
                Business intelligence
              </p>

              <h1 className="mt-3 text-3xl font-bold sm:text-4xl">
                Reports &amp; Intelligence
              </h1>

              <p className="mt-3 max-w-3xl leading-7 text-slate-400">
                Turn TRACON operational and financial data into clear reports
                for profitability, lanes, drivers, and fleet performance.
              </p>
            </div>

            <a
              href="/owner"
              className="inline-flex min-h-12 items-center justify-center rounded-xl border border-slate-700 bg-slate-900/60 px-5 py-3 text-sm font-semibold text-slate-200 transition hover:border-cyan-500/50 hover:text-cyan-300"
            >
              ← Back to Owner
            </a>
          </div>

          <div className="p-6 sm:p-8">
            <div className="rounded-2xl border border-amber-500/25 bg-amber-500/5 p-5">
              <p className="text-sm font-semibold text-amber-300">
                Reporting data connections are being prepared
              </p>

              <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
                This page will use saved loads, financial settings, driver pay,
                and fleet activity. No report will present estimated information
                as verified company data.
              </p>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {reportCards.map((report) => (
                <article
                  key={report.title}
                  className="rounded-2xl border border-slate-800 bg-[#091321] p-6 transition hover:border-cyan-500/30"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-xl font-semibold text-white">
                        {report.title}
                      </h2>

                      <p className="mt-3 leading-6 text-slate-400">
                        {report.description}
                      </p>
                    </div>

                    <span className="shrink-0 rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
                      {report.status}
                    </span>
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-6 rounded-2xl border border-slate-800 bg-[#091321] p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-400">
                Planned reporting foundation
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-3">
                <ReportFoundation
                  label="Company history"
                  value="Completed loads and saved cost snapshots"
                />
                <ReportFoundation
                  label="Live operations"
                  value="Dispatch, drivers, tracking, and fleet activity"
                />
                <ReportFoundation
                  label="Future intelligence"
                  value="Lane-market comparisons and decision-engine trends"
                />
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function ReportFoundation({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-slate-800 bg-[#050d18] p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-sm leading-6 text-slate-300">{value}</p>
    </div>
  );
}