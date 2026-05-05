"use client";

import { useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Truck,
  Settings,
  Users,
  Menu,
  X,
  LogOut,
} from "lucide-react";
import { supabase } from "../lib/supabase";

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();

  const [email, setEmail] = useState("");
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setEmail(user?.email || "");
    };

    getUser();
  }, []);

  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const navLink = (href: string, icon: ReactNode, label: string) => {
    const active = pathname === href;

    return (
      <Link
        href={href}
        onClick={() => setOpen(false)}
        className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm transition ${
          active
            ? "bg-[#1E6BFF] text-white shadow-[0_0_18px_rgba(30,107,255,0.35)]"
            : "text-slate-300 hover:bg-slate-800 hover:text-white"
        }`}
      >
        {icon}
        <span>{label}</span>
      </Link>
    );
  };

  return (
    <>
      <div className="mb-6 border-b border-slate-800 pb-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/dispatch" className="flex items-center">
            <Image
              src="/logo-wordmark.svg"
              alt="Tracon Nexus"
              width={230}
              height={64}
              className="h-auto w-[230px]"
              priority
            />
          </Link>

          <div className="flex items-center gap-3">
            {email && (
              <p className="hidden max-w-[220px] truncate text-xs text-slate-400 sm:block">
                {email}
              </p>
            )}

            <button
              onClick={() => setOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-[#07101A] px-4 py-2 text-sm text-white shadow-[0_0_12px_rgba(30,107,255,0.15)] transition hover:border-[#00A3FF] hover:bg-slate-800 sm:w-auto"
            >
              <Menu size={20} />
              <span>Menu</span>
            </button>
          </div>
        </div>

        <div className="mt-4 h-[1px] w-full bg-gradient-to-r from-transparent via-[#1E6BFF]/40 to-transparent" />
      </div>

      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
        />
      )}

      <div
        className={`fixed left-0 top-0 z-50 h-full w-80 max-w-[85vw] border-r border-slate-800 bg-[#07101A] p-6 text-white shadow-2xl transition-transform duration-300 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-8 flex items-center justify-between">
          <Image
            src="/logo-wordmark.svg"
            alt="Tracon Nexus"
            width={230}
            height={64}
            className="h-auto w-[210px]"
          />

          <button
            onClick={() => setOpen(false)}
            className="rounded-xl bg-slate-800 px-3 py-2 transition hover:bg-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {navLink("/owner", <LayoutDashboard size={18} />, "Owner Dashboard")}
          {navLink("/dispatch", <Truck size={18} />, "Dispatch Board")}
          {navLink("/settings", <Settings size={18} />, "Drivers")}
          {navLink("/settings/users", <Users size={18} />, "Users & Roles")}
        </div>

        <div className="absolute bottom-6 left-6 right-6">
          {email && (
            <p className="mb-3 break-all text-xs text-slate-500">{email}</p>
          )}

          <button
            onClick={logout}
            className="flex w-full items-center justify-center gap-3 rounded-xl bg-red-600 px-4 py-3 text-sm font-semibold transition hover:bg-red-500"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </div>
    </>
  );
}