"use client";

import { useEffect, useState } from "react";
import Navbar from "../../components/Navbar";
import { supabase } from "../../lib/supabase";

type Truck = {
  id: string;
  truck_number: string;
  vin?: string;
  make?: string;
  model?: string;
  year?: string;
  license_plate?: string;
  mpg?: number | null;
  active: boolean;
};

export default function TrucksSettingsPage() {
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [editingTruckId, setEditingTruckId] = useState<string | null>(null);

  const [truckForm, setTruckForm] = useState({
    truck_number: "",
    vin: "",
    make: "",
    model: "",
    year: "",
    license_plate: "",
    mpg: "",
  });

  useEffect(() => {
    fetchTrucks();

    const channel = supabase
      .channel("trucks-settings-realtime")
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

  const fetchTrucks = async () => {
    const { data, error } = await supabase
      .from("trucks")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return alert(error.message);

    setTrucks(data || []);
  };

  const resetTruckForm = () => {
    setEditingTruckId(null);
    setTruckForm({
      truck_number: "",
      vin: "",
      make: "",
      model: "",
      year: "",
      license_plate: "",
      mpg: "",
    });
  };

  const startEditTruck = (truck: Truck) => {
    setEditingTruckId(truck.id);
    setTruckForm({
      truck_number: truck.truck_number || "",
      vin: truck.vin || "",
      make: truck.make || "",
      model: truck.model || "",
      year: truck.year || "",
      license_plate: truck.license_plate || "",
      mpg: truck.mpg ? String(truck.mpg) : "",
    });
  };

  const saveTruck = async () => {
    if (!truckForm.truck_number) {
      alert("Truck number is required");
      return;
    }

    const payload = {
      truck_number: truckForm.truck_number,
      vin: truckForm.vin,
      make: truckForm.make,
      model: truckForm.model,
      year: truckForm.year,
      license_plate: truckForm.license_plate,
      mpg: truckForm.mpg ? Number(truckForm.mpg) : null,
    };

    if (editingTruckId) {
      const { error } = await supabase
        .from("trucks")
        .update(payload)
        .eq("id", editingTruckId);

      if (error) return alert(error.message);
    } else {
      const { error } = await supabase
        .from("trucks")
        .insert([{ ...payload, active: true }]);

      if (error) return alert(error.message);
    }

    resetTruckForm();
    await fetchTrucks();
  };

  const toggleTruck = async (truck: Truck) => {
    const { error } = await supabase
      .from("trucks")
      .update({ active: !truck.active })
      .eq("id", truck.id);

    if (error) return alert(error.message);

    await fetchTrucks();
  };

  const deleteTruck = async (truck: Truck) => {
    if (!confirm(`Delete truck ${truck.truck_number}?`)) return;

    const { error } = await supabase
      .from("trucks")
      .delete()
      .eq("id", truck.id);

    if (error) return alert(error.message);

    await fetchTrucks();
  };

  return (
    <div className="min-h-screen bg-[#020617] p-3 text-white sm:p-6">
      <div className="space-y-6">
        <Navbar />

        <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-[#07101A] to-[#050A11] p-5">
          <h1 className="text-xl font-semibold text-white">Trucks</h1>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#07101A] p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-white">
              {editingTruckId ? "Edit Truck" : "Add Truck"}
            </h2>

            {editingTruckId && (
              <button
                onClick={resetTruckForm}
                className="rounded-xl border border-slate-700 px-4 py-2 text-sm"
              >
                Cancel
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Input
              placeholder="Truck Number"
              value={truckForm.truck_number}
              onChange={(v) =>
                setTruckForm({ ...truckForm, truck_number: v })
              }
            />

            <Input
              placeholder="VIN"
              value={truckForm.vin}
              onChange={(v) => setTruckForm({ ...truckForm, vin: v })}
            />

            <Input
              placeholder="Make"
              value={truckForm.make}
              onChange={(v) => setTruckForm({ ...truckForm, make: v })}
            />

            <Input
              placeholder="Model"
              value={truckForm.model}
              onChange={(v) => setTruckForm({ ...truckForm, model: v })}
            />

            <Input
              placeholder="Year"
              value={truckForm.year}
              onChange={(v) => setTruckForm({ ...truckForm, year: v })}
            />

            <Input
              placeholder="License Plate"
              value={truckForm.license_plate}
              onChange={(v) =>
                setTruckForm({ ...truckForm, license_plate: v })
              }
            />

            <Input
              placeholder="MPG"
              value={truckForm.mpg}
              onChange={(v) => setTruckForm({ ...truckForm, mpg: v })}
            />

            <button
              onClick={saveTruck}
              className="rounded-xl bg-gradient-to-r from-[#1E6BFF] to-[#00A3FF] px-4 py-2 text-sm font-semibold"
            >
              {editingTruckId ? "Save Truck" : "+ Add Truck"}
            </button>
          </div>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-[#07101A]">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-[#0B1522] text-slate-400">
              <tr>
                <th className="p-4 text-left">Truck</th>
                <th className="p-4 text-left">VIN</th>
                <th className="p-4 text-left">Make / Model</th>
                <th className="p-4 text-left">Plate</th>
                <th className="p-4 text-left">MPG</th>
                <th className="p-4 text-left">Status</th>
                <th className="p-4 text-left">Actions</th>
              </tr>
            </thead>

            <tbody>
              {trucks.map((truck) => (
                <tr key={truck.id} className="border-t border-slate-800">
                  <td className="p-4 font-semibold text-white">
                    {truck.truck_number}
                  </td>
                  <td className="p-4">{truck.vin || "-"}</td>
                  <td className="p-4">
                    {truck.year || ""} {truck.make || ""} {truck.model || ""}
                  </td>
                  <td className="p-4">{truck.license_plate || "-"}</td>
                  <td className="p-4">
                    {truck.mpg ? `${truck.mpg} MPG` : "-"}
                  </td>
                  <td className="p-4">
                    {truck.active ? (
                      <span className="text-green-400">Active</span>
                    ) : (
                      <span className="text-red-400">Inactive</span>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="flex gap-3">
                      <button
                        onClick={() => startEditTruck(truck)}
                        className="text-[#00A3FF] underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => toggleTruck(truck)}
                        className={
                          truck.active
                            ? "text-red-400 underline"
                            : "text-green-400 underline"
                        }
                      >
                        {truck.active ? "Deactivate" : "Activate"}
                      </button>
                      <button
                        onClick={() => deleteTruck(truck)}
                        className="text-red-400 underline"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {trucks.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-slate-500">
                    No trucks added yet.
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