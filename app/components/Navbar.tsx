"use client";

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

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

  const navLink = (href: string, icon: string, label: string) => {
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
        <span>{icon}</span>
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

          {email && (
            <p className="text-sm text-slate-400">Logged in as {email}</p>
          )}
        </div>

        <button
          onClick={() => setOpen(true)}
          className="rounded-lg bg-slate-800 px-4 py-2 hover:bg-slate-700"
        >
          ☰ Menu
        </button>
      </div>

      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/60"
        />
      )}

      <div
        className={`fixed left-0 top-0 z-50 h-full w-72 transform border-r border-slate-800 bg-[#07101A] p-6 text-white shadow-xl transition-transform duration-300 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-8 flex items-center justify-between">
          <h2 className="text-xl font-bold">
            TRACON <span className="text-blue-500 font-light">NEXUS</span>
          </h2>

          <button
            onClick={() => setOpen(false)}
            className="rounded bg-slate-800 px-3 py-1 hover:bg-slate-700"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {navLink("/dispatch", "📋", "Dispatch")}
          {navLink("/settings", "👨‍✈️", "Drivers")}
          {navLink("/settings/users", "👥", "Users & Roles")}
        </div>

        <div className="absolute bottom-6 left-6 right-6">
          {email && (
            <p className="mb-3 break-all text-xs text-slate-400">{email}</p>
          )}

          <button
            onClick={logout}
            className="w-full rounded-lg bg-red-600 px-4 py-3 text-left hover:bg-red-500"
          >
            🚪 Logout
          </button>
        </div>
      </div>
    </>
  );
}