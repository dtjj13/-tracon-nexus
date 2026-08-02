import { BrainCircuit, ArrowRight } from "lucide-react";


export default function ExecutiveAI() {
  return (
    <section className="rounded-2xl border border-cyan-500/20 bg-gradient-to-r from-cyan-500/10 to-blue-500/5 p-6">

      <div className="flex items-start gap-4">

        <div className="rounded-xl bg-cyan-500/20 p-3">
          <BrainCircuit className="h-7 w-7 text-cyan-400" />
        </div>

        <div className="flex-1">

          <p className="text-xs uppercase tracking-[0.25em] text-cyan-400">
            AI Executive Brief
          </p>

          <h2 className="mt-2 text-2xl font-semibold text-white">
            Good Evening, Derrick
          </h2>

          <p className="mt-4 leading-7 text-slate-300">
            Company Health is currently
            <span className="font-semibold text-white"> 92%</span>.
            Fleet has
            <span className="font-semibold text-yellow-400"> 2 Maintenance Items</span>
            due this week.
            One load is operating at a
            <span className="font-semibold text-red-400"> Negative Profit</span>.
            Revenue at risk is currently
            <span className="font-semibold text-cyan-400"> $0</span>.
          </p>

          <div className="mt-5 rounded-xl border border-cyan-500/20 bg-black/20 p-4">

            <p className="text-sm font-semibold text-cyan-400">
              Recommended Action
            </p>

            <p className="mt-2 text-slate-300">
              Review Fleet Maintenance before Dispatch today.
            </p>

          </div>

          <button
            className="mt-5 flex items-center gap-2 text-cyan-400 hover:text-cyan-300"
          >
            Open AI Executive
            <ArrowRight className="h-4 w-4" />
          </button>

        </div>

      </div>

    </section>
  );
}