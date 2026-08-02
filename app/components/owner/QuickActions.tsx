import Link from "next/link";

import {
  ArrowRight,
  BarChart3,
  Landmark,
  Settings as SettingsIcon,
  ShieldCheck,
  Truck,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";

type QuickActionsProps = {
  showSubtitles?: boolean;
};

const departments = [
  {
    title: "Dispatch",
    subtitle: "Manage loads and operations",
    status: "3 Active Loads",
    icon: Truck,
    href: "/dispatch",
    statusColor: "text-cyan-400",
  },
  {
    title: "Drivers",
    subtitle: "Driver management",
    status: "1 Active Driver",
    icon: Users,
    href: "/drivers",
    statusColor: "text-cyan-400",
  },
  {
    title: "Fleet",
    subtitle: "Equipment and maintenance",
    status: "2 Services Due",
    icon: Wrench,
    href: "/fleet",
    statusColor: "text-yellow-400",
  },
  {
    title: "Safety",
    subtitle: "Compliance center",
    status: "1 Compliance Alert",
    icon: ShieldCheck,
    href: "/safety",
    statusColor: "text-red-400",
  },
  {
    title: "Payroll",
    subtitle: "Driver and employee pay",
    status: "Next Payroll: Friday",
    icon: Wallet,
    href: "/payroll",
    statusColor: "text-slate-300",
  },
  {
    title: "Financials",
    subtitle: "Company performance",
    status: "Profit: $2,787",
    icon: Landmark,
    href: "/financials",
    statusColor: "text-green-400",
  },
  {
    title: "Reports",
    subtitle: "Business intelligence",
    status: "View Company Reports",
    icon: BarChart3,
    href: "/reports",
    statusColor: "text-slate-300",
  },
  {
    title: "Settings",
    subtitle: "System configuration",
    status: "System Healthy",
    icon: SettingsIcon,
    href: "/settings",
    statusColor: "text-green-400",
  },
];

export default function QuickActions({
  showSubtitles = true,
}: QuickActionsProps) {
  return (
    <section>
      <div className="mb-5">
        <p className="text-xs uppercase tracking-[0.25em] text-[#16BFFF]">
          Executive Actions
        </p>

        <h2 className="mt-1 text-lg font-semibold text-white">
          Quick Actions
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          Jump directly to any department.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {departments.map((department) => {
          const Icon = department.icon;

          return (
            <Link
              key={department.title}
              href={department.href}
              className="group rounded-2xl border border-slate-800 bg-[#0B1522] p-5 transition-all duration-200 hover:-translate-y-1 hover:border-[#16BFFF] hover:shadow-lg hover:shadow-cyan-500/10"
            >
              <div className="flex items-center justify-between">
                <div className="rounded-xl border border-slate-800 bg-[#09111C] p-3">
                  <Icon className="h-6 w-6 text-[#16BFFF]" />
                </div>

                <ArrowRight className="h-5 w-5 text-slate-600 transition-all duration-200 group-hover:translate-x-1 group-hover:text-[#16BFFF]" />
              </div>

              <h3 className="mt-5 text-lg font-semibold text-white">
                {department.title}
              </h3>

              {showSubtitles && (
                <p className="mt-1 text-sm text-slate-500">
                  {department.subtitle}
                </p>
              )}

              <div className="mt-5 border-t border-slate-800 pt-4">
                <p className="text-xs uppercase tracking-wider text-slate-600">
                  Current Status
                </p>

                <p
                  className={`mt-1 text-sm font-semibold ${department.statusColor}`}
                >
                  {department.status}
                </p>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}