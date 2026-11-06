"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BrainCircuit,
  ClipboardCheck,
  LayoutDashboard,
  MapPinned,
  Settings,
  Truck,
  Menu,
  X,
  LogOut,
  Bell,
  BarChart3,
  Building2,
  DollarSign,
  ShieldCheck,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import { getUserRole, type UserRole } from "../lib/getUserRole";

type CompanySettings = {
  company_name?: string;
  company_logo_url?: string;
};

type Notification = {
  id: string;
  title: string;
  message?: string;
  type?: string;
  read: boolean;
  created_at: string;
};

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();

  const [email, setEmail] = useState("");
  const [open, setOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [role, setRole] = useState<UserRole | null>(null);

  const fetchNotifications = useCallback(async () => {
    const { data, error } = await supabase
      .from("notifications")
      .select("id,title,message,type,read,created_at")
      .order("created_at", { ascending: false })
      .limit(10);

    if (!error) setNotifications(data || []);
  }, []);

  useEffect(() => {
    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setEmail(user?.email || "");
      setRole(await getUserRole());
    };

    const getCompany = async () => {
      const { data, error } = await supabase
        .from("company_settings")
        .select("*")
        .limit(1)
        .single();

      if (!error) setCompany(data);
    };

    getUser();
    getCompany();

    const handleCompanyUpdated = (event: Event) => {
      const detail = (event as CustomEvent<CompanySettings>).detail;
      if (detail) setCompany(detail);
    };

    window.addEventListener("tracon:company-updated", handleCompanyUpdated);

    return () => {
      window.removeEventListener(
        "tracon:company-updated",
        handleCompanyUpdated
      );
    };
  }, []);

  const canViewOperationalAlerts =
    role === "owner" ||
    role === "admin" ||
    role === "dispatcher" ||
    role === "manager";

  useEffect(() => {
    if (!canViewOperationalAlerts) {
      return;
    }

    // Initial alert hydration is intentionally performed after role resolution.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchNotifications();

    const channel = supabase
      .channel("navbar-notifications")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        () => void fetchNotifications()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [canViewOperationalAlerts, fetchNotifications]);

  useEffect(() => {
    if (!open && !notificationsOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function closeDrawer(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      setNotificationsOpen(false);
    }

    document.addEventListener("keydown", closeDrawer);
    return () => {
      document.removeEventListener("keydown", closeDrawer);
      document.body.style.overflow = previousOverflow;
    };
  }, [notificationsOpen, open]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = async () => {
    const unreadIds = notifications.filter((n) => !n.read).map((n) => n.id);

    if (unreadIds.length === 0) return;

    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .in("id", unreadIds);

    if (!error) fetchNotifications();
  };

  const logout = async () => {
    await supabase.auth.signOut();
    router.push("/login");
  };

  const navLink = (href: string, icon: ReactNode, label: string) => {
    const active =
      href === "/owner"
        ? pathname === href
        : pathname === href || pathname.startsWith(`${href}/`);

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

  const canView = (allowedRoles: UserRole[]) =>
    role !== null && allowedRoles.includes(role);

  const homeHref = role ? (
    role === "owner" || role === "admin" ? "/owner" :
    role === "dispatcher" || role === "manager" ? "/dispatch" :
    role === "driver" ? "/driver" :
    role === "safety" ? "/settings/safety" :
    role === "payroll" ? "/settings/pay" : "/settings/trucks"
  ) : "/login";

  return (
    <>
      <div className="mb-6 border-b border-slate-800 pb-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link href={homeHref} className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              {company?.company_logo_url ? (
                <Image
                  src={company.company_logo_url}
                  alt={company.company_name || "Carrier Logo"}
                  width={180}
                  height={48}
                  unoptimized
                  className="h-12 w-auto rounded-lg object-contain"
                />
              ) : (
                <div className="flex h-12 min-w-12 items-center justify-center rounded-xl border border-slate-700 bg-[#07101A] px-3 text-sm font-semibold text-white">
                  {company?.company_name || "Twelve 10 Logistics"}
                </div>
              )}
            </div>

            <div className="hidden h-10 w-px bg-slate-700 sm:block" />

            <Image
              src="/logo-wordmark.svg"
              alt="Tracon Nexus"
              width={210}
              height={58}
              className="h-auto w-[210px]"
              priority
            />
          </Link>

          <div className="flex items-center gap-3">
            {email && (
              <p className="hidden max-w-[220px] truncate text-xs text-slate-400 sm:block">
                {email}
              </p>
            )}

            {canViewOperationalAlerts && (
              <button
                type="button"
                onClick={() => setNotificationsOpen(true)}
                aria-label="Open notifications"
                aria-expanded={notificationsOpen}
                aria-controls="notification-drawer"
                className="relative flex items-center justify-center rounded-xl border border-slate-700 bg-[#07101A] px-3 py-2 text-white shadow-[0_0_12px_rgba(30,107,255,0.15)] transition hover:border-[#00A3FF] hover:bg-slate-800"
              >
                <Bell size={20} />

                {unreadCount > 0 && (
                  <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                    {unreadCount}
                  </span>
                )}
              </button>
            )}

            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-expanded={open}
              aria-controls="navigation-drawer"
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-[#07101A] px-4 py-2 text-sm text-white shadow-[0_0_12px_rgba(30,107,255,0.15)] transition hover:border-[#00A3FF] hover:bg-slate-800 sm:w-auto"
            >
              <Menu size={20} />
              <span>Menu</span>
            </button>
          </div>
        </div>

        <div className="mt-4 h-[1px] w-full bg-gradient-to-r from-transparent via-[#1E6BFF]/40 to-transparent" />
      </div>

      {/* MENU OVERLAY */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
        />
      )}

      <div
        id="navigation-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        aria-hidden={!open}
        inert={!open}
        className={`fixed left-0 top-0 z-50 h-full w-80 max-w-[85vw] border-r border-slate-800 bg-[#07101A] p-6 text-white shadow-2xl transition-transform duration-300 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-8 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-[#16BFFF]">
              {company?.company_name || "Twelve 10 Logistics"}
            </p>

            <Image
              src="/logo-wordmark.svg"
              alt="Tracon Nexus"
              width={200}
              height={55}
              className="mt-2 h-auto w-[200px]"
            />
          </div>

          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close navigation menu"
            className="rounded-xl bg-slate-800 px-3 py-2 transition hover:bg-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        {canView(["owner", "admin"]) && navLink(
          "/owner",
          <LayoutDashboard size={18} />,
          "Owner Dashboard"
        )}

        {canView(["owner", "admin", "dispatcher", "manager"]) && navLink(
          "/dispatch",
          <Truck size={18} />,
          "Dispatch Board"
        )}

        {canView(["owner", "admin", "driver"]) && navLink(
          "/driver",
          <Truck size={18} />,
          "My Loads"
        )}

        {canView(["owner", "admin", "driver"]) && navLink(
          "/driver/dvir",
          <ClipboardCheck size={18} />,
          "DVIR Inspection"
        )}

        {canView(["owner", "admin", "dispatcher", "manager"]) && navLink(
          "/load-decision",
          <BrainCircuit size={18} />,
          "Load Decision Engine"
        )}

        {canView(["owner", "admin", "dispatcher", "manager"]) && navLink(
          "/maps",
          <MapPinned size={18} />,
          "Tracon Maps"
        )}

        {canView(["owner", "admin", "manager"]) && navLink(
          "/owner/fleet-tracking",
          <MapPinned size={18} />,
          "Live Fleet Map"
        )}

        {canView(["owner", "admin", "manager"]) && navLink(
          "/settings/drivers",
          <Users size={18} />,
          "Drivers"
        )}

        {canView(["owner", "admin", "manager", "maintenance"]) && navLink(
          "/settings/trucks",
          <Truck size={18} />,
          "Trucks"
        )}

        {canView(["owner", "admin", "manager", "maintenance"]) && navLink(
          "/settings/maintenance",
          <Wrench size={18} />,
          "Maintenance"
        )}

        {canView(["owner", "admin", "manager", "safety"]) && navLink(
          "/settings/safety",
          <ShieldCheck size={18} />,
          "Safety & Compliance"
        )}

        {canView(["owner", "admin", "payroll"]) && navLink(
          "/settings/pay",
          <Wallet size={18} />,
          "Payroll Center"
        )}

        {canView(["owner", "admin", "manager"]) && navLink(
          "/reports",
          <BarChart3 size={18} />,
          "Reports & Intelligence"
        )}

        {canView(["owner", "admin"]) && navLink(
          "/owner/financials",
          <DollarSign size={18} />,
          "Financial Settings"
        )}

        {canView(["owner", "admin"]) && navLink(
          "/settings/company",
          <Building2 size={18} />,
          "Company Profile"
        )}

        {canView(["owner", "admin"]) && navLink(
          "/settings",
          <Settings size={18} />,
          "All Settings"
        )}

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

      {/* NOTIFICATION OVERLAY */}
      {notificationsOpen && (
        <div
          onClick={() => setNotificationsOpen(false)}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
        />
      )}

      <div
        id="notification-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Notifications"
        aria-hidden={!notificationsOpen}
        inert={!notificationsOpen}
        className={`fixed right-0 top-0 z-50 h-full w-96 max-w-[90vw] border-l border-slate-800 bg-[#07101A] p-6 text-white shadow-2xl transition-transform duration-300 ${
          notificationsOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="mb-6 flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-[#16BFFF]">
              Alerts
            </p>
            <h2 className="mt-2 text-xl font-semibold text-white">
              Notifications
            </h2>
          </div>

          <button
            type="button"
            onClick={() => setNotificationsOpen(false)}
            aria-label="Close notifications"
            className="rounded-xl bg-slate-800 px-3 py-2 transition hover:bg-slate-700"
          >
            <X size={18} />
          </button>
        </div>

        <button
          type="button"
          onClick={markAllRead}
          className="mb-4 w-full rounded-xl border border-slate-700 bg-[#0B1522] px-4 py-2 text-sm text-slate-300 transition hover:border-[#00A3FF] hover:text-white"
        >
          Mark All Read
        </button>

        <div className="space-y-3">
          {notifications.map((item) => (
            <div
              key={item.id}
              className={`rounded-2xl border p-4 ${
                item.read
                  ? "border-slate-800 bg-[#0B1522]"
                  : "border-[#16BFFF]/40 bg-[#16BFFF]/10"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-white">
                    {item.title}
                  </p>
                  {item.message && (
                    <p className="mt-1 text-xs text-slate-400">
                      {item.message}
                    </p>
                  )}
                </div>

                {!item.read && (
                  <span className="mt-1 h-2 w-2 rounded-full bg-[#16BFFF]" />
                )}
              </div>

              <p className="mt-3 text-[11px] text-slate-500">
                {formatTime(item.created_at)}
              </p>
            </div>
          ))}

          {notifications.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-800 p-6 text-center text-sm text-slate-500">
              No notifications yet.
            </div>
          )}
        </div>
      </div>

      <div className="fixed bottom-3 right-4 z-40 text-[11px] tracking-wide text-slate-600">
        TRACON Nexus
      </div>
    </>
  );
}

function formatTime(value?: string) {
  if (!value) return "";

  return new Date(value).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
