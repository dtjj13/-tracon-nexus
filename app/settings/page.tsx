"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../components/Navbar";
import { supabase } from "../lib/supabase";
import { hasRole } from "../lib/getUserRole";

type Driver = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  carrier?: string;
  active: boolean;
  pay_type?: string;
  pay_rate?: number;
  truck_mpg?: number;
};

type CompanySettings = {
  id: string;
  company_name?: string;
  company_logo_url?: string;
};

export default function SettingsPage() {
  const router = useRouter();

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [companyName, setCompanyName] = useState("Twelve 10 Logistics");
  const [editingDriverId, setEditingDriverId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    carrier: "Twelve 10 Logistics",
    pay_type: "CPM",
    pay_rate: "",
    truck_mpg: "",
  });

  useEffect(() => {
    const checkRole = async () => {
      const allowed = await hasRole(["owner", "admin", "dispatcher", "manager"]);
      if (!allowed) router.push("/driver");
    };

    checkRole();
    fetchDrivers();
    fetchCompany();

    const channel = supabase
      .channel("settings-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "drivers" }, () =>
        fetchDrivers()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "company_settings" },
        () => fetchCompany()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [router]);

  const fetchCompany = async () => {
    const { data, error } = await supabase
      .from("company_settings")
      .select("*")
      .limit(1)
      .single();

    if (!error && data) {
      setCompany(data);
      setCompanyName(data.company_name || "Twelve 10 Logistics");
    }
  };

  const saveCompanyName = async () => {
  if (!company) {
    const { error } = await supabase.from("company_settings").insert([
      {
        company_name: companyName || "Twelve 10 Logistics",
        company_logo_url: "",
      },
    ]);

    if (error) return alert(error.message);

    await fetchCompany();
    alert("Company settings created");
    return;
  }

  const { error } = await supabase
    .from("company_settings")
    .update({ company_name: companyName })
    .eq("id", company.id);

  if (error) return alert(error.message);

  await fetchCompany();
  alert("Company name saved");
};

  const uploadCompanyLogo = async (file: File | null) => {
  if (!file) return;

  let currentCompany = company;

  if (!currentCompany) {
    const { data, error } = await supabase
      .from("company_settings")
      .insert([
        {
          company_name: companyName || "Twelve 10 Logistics",
          company_logo_url: "",
        },
      ])
      .select()
      .single();

    if (error) return alert(error.message);

    currentCompany = data;
    setCompany(data);
  }

  const fileName = `company-logo-${Date.now()}-${file.name}`;

  const { error: uploadError } = await supabase.storage
    .from("branding")
    .upload(fileName, file, { upsert: true });

  if (uploadError) return alert(uploadError.message);

  const { data } = supabase.storage.from("branding").getPublicUrl(fileName);
if (!currentCompany?.id) {
  alert("Company settings not found. Save company name first.");
  return;
}
  const { error } = await supabase
    .from("company_settings")
    .update({ company_logo_url: data.publicUrl })
    .eq("id", currentCompany?.id);

  if (error) return alert(error.message);

  await fetchCompany();
  alert("Company logo uploaded");
};

  const fetchDrivers = async () => {
    const { data, error } = await supabase
      .from("drivers")
      .select("*")
      .order("name", { ascending: true });

    if (error) return alert(error.message);
    setDrivers(data || []);
  };

  const resetForm = () => {
    setEditingDriverId(null);
    setForm({
      name: "",
      email: "",
      phone: "",
      carrier: companyName || "Twelve 10 Logistics",
      pay_type: "CPM",
      pay_rate: "",
      truck_mpg: "",
    });
  };

  const startEdit = (driver: Driver) => {
    setEditingDriverId(driver.id);
    setForm({
      name: driver.name || "",
      email: driver.email || "",
      phone: driver.phone || "",
      carrier: driver.carrier || companyName || "Twelve 10 Logistics",
      pay_type: driver.pay_type || "CPM",
      pay_rate:
        driver.pay_rate !== undefined && driver.pay_rate !== null
          ? String(driver.pay_rate)
          : "",
      truck_mpg:
        driver.truck_mpg !== undefined && driver.truck_mpg !== null
          ? String(driver.truck_mpg)
          : "",
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const saveDriver = async () => {
    if (!form.name || !form.email) {
      alert("Driver name and email are required");
      return;
    }

    const driverPayload = {
      name: form.name,
      email: form.email,
      phone: form.phone,
      carrier: form.carrier,
      pay_type: form.pay_type,
      pay_rate: Number(form.pay_rate || 0),
      truck_mpg: Number(form.truck_mpg || 0),
    };

    if (editingDriverId) {
      const { error } = await supabase
        .from("drivers")
        .update(driverPayload)
        .eq("id", editingDriverId);

      if (error) return alert(error.message);

      resetForm();
      fetchDrivers();
      return;
    }

    const { error } = await supabase.from("drivers").insert([
      {
        ...driverPayload,
        active: true,
      },
    ]);

    if (error) return alert(error.message);

    resetForm();
    fetchDrivers();
  };

  const toggleDriver = async (driver: Driver) => {
    const { error } = await supabase
      .from("drivers")
      .update({ active: !driver.active })
      .eq("id", driver.id);

    if (error) return alert(error.message);

    fetchDrivers();
  };

  return (
    <div className="min-h-screen bg-[#020617] p-3 text-white sm:p-6">
      <div className="space-y-6">
        <Navbar />

        <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-[#07101A] to-[#050A11] p-5 shadow-[0_0_30px_rgba(0,0,0,0.45)]">
          <p className="text-xs uppercase tracking-[0.3em] text-[#00A3FF]">
            Settings
          </p>
          <h1 className="mt-2 text-base uppercase tracking-[0.35em] text-white">
            Driver & Company Management
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Manage driver pay profiles and company branding.
          </p>
        </div>

        {/* COMPANY BRANDING */}
        <div className="rounded-2xl border border-slate-800 bg-[#07101A] p-5 shadow-[0_0_30px_rgba(0,0,0,0.45)]">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-white">Company Branding</h2>
              <p className="text-xs text-slate-500">
                Upload the carrier logo and company name shown inside the app.
              </p>
            </div>

            {company?.company_logo_url && (
              <img
                src={company.company_logo_url}
                alt={company.company_name || "Company Logo"}
                className="h-14 w-auto rounded-lg border border-slate-800 bg-[#020617] p-2"
              />
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input
              placeholder="Company Name"
              value={companyName}
              onChange={(value) => setCompanyName(value)}
            />

            <button
              onClick={saveCompanyName}
              className="rounded-xl border border-slate-700 bg-[#0B1522] px-4 py-2 text-sm text-white transition hover:border-[#00A3FF]"
            >
              Save Company Name
            </button>

            <label className="cursor-pointer rounded-xl bg-gradient-to-r from-[#1E6BFF] to-[#00A3FF] px-4 py-2 text-center text-sm font-semibold text-white shadow-[0_0_18px_rgba(30,107,255,0.45)] transition hover:scale-[1.01]">
              Upload Logo
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                className="hidden"
                onChange={(e) => uploadCompanyLogo(e.target.files?.[0] || null)}
              />
            </label>
          </div>
        </div>

        {/* DRIVER FORM */}
        <div className="rounded-2xl border border-slate-800 bg-[#07101A] p-5 shadow-[0_0_30px_rgba(0,0,0,0.45)]">
          <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold text-white">
                {editingDriverId ? "Edit Driver" : "Add Driver"}
              </h2>
              <p className="text-xs text-slate-500">
                {editingDriverId
                  ? "Update driver profile and pay rules"
                  : "Create a driver profile"}
              </p>
            </div>

            {editingDriverId && (
              <button
                onClick={resetForm}
                className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-300 transition hover:border-[#00A3FF] hover:text-white"
              >
                Cancel Edit
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              placeholder="Driver Name"
              value={form.name}
              onChange={(value) => setForm({ ...form, name: value })}
            />

            <Input
              placeholder="Driver Email"
              value={form.email}
              onChange={(value) => setForm({ ...form, email: value })}
            />

            <Input
              placeholder="Phone"
              value={form.phone}
              onChange={(value) => setForm({ ...form, phone: value })}
            />

            <Input
              placeholder="Carrier"
              value={form.carrier}
              onChange={(value) => setForm({ ...form, carrier: value })}
            />

            <select
              value={form.pay_type}
              onChange={(e) => setForm({ ...form, pay_type: e.target.value })}
              className="rounded-xl border border-slate-700 bg-[#0B1522] p-2 text-sm text-white outline-none transition focus:border-[#00A3FF]"
            >
              <option value="CPM">CPM / Per Mile</option>
              <option value="Percentage">Percentage</option>
              <option value="Flat">Flat Rate</option>
            </select>

            <Input
              placeholder="Pay Rate"
              value={form.pay_rate}
              onChange={(value) => setForm({ ...form, pay_rate: value })}
            />

            <Input
              placeholder="Truck MPG"
              value={form.truck_mpg}
              onChange={(value) => setForm({ ...form, truck_mpg: value })}
            />

            <button
              onClick={saveDriver}
              className="w-full rounded-xl bg-gradient-to-r from-[#1E6BFF] to-[#00A3FF] px-4 py-2 text-sm font-semibold text-white shadow-[0_0_18px_rgba(30,107,255,0.45)] transition hover:scale-[1.01] sm:w-auto"
            >
              {editingDriverId ? "Save Changes" : "+ Add Driver"}
            </button>
          </div>
        </div>

        {/* DRIVER TABLE */}
        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-[#07101A] shadow-[0_0_30px_rgba(0,0,0,0.45)]">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-[#0B1522] text-slate-400">
              <tr>
                <th className="p-4 text-left">Driver</th>
                <th className="p-4 text-left">Contact</th>
                <th className="p-4 text-left">Carrier</th>
                <th className="p-4 text-left">Pay Type</th>
                <th className="p-4 text-left">Pay Rate</th>
                <th className="p-4 text-left">Truck MPG</th>
                <th className="p-4 text-left">Status</th>
                <th className="p-4 text-left">Actions</th>
              </tr>
            </thead>

            <tbody>
              {drivers.map((driver) => (
                <tr key={driver.id} className="border-t border-slate-800">
                  <td className="p-4">
                    <p className="font-semibold text-white">{driver.name}</p>
                    <p className="text-xs text-slate-500">{driver.email}</p>
                  </td>

                  <td className="p-4">{driver.phone || "-"}</td>
                  <td className="p-4">{driver.carrier || "-"}</td>
                  <td className="p-4">{driver.pay_type || "-"}</td>
                  <td className="p-4">
                    {formatPay(driver.pay_type, driver.pay_rate)}
                  </td>
                  <td className="p-4">
                    {driver.truck_mpg ? `${driver.truck_mpg} MPG` : "-"}
                  </td>

                  <td className="p-4">
                    {driver.active ? (
                      <span className="text-green-400">Active</span>
                    ) : (
                      <span className="text-red-400">Inactive</span>
                    )}
                  </td>

                  <td className="p-4">
                    <div className="flex gap-3">
                      <button
                        onClick={() => startEdit(driver)}
                        className="text-[#00A3FF] underline"
                      >
                        Edit
                      </button>

                      <button
                        onClick={() => toggleDriver(driver)}
                        className={
                          driver.active
                            ? "text-red-400 underline"
                            : "text-green-400 underline"
                        }
                      >
                        {driver.active ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {drivers.length === 0 && (
                <tr>
                  <td colSpan={8} className="p-6 text-center text-slate-500">
                    No drivers added yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Input({
  placeholder,
  value,
  onChange,
}: {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-xl border border-slate-700 bg-[#0B1522] p-2 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-[#00A3FF]"
    />
  );
}

function formatPay(payType?: string, payRate?: number) {
  if (!payRate) return "-";

  if (payType === "CPM") return `$${payRate.toFixed(2)} / mi`;
  if (payType === "Percentage") return `${payRate}%`;
  if (payType === "Flat") return `$${payRate.toLocaleString()}`;

  return payRate;
}