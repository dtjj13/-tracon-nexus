
import {
  FileWarning,
  TrendingDown,
  FileX2,
  PackageCheck,
} from "lucide-react";

type Props = {
  missingPODs: number;
  negativeProfitLoads: number;
  missingRateCons: number;
  deliveredToday: number;
};

export default function TodaysFocus({
  missingPODs,
  negativeProfitLoads,
  missingRateCons,
  deliveredToday,
}: Props) {
  const items = [
    {
      title: "Missing PODs",
      value: missingPODs,
      description: "Delivered loads waiting on proof of delivery",
      icon: FileWarning,
      color: "text-red-400",
      border: "border-red-500/30",
      background: "bg-red-500/5",
    },
    {
      title: "Negative Profit Loads",
      value: negativeProfitLoads,
      description: "Loads currently showing a negative margin",
      icon: TrendingDown,
      color: "text-red-400",
      border: "border-red-500/30",
      background: "bg-red-500/5",
    },
    {
      title: "Missing Rate Confirmations",
      value: missingRateCons,
      description: "Loads missing an uploaded rate confirmation",
      icon: FileX2,
      color: "text-yellow-400",
      border: "border-yellow-500/30",
      background: "bg-yellow-500/5",
    },
    {
      title: "Delivered Today",
      value: deliveredToday,
      description: "Loads completed during the current day",
      icon: PackageCheck,
      color: "text-green-400",
      border: "border-green-500/30",
      background: "bg-green-500/5",
    },
  ];

  return (
    <section>
      <div className="mb-4 flex items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-[#16BFFF]">
            Attention Required
          </p>

          <h2 className="mt-1 text-lg font-semibold text-white">
            Today&apos;s Focus
          </h2>
        </div>

        <p className="hidden text-sm text-slate-500 sm:block">
          What needs attention right now
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => {
          const Icon = item.icon;

          return (
            <div
              key={item.title}
              className={`rounded-2xl border p-5 ${item.border} ${item.background}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="rounded-xl border border-slate-800 bg-[#0B1522] p-2">
                  <Icon className={`h-5 w-5 ${item.color}`} />
                </div>

                <span className={`text-3xl font-bold ${item.color}`}>
                  {item.value}
                </span>
              </div>

              <h3 className="mt-4 text-sm font-semibold text-white">
                {item.title}
              </h3>

              <p className="mt-2 text-xs leading-5 text-slate-500">
                {item.description}
              </p>

              <button
                type="button"
                className="mt-4 text-xs font-semibold text-[#16BFFF] transition hover:text-cyan-300"
              >
                Review →
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}