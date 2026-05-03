"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabase";
import Navbar from "../components/Navbar";

type Driver = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  carrier?: string;
  active: boolean;
};

export default function SettingsPage() {
  const router = useRouter();

  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    carrier: "Twelve 10 Logistics",
  });

  const checkAccess = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.email) {
      router.push("/login");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("email", user.email)
      .single();

    if (profile?.role !== "dispatcher" && profile?.role !== "owner") {
      alert("You do not have access to settings.");
      router.push("/driver");
    }
  };

  const fetchDrivers = async () => {
    const { data, error } = await supabase
      .from("drivers")
      .select("*")
      .order("name", { ascending: true });

    if (error) return alert(error.message);

    setDrivers(data || []);
  };

  useEffect(() => {
    checkAccess();
    fetchDrivers();
  }, []);

  const addDriver = async () => {
    if (!form.name || !form.email) {
      alert("Driver name and email are required");
      return;
    }

    const { error } = await supabase.from("drivers").insert([
      {
        name: form.name,
        email: form.email,
        phone: form.phone,
        carrier: form.carrier,
        active: true,
      },
    ]);

    if (error) return alert(error.message);

    setForm({
      name: "",
      email: "",
      phone: "",
      carrier: "Twelve 10 Logistics",
    });

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
    <div className="min-h-screen bg-[#050A11] text-white p-6">
      <Navbar />

      <p className="text-slate-400 mt-2">Settings / Driver Management</p>

      <div className="mt-6 rounded-xl border border-slate-800 bg-[#07101A] p-5">
        <h2 className="text-xl font-bold">Add Driver</h2>

        <div className="mt-4 grid grid-cols-4 gap-3">
          <input
            placeholder="Driver Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="bg-[#0B1522] p-2 rounded border border-slate-700"
          />

          <input
            placeholder="Driver Email"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            className="bg-[#0B1522] p-2 rounded border border-slate-700"
          />

          <input
            placeholder="Phone"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="bg-[#0B1522] p-2 rounded border border-slate-700"
          />

          <input
            placeholder="Carrier"
            value={form.carrier}
            onChange={(e) => setForm({ ...form, carrier: e.target.value })}
            className="bg-[#0B1522] p-2 rounded border border-slate-700"
          />
        </div>

        <button onClick={addDriver} className="mt-4 bg-blue-600 px-4 py-2 rounded">
          + Add Driver
        </button>
      </div>

      <div className="mt-8 rounded-xl border border-slate-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#0B1522] text-slate-400">
            <tr>
              <th className="text-left p-4">Name</th>
              <th className="text-left p-4">Email</th>
              <th className="text-left p-4">Phone</th>
              <th className="text-left p-4">Carrier</th>
              <th className="text-left p-4">Status</th>
              <th className="text-left p-4">Action</th>
            </tr>
          </thead>

          <tbody>
            {drivers.map((driver) => (
              <tr key={driver.id} className="border-t border-slate-800">
                <td className="p-4">{driver.name}</td>
                <td className="p-4">{driver.email}</td>
                <td className="p-4">{driver.phone || "-"}</td>
                <td className="p-4">{driver.carrier || "-"}</td>
                <td className="p-4">
                  {driver.active ? (
                    <span className="text-green-400">Active</span>
                  ) : (
                    <span className="text-red-400">Inactive</span>
                  )}
                </td>
                <td className="p-4">
                  <button
                    onClick={() => toggleDriver(driver)}
                    className="text-blue-400 underline"
                  >
                    {driver.active ? "Deactivate" : "Activate"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
