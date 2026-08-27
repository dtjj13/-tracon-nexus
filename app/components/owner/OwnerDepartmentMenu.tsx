"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  DollarSign,
  Settings,
  ShieldCheck,
  Truck,
  Users,
  Wallet,
  Wrench,
  MapPinned,
} from "lucide-react";

type Props = {
  dispatchCount: number;
  activeDrivers: number;
  maintenanceDue?: number | null;
  safetyAlerts?: number | null;
};

type MenuItem = {
  title: string;
  subtitle: string;
  href: string;
  icon: React.ElementType;
  status?: string;
  statusColor?: string;
};

type MenuSection = {
  title: string;
  items: MenuItem[];
};

export default function OwnerDepartmentMenu({
  dispatchCount,
  activeDrivers,
  maintenanceDue = null,
  safetyAlerts = null,
}: Props) {
  const pathname = usePathname();

  const menuSections: MenuSection[] = [
    {
      title: "Executive",
      items: [
        {
          title: "Overview",
          subtitle: "Executive dashboard",
          href: "/owner",
          icon: BarChart3,
        },
      ],
    },
    {
      title: "Operations",
      items: [
        {
          title: "Dispatch",
          subtitle: "Loads and operations",
          href: "/dispatch",
          icon: Truck,
          status: String(dispatchCount),
          statusColor:
            dispatchCount > 0 ? "text-cyan-400" : "text-slate-500",
        },
        {
  title: "Live Fleet Map",
  subtitle: "Driver locations and signals",
  href: "/owner/fleet-tracking",
  icon: MapPinned,
  status: "Live",
  statusColor: "text-green-400",
},
        {
          title: "Drivers",
subtitle: "Driver management and pay",
href: "/settings/drivers",
          icon: Users,
          status: String(activeDrivers),
          statusColor:
            activeDrivers > 0 ? "text-green-400" : "text-slate-500",
        },
        {
         title: "Trucks",
subtitle: "Truck and maintenance settings",
href: "/settings/trucks",
          icon: Wrench,
          status:
            maintenanceDue === null
              ? "Pending"
              : maintenanceDue > 0
                ? `${maintenanceDue} Due`
                : "Clear",
          statusColor:
            maintenanceDue === null
              ? "text-slate-500"
              : maintenanceDue > 0
                ? "text-yellow-400"
                : "text-green-400",
        },
        {
          title: "Safety",
          subtitle: "Compliance center",
          href: "/settings/safety",
          icon: ShieldCheck,
          status:
            safetyAlerts === null
              ? "Pending"
              : safetyAlerts > 0
                ? `${safetyAlerts} Alert${safetyAlerts === 1 ? "" : "s"}`
                : "Clear",
          statusColor:
            safetyAlerts === null
              ? "text-slate-500"
              : safetyAlerts > 0
                ? "text-red-400"
                : "text-green-400",
        },
      ],
    },
    {
      title: "Business",
      items: [
        {
          title: "Financial Settings",
          subtitle: "Company cost defaults",
          href: "/owner/financials",
          icon: DollarSign,
        },
        {
          title: "Payroll",
          subtitle: "Driver earnings by load",
          href: "/settings/pay",
          icon: Wallet,
        },
        {
          title: "Reports",
          subtitle: "Business intelligence",
          href: "/reports",
          icon: BarChart3,
        },
      ],
    },
    {
      title: "System",
      items: [
       {
  title: "Company",
  subtitle: "Company information",
  href: "/settings/company",
  icon: Building2,
},

{
  title: "Settings",
  subtitle: "System configuration",
  href: "/settings",
  icon: Settings,
},
      ],
    },
  ];

  const isActive = (href: string) => {
    if (href === "/owner") {
      return pathname === "/owner";
    }

    return pathname === href || pathname.startsWith(`${href}/`);
  };

  return (
    <aside className="rounded-2xl border border-slate-800 bg-[#07101A] p-4">
      <div className="border-b border-slate-800 px-2 pb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#16BFFF]">
          Departments
        </p>

        <h2 className="mt-2 text-xl font-semibold text-white">
          Owner Menu
        </h2>
      </div>

      <nav className="mt-5 space-y-7">
        {menuSections.map((section) => (
          <div key={section.title}>
            <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.3em] text-slate-500">
              {section.title}
            </p>

            <div className="space-y-2">
              {section.items.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);

                return (
                  <Link
                    key={item.title}
                    href={item.href}
                    className={`group relative flex items-center gap-4 overflow-hidden rounded-xl border px-4 py-5 transition-all duration-200 ${
                      active
                        ? "border-cyan-500/40 bg-cyan-500/10"
                        : "border-transparent hover:border-slate-700 hover:bg-[#0B1522]"
                    }`}
                  >
                    {active && (
                      <span className="absolute bottom-3 left-0 top-3 w-1 rounded-r-full bg-[#16BFFF]" />
                    )}

                    <div
                      className={`shrink-0 rounded-xl border p-2.5 ${
                        active
                          ? "border-cyan-500/30 bg-cyan-500/10"
                          : "border-slate-800 bg-[#09111C]"
                      }`}
                    >
                      <Icon
                        className={`h-5 w-5 ${
                          active
                            ? "text-[#16BFFF]"
                            : "text-slate-400 group-hover:text-[#16BFFF]"
                        }`}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="truncate text-base font-semibold text-white">
                          {item.title}
                        </p>

                        {item.status && (
                          <span
                            className={`shrink-0 text-xs font-semibold ${
                              item.statusColor || "text-slate-400"
                            }`}
                          >
                            {item.status}
                          </span>
                        )}
                      </div>

                      <p className="mt-1 truncate text-sm text-slate-500">
                        {item.subtitle}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}
