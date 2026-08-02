import {
  DollarSign,
  TrendingUp,
  Truck,
  Users,
  TriangleAlert,
} from "lucide-react";

type Props = {
  revenue: number;
  profit: number;
  activeLoads: number;
  activeDrivers: number;
  revenueAtRisk: number;
};

export default function TodaysBusiness({
  revenue,
  profit,
  activeLoads,
  activeDrivers,
  revenueAtRisk,
}: Props) {
  const cards = [
  {
    title: "Revenue",
    value: `$${revenue.toLocaleString()}`,
    color: "text-green-400",
    icon: DollarSign,
  },
  {
    title: "Profit",
    value: `$${profit.toLocaleString()}`,
    color: profit >= 0 ? "text-cyan-400" : "text-red-400",
    icon: TrendingUp,
  },
  {
    title: "Active Loads",
    value: activeLoads,
    color: "text-white",
    icon: Truck,
  },
  {
    title: "Active Drivers",
    value: activeDrivers,
    color: "text-white",
    icon: Users,
  },
  {
    title: "Revenue At Risk",
    value: `$${revenueAtRisk.toLocaleString()}`,
    color: "text-red-400",
    icon: TriangleAlert,
  },
];

  return (
    <section>
      <h2 className="mb-4 text-lg font-semibold text-white">
        Today's Business
      </h2>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
       {cards.map((card) => {
  const Icon = card.icon;

  return (
    <div
      key={card.title}
      className="rounded-2xl border border-slate-800 bg-[#07101A] p-5"
    >
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-widest text-slate-500">
          {card.title}
        </p>

        <div className="rounded-xl border border-slate-800 bg-[#0B1522] p-2">
          <Icon className="h-4 w-4 text-[#16BFFF]" />
        </div>
      </div>

      <p className={`mt-3 text-3xl font-bold ${card.color}`}>
        {card.value}
      </p>
    </div>
  );
})}
      </div>
    </section>
  );
}