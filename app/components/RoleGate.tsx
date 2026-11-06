"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { getUserRole, type UserRole } from "../lib/getUserRole";

type RoleGateProps = {
  allowed: UserRole[];
  children: ReactNode;
};

function roleHome(role: UserRole) {
  if (role === "owner" || role === "admin") return "/owner";
  if (role === "dispatcher" || role === "manager") return "/dispatch";
  if (role === "driver") return "/driver";
  if (role === "safety") return "/settings/safety";
  if (role === "payroll") return "/settings/pay";
  return "/settings/trucks";
}

export default function RoleGate({
  allowed,
  children,
}: RoleGateProps) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const allowedKey = allowed.join(",");

  useEffect(() => {
    let active = true;

    async function verifyAccess() {
      const role = await getUserRole();
      const allowedRoles = allowedKey.split(",") as UserRole[];

      if (!active) return;

      if (role && allowedRoles.includes(role)) {
        setAuthorized(true);
        return;
      }

      router.replace(role ? roleHome(role) : "/login");
    }

    void verifyAccess();

    return () => {
      active = false;
    };
  }, [allowedKey, router]);

  if (!authorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#020617] p-6 text-sm text-slate-400">
        Verifying access…
      </div>
    );
  }

  return children;
}
