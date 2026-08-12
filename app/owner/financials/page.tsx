"use client";

import { Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import Navbar from "@/app/components/Navbar";
import FinancialSettings from "@/app/components/owner/FinancialSettings";
import { hasRole } from "@/app/lib/getUserRole";

export default function OwnerFinancialSettingsPage() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    let mounted = true;

    const checkAccess = async () => {
      const allowed = await hasRole(["owner", "admin"]);

      if (!allowed) {
        router.replace("/dispatch");
        return;
      }

      if (mounted) setAuthorized(true);
    };

    void checkAccess();

    return () => {
      mounted = false;
    };
  }, [router]);

  if (!authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020617] text-slate-400">
        <Loader2 className="mr-3 h-5 w-5 animate-spin text-cyan-400" />
        Confirming owner access…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#020617] p-3 text-white sm:p-6">
      <div className="mx-auto w-full max-w-[1500px]">
        <Navbar />

        <div className="mb-5 flex items-center gap-2 text-sm text-slate-500">
          <Link href="/owner" className="transition hover:text-cyan-300">
            Owner Dashboard
          </Link>
          <span aria-hidden="true">/</span>
          <span className="text-slate-300">Financial Settings</span>
        </div>

        <FinancialSettings />
      </div>
    </div>
  );
}
