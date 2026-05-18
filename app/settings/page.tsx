"use client";

import Link from "next/link";
import Navbar from "../components/Navbar";
import { Building2, Truck, Users, UserCog, Fuel, ChevronRight } from "lucide-react";

const cards = [
  { title: "Company", href: "/settings/company", icon: Building2 },
  { title: "Drivers", href: "/settings/drivers", icon: Users },
  { title: "Trucks", href: "/settings/trucks", icon: Truck },
  { title: "Users & Roles", href: "/settings/users", icon: UserCog },
  { title: "Pay & Fuel", href: "/settings/pay", icon: Fuel },
];

export default function SettingsPage() {
  return (
    <div className="min-h-screen bg-[#020617] p-3 text-white sm:p-6">
      <div className="space-y-6">
        <Navbar />

        <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-[#07101A] to-[#050A11] p-5">
          <h1 className="text-xl font-semibold text-white">Settings</h1>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {cards.map((card) => {
            const Icon = card.icon;

            return (
              <Link
                key={card.href}
                href={card.href}
                className="group flex items-center justify-between rounded-2xl border border-slate-800 bg-[#07101A] p-5 transition hover:-translate-y-1 hover:border-[#16BFFF]/60 hover:shadow-[0_0_24px_rgba(22,191,255,0.12)]"
              >
                <div className="flex items-center gap-4">
                  <div className="rounded-xl border border-[#16BFFF]/30 bg-[#16BFFF]/10 p-3 text-[#16BFFF]">
                    <Icon size={22} />
                  </div>

                  <h2 className="text-lg font-semibold text-white">
                    {card.title}
                  </h2>
                </div>

                <ChevronRight
                  size={20}
                  className="text-slate-600 transition group-hover:translate-x-1 group-hover:text-[#16BFFF]"
                />
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}