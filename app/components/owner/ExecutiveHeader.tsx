

type ExecutiveHeaderProps = {
  activeLoads: number;
  activeDrivers: number;
};

export default function ExecutiveHeader({
  activeLoads,
  activeDrivers,
}: ExecutiveHeaderProps) {
  const currentDate = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date());

  return (
    <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-[#07101A] via-[#06111D] to-[#020617] p-6 shadow-[0_0_40px_rgba(0,163,255,0.08)] sm:p-8">
      <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[#00A3FF]/10 blur-3xl" />
      <div className="absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-indigo-500/10 blur-3xl" />

      <div className="relative flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-[#16BFFF]/30 bg-[#16BFFF]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.25em] text-[#16BFFF]">
              Executive View
            </span>

            <span className="text-sm text-slate-500">{currentDate}</span>
          </div>

          <h1 className="mt-5 text-3xl font-semibold tracking-tight text-white sm:text-4xl xl:text-5xl">
            Executive Command Center
          </h1>

          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
            Real-time visibility into your fleet, drivers, finances, documents,
            and daily operations.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="min-w-[150px] rounded-2xl border border-slate-800 bg-[#0B1522]/80 px-4 py-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
              Active Loads
            </p>

            <p className="mt-2 text-2xl font-bold text-[#16BFFF]">
              {activeLoads}
            </p>
          </div>

          <div className="min-w-[150px] rounded-2xl border border-slate-800 bg-[#0B1522]/80 px-4 py-4">
            <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">
              Active Drivers
            </p>

            <p className="mt-2 text-2xl font-bold text-[#16BFFF]">
              {activeDrivers}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}