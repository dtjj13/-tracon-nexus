"use client";

import { useEffect, useState } from "react";
import Navbar from "../../components/Navbar";
import { supabase } from "../../lib/supabase";

type Driver = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  truck_id?: string | null;
  truck_number?: string | null;
  pay_type?: string | null;
  pay_rate?: number | null;
  active: boolean;
};

type Truck = {
  id: string;
  truck_number: string;
  active: boolean;
};

export default function DriversSettingsPage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [editingDriverId, setEditingDriverId] = useState<string | null>(null);

  const [driverForm, setDriverForm] = useState({
    name: "",
    email: "",
    phone: "",
    truck_id: "",
    pay_type: "CPM",
    pay_rate: "",
  });

  useEffect(() => {
    fetchDrivers();
    fetchTrucks();

    const channel = supabase
      .channel("drivers-settings-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "drivers" },
        () => fetchDrivers()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trucks" },
        () => fetchTrucks()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchDrivers = async () => {
    const { data, error } = await supabase
      .from("drivers")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return alert(error.message);

    setDrivers(data || []);
  };

  const fetchTrucks = async () => {
    const { data, error } = await supabase
      .from("trucks")
      .select("*")
      .eq("active", true)
      .order("truck_number", { ascending: true });

    if (error) return alert(error.message);

    setTrucks(data || []);
  };

  const resetDriverForm = () => {
    setEditingDriverId(null);

    setDriverForm({
      name: "",
      email: "",
      phone: "",
      truck_id: "",
      pay_type: "CPM",
      pay_rate: "",
    });
  };

  const startEditDriver = (driver: Driver) => {
    setEditingDriverId(driver.id);

    setDriverForm({
      name: driver.name || "",
      email: driver.email || "",
      phone: driver.phone || "",
      truck_id: driver.truck_id || "",
      pay_type: driver.pay_type || "CPM",
      pay_rate: driver.pay_rate ? String(driver.pay_rate) : "",
    });
  };

  const saveDriver = async () => {
    if (!driverForm.name) {
      alert("Driver name is required");
      return;
    }

    const selectedTruck = trucks.find(
      (truck) => truck.id === driverForm.truck_id
    );

    const payload = {
      name: driverForm.name,
      email: driverForm.email,
      phone: driverForm.phone,
      truck_id: selectedTruck?.id || null,
      truck_number: selectedTruck?.truck_number || null,
      pay_type: driverForm.pay_type,
      pay_rate: driverForm.pay_rate
        ? Number(driverForm.pay_rate)
        : null,
    };

    if (editingDriverId) {
      const { error } = await supabase
        .from("drivers")
        .update(payload)
        .eq("id", editingDriverId);

      if (error) return alert(error.message);
    } else {
      const { error } = await supabase
        .from("drivers")
        .insert([{ ...payload, active: true }]);

      if (error) return alert(error.message);
    }

    resetDriverForm();
    await fetchDrivers();
  };

  const toggleDriver = async (driver: Driver) => {
    const { error } = await supabase
      .from("drivers")
      .update({ active: !driver.active })
      .eq("id", driver.id);

    if (error) return alert(error.message);

    await fetchDrivers();
  };

  const deleteDriver = async (driver: Driver) => {
    if (!confirm(`Delete ${driver.name}?`)) return;

    const { error } = await supabase
      .from("drivers")
      .delete()
      .eq("id", driver.id);

    if (error) return alert(error.message);

    await fetchDrivers();
  };

  return (
    <div className="min-h-screen bg-[#020617] p-3 text-white sm:p-6">
      <div className="space-y-6">
        <Navbar />

        <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-[#07101A] to-[#050A11] p-5">
          <h1 className="text-xl font-semibold text-white">
            Drivers
          </h1>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#07101A] p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-white">
              {editingDriverId ? "Edit Driver" : "Add Driver"}
            </h2>

            {editingDriverId && (
              <button
                onClick={resetDriverForm}
                className="rounded-xl border border-slate-700 px-4 py-2 text-sm"
              >
                Cancel
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Input
              placeholder="Driver Name"
              value={driverForm.name}
              onChange={(v) =>
                setDriverForm({ ...driverForm, name: v })
              }
            />

            <Input
              placeholder="Email"
              value={driverForm.email}
              onChange={(v) =>
                setDriverForm({ ...driverForm, email: v })
              }
            />

            <Input
              placeholder="Phone"
              value={driverForm.phone}
              onChange={(v) =>
                setDriverForm({ ...driverForm, phone: v })
              }
            />

            <select
              value={driverForm.truck_id}
              onChange={(e) =>
                setDriverForm({
                  ...driverForm,
                  truck_id: e.target.value,
                })
              }
              className="rounded-xl border border-slate-700 bg-[#0B1522] p-2 text-sm text-white outline-none focus:border-[#00A3FF]"
            >
              <option value="">Assign Truck</option>

              {trucks.map((truck) => (
                <option key={truck.id} value={truck.id}>
                  {truck.truck_number}
                </option>
              ))}
            </select>

            <select
              value={driverForm.pay_type}
              onChange={(e) =>
                setDriverForm({
                  ...driverForm,
                  pay_type: e.target.value,
                })
              }
              className="rounded-xl border border-slate-700 bg-[#0B1522] p-2 text-sm text-white outline-none focus:border-[#00A3FF]"
            >
              <option value="CPM">CPM</option>
              <option value="PERCENTAGE">Percentage</option>
              <option value="FLAT">Flat</option>
            </select>

            <Input
              placeholder="Pay Rate"
              value={driverForm.pay_rate}
              onChange={(v) =>
                setDriverForm({
                  ...driverForm,
                  pay_rate: v,
                })
              }
            />

            <button
              onClick={saveDriver}
              className="rounded-xl bg-gradient-to-r from-[#1E6BFF] to-[#00A3FF] px-4 py-2 text-sm font-semibold"
            >
              {editingDriverId ? "Save Driver" : "+ Add Driver"}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-[#07101A]">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-[#0B1522] text-slate-400">
              <tr>
                <th className="p-4 text-left">Driver</th>
                <th className="p-4 text-left">Phone</th>
                <th className="p-4 text-left">Truck</th>
                <th className="p-4 text-left">Pay</th>
                <th className="p-4 text-left">Status</th>
                <th className="p-4 text-left">Actions</th>
              </tr>
            </thead>

            <tbody>
              {drivers.map((driver) => (
                <tr
                  key={driver.id}
                  className="border-t border-slate-800"
                >
                  <td className="p-4">
                    <div>
                      <p className="font-semibold text-white">
                        {driver.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {driver.email || "-"}
                      </p>
                    </div>
                  </td>

                  <td className="p-4">
                    {driver.phone || "-"}
                  </td>

                  <td className="p-4">
                    {driver.truck_number || "-"}
                  </td>

                  <td className="p-4">
                    {driver.pay_type || "-"}{" "}
                    {driver.pay_rate || ""}
                  </td>

                  <td className="p-4">
                    {driver.active ? (
                      <span className="text-green-400">
                        Active
                      </span>
                    ) : (
                      <span className="text-red-400">
                        Inactive
                      </span>
                    )}
                  </td>

                  <td className="p-4">
                    <div className="flex gap-3">
                      <button
                        onClick={() => startEditDriver(driver)}
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
                        {driver.active
                          ? "Deactivate"
                          : "Activate"}
                      </button>

                      <button
                        onClick={() => deleteDriver(driver)}
                        className="text-red-400 underline"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {drivers.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="p-6 text-center text-slate-500"
                  >
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
      className="rounded-xl border border-slate-700 bg-[#0B1522] p-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-[#00A3FF]"
    />
  );
}