"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";

type FinancialSettings = {
  id: string;
  monthly_insurance_per_truck: number;
  average_monthly_miles_per_truck: number;
  default_mpg: number;
  default_fuel_price: number;
  factoring_percent: number;
  insurance_per_mile?: number;
};

export default function CompanySettingsPage() {
  const [settings, setSettings] = useState<FinancialSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    setLoading(true);

    const { data, error } = await supabase
      .from("company_financial_settings")
      .select("*")
      .single();

    if (error) {
      console.error("Error loading financial settings:", error);
      setMessage("Unable to load financial settings.");
      setLoading(false);
      return;
    }

    if (data) {
      setSettings(data);
    }

    setLoading(false);
  }

  async function saveSettings() {
    if (!settings) return;

    setSaving(true);
    setMessage("");

    const { error } = await supabase
      .from("company_financial_settings")
      .update({
        monthly_insurance_per_truck:
          settings.monthly_insurance_per_truck,
        average_monthly_miles_per_truck:
          settings.average_monthly_miles_per_truck,
        default_mpg: settings.default_mpg,
        default_fuel_price: settings.default_fuel_price,
        factoring_percent: settings.factoring_percent,
        updated_at: new Date().toISOString(),
      })
      .eq("id", settings.id);

    if (error) {
      console.error("Error saving financial settings:", error);
      setMessage("There was a problem saving your settings.");
      setSaving(false);
      return;
    }

    setMessage("Financial settings saved successfully.");
    setSaving(false);

    await loadSettings();
  }

  const insurancePerMile = useMemo(() => {
    if (!settings) return 0;

    const insurance = Number(
      settings.monthly_insurance_per_truck || 0
    );

    const miles = Number(
      settings.average_monthly_miles_per_truck || 0
    );

    if (miles <= 0) return 0;

    return insurance / miles;
  }, [settings]);

  if (loading) {
    return (
      <div className="p-10 text-slate-400">
        Loading Financial Settings...
      </div>
    );
  }

  if (!settings) {
    return (
      <div className="p-10 text-red-400">
        Financial settings could not be loaded.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.25em] text-cyan-400">
          Company Settings
        </p>

        <h1 className="mt-2 text-4xl font-bold text-white">
          Financial Settings
        </h1>

        <p className="mt-2 max-w-3xl text-slate-400">
          These values are used throughout TRACON Nexus to calculate
          insurance cost per mile, estimated fuel expenses, factoring
          costs, load profitability, and future financial reporting.
        </p>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-[#07101A] p-8">
        <div className="grid gap-6 md:grid-cols-2">
          <Field
            label="Monthly Insurance Per Truck"
            value={settings.monthly_insurance_per_truck}
            prefix="$"
            onChange={(value) =>
              setSettings({
                ...settings,
                monthly_insurance_per_truck: Number(value),
              })
            }
          />

          <Field
            label="Average Monthly Miles Per Truck"
            value={settings.average_monthly_miles_per_truck}
            suffix="mi"
            onChange={(value) =>
              setSettings({
                ...settings,
                average_monthly_miles_per_truck: Number(value),
              })
            }
          />

          <Field
            label="Default MPG"
            value={settings.default_mpg}
            suffix="MPG"
            onChange={(value) =>
              setSettings({
                ...settings,
                default_mpg: Number(value),
              })
            }
          />

          <Field
            label="Average Fuel Price"
            value={settings.default_fuel_price}
            prefix="$"
            onChange={(value) =>
              setSettings({
                ...settings,
                default_fuel_price: Number(value),
              })
            }
          />

          <Field
            label="Factoring Percentage"
            value={settings.factoring_percent}
            suffix="%"
            onChange={(value) =>
              setSettings({
                ...settings,
                factoring_percent: Number(value),
              })
            }
          />

          <Field
            label="Insurance Per Mile"
            value={insurancePerMile.toFixed(4)}
            prefix="$"
            suffix="/mi"
            disabled
          />
        </div>

        <div className="mt-8 rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-400">
            Insurance Calculation
          </p>

          <p className="mt-3 text-sm text-slate-400">
            Monthly Insurance Per Truck
            <span className="mx-2 text-slate-600">÷</span>
            Average Monthly Miles Per Truck
          </p>

          <p className="mt-2 text-xl font-semibold text-white">
            ${insurancePerMile.toFixed(4)} per mile
          </p>
        </div>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {message && (
              <p
                className={`text-sm ${
                  message.includes("successfully")
                    ? "text-green-400"
                    : "text-red-400"
                }`}
              >
                {message}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={saveSettings}
            disabled={saving}
            className="rounded-xl bg-[#16BFFF] px-6 py-3 font-semibold text-[#020617] transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save Financial Settings"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  disabled = false,
  onChange,
  prefix,
  suffix,
}: {
  label: string;
  value: string | number;
  disabled?: boolean;
  onChange?: (value: string) => void;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-slate-400">
        {label}
      </label>

      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
            {prefix}
          </span>
        )}

        <input
          type="number"
          step="any"
          disabled={disabled}
          value={value ?? ""}
          onChange={(e) => onChange?.(e.target.value)}
          className={`w-full rounded-xl border border-slate-700 bg-[#0B1522] py-3 text-lg text-white transition focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-70 ${
            prefix ? "pl-9" : "pl-4"
          } ${suffix ? "pr-14" : "pr-4"}`}
        />

        {suffix && (
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-500">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}