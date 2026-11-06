"use client";

import { useEffect, useState } from "react";
import Navbar from "../../components/Navbar";
import RoleGate from "../../components/RoleGate";
import { supabase } from "../../lib/supabase";
import { useRouter } from "next/navigation";
import {
  describeTruckRoutingProfile,
  type TruckRoutingFields,
} from "../../lib/truckRouting";

type Truck = TruckRoutingFields & {
  id: string;
  truck_number: string;
  vin?: string;
  make?: string;
  model?: string;
  year?: string;
  license_plate?: string;
  mpg?: number | null;
  active: boolean;
  vehicle_type?: string | null;
};

function formatVehicleType(value?: string | null) {
  if (!value) return "Not set";

  return value
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export default function TrucksSettingsPage() {
  return (
    <RoleGate allowed={["owner", "admin", "manager", "maintenance"]}>
      <TrucksSettingsContent />
    </RoleGate>
  );
}

function TrucksSettingsContent() {
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [editingTruckId, setEditingTruckId] = useState<string | null>(null);
  const router = useRouter();
  const [truckForm, setTruckForm] = useState({
    truck_number: "",
    vin: "",
    make: "",
    model: "",
    year: "",
    license_plate: "",
    mpg: "",
    vehicle_type: "",
    routing_height_ft: "",
    routing_width_ft: "",
    routing_length_ft: "",
    routing_gross_weight_lbs: "",
    routing_axle_load_lbs: "",
    routing_hazmat: false,
    routing_avoid_tolls: false,
  });

  const fetchTrucks = async () => {
    const { data, error } = await supabase
      .from("trucks")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) return alert(error.message);

    setTrucks(data || []);
  };

  /* eslint-disable react-hooks/set-state-in-effect -- Initial async settings hydration. */
  useEffect(() => {
    void fetchTrucks();

    const channel = supabase
      .channel("trucks-settings-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "trucks" },
        () => void fetchTrucks()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);
  /* eslint-enable react-hooks/set-state-in-effect */

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
      vehicle_type: "",
      routing_height_ft: "",
      routing_width_ft: "",
      routing_length_ft: "",
      routing_gross_weight_lbs: "",
      routing_axle_load_lbs: "",
      routing_hazmat: false,
      routing_avoid_tolls: false,
    });
  };

  const startEditTruck = (truck: Truck) => {
    setEditingTruckId(truck.id);
    setTruckForm({
      truck_number: truck.truck_number ?? "",
      vin: truck.vin ?? "",
      make: truck.make ?? "",
      model: truck.model ?? "",
      year: truck.year ?? "",
      license_plate: truck.license_plate ?? "",
      mpg: truck.mpg == null ? "" : String(truck.mpg),
      vehicle_type: truck.vehicle_type ?? "",
      routing_height_ft: toFormValue(truck.routing_height_ft),
      routing_width_ft: toFormValue(truck.routing_width_ft),
      routing_length_ft: toFormValue(truck.routing_length_ft),
      routing_gross_weight_lbs: toFormValue(
        truck.routing_gross_weight_lbs
      ),
      routing_axle_load_lbs: toFormValue(truck.routing_axle_load_lbs),
      routing_hazmat: Boolean(truck.routing_hazmat),
      routing_avoid_tolls: Boolean(truck.routing_avoid_tolls),
    });
  };

  const saveTruck = async () => {
    if (!truckForm.truck_number) {
      alert("Truck number is required");
      return;
    }

    const mpg = truckForm.mpg.trim() ? Number(truckForm.mpg) : null;
    const routingHeightFt = readOptionalFormNumber(
      truckForm.routing_height_ft,
      20,
      "Height"
    );
    const routingWidthFt = readOptionalFormNumber(
      truckForm.routing_width_ft,
      15,
      "Width"
    );
    const routingLengthFt = readOptionalFormNumber(
      truckForm.routing_length_ft,
      150,
      "Length"
    );
    const routingGrossWeightLbs = readOptionalFormNumber(
      truckForm.routing_gross_weight_lbs,
      200_000,
      "Gross weight"
    );
    const routingAxleLoadLbs = readOptionalFormNumber(
      truckForm.routing_axle_load_lbs,
      80_000,
      "Axle load"
    );

    if (mpg !== null && (!Number.isFinite(mpg) || mpg <= 0)) {
      alert("MPG must be a number greater than 0.");
      return;
    }

    if (
      routingHeightFt === "invalid" ||
      routingWidthFt === "invalid" ||
      routingLengthFt === "invalid" ||
      routingGrossWeightLbs === "invalid" ||
      routingAxleLoadLbs === "invalid"
    ) {
      return;
    }

    const payload = {
      truck_number: truckForm.truck_number,
      vin: truckForm.vin,
      make: truckForm.make,
      model: truckForm.model,
      year: truckForm.year,
      license_plate: truckForm.license_plate,
      mpg,
      vehicle_type: truckForm.vehicle_type,
      routing_height_ft: routingHeightFt,
      routing_width_ft: routingWidthFt,
      routing_length_ft: routingLengthFt,
      routing_gross_weight_lbs: routingGrossWeightLbs,
      routing_axle_load_lbs: routingAxleLoadLbs,
      routing_hazmat: truckForm.routing_hazmat,
      routing_avoid_tolls: truckForm.routing_avoid_tolls,
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
        <div className="mb-4">
          <button
            onClick={() => router.back()}
            className="rounded-xl border border-slate-700 bg-[#07101A] px-4 py-2 text-sm text-slate-300 transition hover:border-[#00A3FF] hover:text-white"
          >
            ← Back
          </button>
        </div>
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
              label="Truck number"
              placeholder="Truck Number"
              value={truckForm.truck_number}
              onChange={(v) =>
                setTruckForm({ ...truckForm, truck_number: v })
              }
            />

            <Input
              label="VIN"
              placeholder="VIN"
              value={truckForm.vin}
              onChange={(v) => setTruckForm({ ...truckForm, vin: v })}
            />

            <Input
              label="Make"
              placeholder="Make"
              value={truckForm.make}
              onChange={(v) => setTruckForm({ ...truckForm, make: v })}
            />

            <Input
              label="Model"
              placeholder="Model"
              value={truckForm.model}
              onChange={(v) => setTruckForm({ ...truckForm, model: v })}
            />

            <Input
              label="Year"
              placeholder="Year"
              value={truckForm.year}
              onChange={(v) => setTruckForm({ ...truckForm, year: v })}
            />

            <Input
              label="License plate"
              placeholder="License Plate"
              value={truckForm.license_plate}
              onChange={(v) =>
                setTruckForm({ ...truckForm, license_plate: v })
              }
            />

            <Input
              label="Fuel economy"
              placeholder="MPG"
              value={truckForm.mpg}
              onChange={(v) => setTruckForm({ ...truckForm, mpg: v })}
            />
            <label className="block">
              <span className="mb-1 block text-xs font-semibold text-slate-400">
                Vehicle type
              </span>
              <select
                value={truckForm.vehicle_type}
                onChange={(e) =>
                  setTruckForm({
                    ...truckForm,
                    vehicle_type: e.target.value,
                  })
                }
                className="w-full rounded-xl border border-slate-700 bg-[#0B1522] p-3 text-sm text-white"
              >
                <option value="">Select Vehicle Type</option>
                <option value="cargo_van">Cargo Van</option>
                <option value="sprinter">Sprinter</option>
                <option value="box_truck">Box Truck</option>
                <option value="semi">Semi Truck</option>
                <option value="trailer">Trailer</option>
                <option value="electric">Electric</option>
              </select>
            </label>
          </div>

          <div className="mt-6 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">
                Truck routing profile
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                Enter the complete truck-and-trailer measurements. Blank fields use GraphHopper&apos;s generic truck profile.
              </p>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <Input
                label="Overall height (ft)"
                placeholder="Example: 13.5"
                type="number"
                value={truckForm.routing_height_ft}
                onChange={(value) =>
                  setTruckForm({ ...truckForm, routing_height_ft: value })
                }
              />
              <Input
                label="Overall width (ft)"
                placeholder="Example: 8.5"
                type="number"
                value={truckForm.routing_width_ft}
                onChange={(value) =>
                  setTruckForm({ ...truckForm, routing_width_ft: value })
                }
              />
              <Input
                label="Overall length (ft)"
                placeholder="Example: 70"
                type="number"
                value={truckForm.routing_length_ft}
                onChange={(value) =>
                  setTruckForm({ ...truckForm, routing_length_ft: value })
                }
              />
              <Input
                label="Gross weight (lb)"
                placeholder="Example: 80000"
                type="number"
                value={truckForm.routing_gross_weight_lbs}
                onChange={(value) =>
                  setTruckForm({
                    ...truckForm,
                    routing_gross_weight_lbs: value,
                  })
                }
              />
              <Input
                label="Max axle load (lb)"
                placeholder="Example: 20000"
                type="number"
                value={truckForm.routing_axle_load_lbs}
                onChange={(value) =>
                  setTruckForm({ ...truckForm, routing_axle_load_lbs: value })
                }
              />
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <RoutingToggle
                label="Hazmat restrictions"
                checked={truckForm.routing_hazmat}
                onChange={(checked) =>
                  setTruckForm({ ...truckForm, routing_hazmat: checked })
                }
              />
              <RoutingToggle
                label="Prefer routes without tolls"
                checked={truckForm.routing_avoid_tolls}
                onChange={(checked) =>
                  setTruckForm({ ...truckForm, routing_avoid_tolls: checked })
                }
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end">
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
                <th className="p-4 text-left">Type</th>
                <th className="p-4 text-left">Make / Model</th>
                <th className="p-4 text-left">Plate</th>
                <th className="p-4 text-left">MPG</th>
                <th className="p-4 text-left">Routing profile</th>
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
                  <td className="p-4 text-slate-300">
                    {formatVehicleType(truck.vehicle_type)}
                  </td>
                  <td className="p-4">
                    {truck.year || ""} {truck.make || ""} {truck.model || ""}
                  </td>
                  <td className="p-4">{truck.license_plate || "-"}</td>
                  <td className="p-4">
                    {truck.mpg ? `${truck.mpg} MPG` : "-"}
                  </td>
                  <td className="p-4 text-xs text-slate-300">
                    {formatRoutingProfile(truck)}
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
                  <td colSpan={9} className="p-6 text-center text-slate-500">
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
  label,
  placeholder,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  type?: "text" | "number";
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-400">
        {label}
      </span>
      <input
        type={type}
        min={type === "number" ? "0" : undefined}
        step={type === "number" ? "any" : undefined}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-700 bg-[#0B1522] p-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-[#00A3FF]"
      />
    </label>
  );
}

function RoutingToggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-700 bg-[#0B1522] px-4 py-3 text-sm text-slate-200">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-4 w-4 accent-cyan-500"
      />
      {label}
    </label>
  );
}

function readOptionalFormNumber(
  value: string,
  maximum: number,
  label: string
): number | null | "invalid" {
  if (!value.trim()) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0 || number > maximum) {
    alert(`${label} must be greater than 0 and no more than ${maximum}.`);
    return "invalid";
  }
  return number;
}

function toFormValue(value: number | null | undefined) {
  return value == null ? "" : String(value);
}

function formatRoutingProfile(truck: Truck) {
  return describeTruckRoutingProfile(truck, "Generic truck");
}
