"use client";

import { useEffect, useState, type ReactNode } from "react";
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
        className={`flex items-center gap-3 rounded-lg px-4 py-3 transition ${
          active
            ? "bg-blue-600 text-white"
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
      <div className="mb-6 flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-3xl font-bold">
            TRACON <span className="text-blue-500 font-light">NEXUS</span>
          </h1>
          {email && <p className="text-sm text-slate-400">{email}</p>}
        </div>

        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 hover:bg-slate-700"
        >
          <Menu size={20} />
          <span>Menu</span>
        </button>
      </div>

      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/60"
        />
      )}

      <div
        className={`fixed left-0 top-0 z-50 h-full w-72 border-r border-slate-800 bg-[#07101A] p-6 text-white shadow-xl transition-transform duration-300 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-8 flex items-center justify-between">
          <h2 className="text-xl font-bold">
            TRACON <span className="text-blue-500 font-light">NEXUS</span>
          </h2>

          <button
            onClick={() => setOpen(false)}
            className="rounded bg-slate-800 px-3 py-2 hover:bg-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {navLink("/owner", <LayoutDashboard size={18} />, "Owner Dashboard")}
          {navLink("/dispatch", <Truck size={18} />, "Dispatch")}
          {navLink("/settings", <Settings size={18} />, "Drivers")}
          {navLink("/settings/users", <Users size={18} />, "Users & Roles")}
        </div>

        <div className="absolute bottom-6 left-6 right-6">
          <button
            onClick={logout}
            className="flex w-full items-center gap-3 rounded-lg bg-red-600 px-4 py-3 hover:bg-red-500"
          >
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </div>
    </>
  );
}