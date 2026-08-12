"use client";

import { useEffect, useState } from "react";
import { Save, DollarSign, Fuel, ShieldCheck, Truck } from "lucide-react";
import { supabase } from "@/app/lib/supabase";

type Settings = {
  id: string;
  monthly_insurance_per_truck: number;
  average_monthly_miles_per_truck: number;
  default_mpg: number;
  default_fuel_price: number;
  factoring_percent: number;
};

export default function CompanySettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    const { data } = await supabase
      .from("company_financial_settings")
      .select("*")
      .limit(1)
      .single();

    if (data) {
      setSettings(data);
    }
  }

  async function save() {
    if (!settings) return;

    setSaving(true);

    await supabase
      .from("company_financial_settings")
      .update({
        monthly_insurance_per_truck:
          settings.monthly_insurance_per_truck,

        average_monthly_miles_per_truck:
          settings.average_monthly_miles_per_truck,

        default_mpg: settings.default_mpg,

        default_fuel_price:
          settings.default_fuel_price,

        factoring_percent:
          settings.factoring_percent,
      })
      .eq("id", settings.id);

    setSaving(false);
    alert("Financial Settings Saved");
  }

  if (!settings) {
    return (
      <div className="p-10 text-slate-400">
        Loading...
      </div>
    );
  }

  const insurancePerMile =
    settings.monthly_insurance_per_truck /
    settings.average_monthly_miles_per_truck;

  return (
    <div className="space-y-8">

      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-400">
          Company
        </p>

        <h1 className="mt-2 text-4xl font-bold text-white">
          Financial Settings
        </h1>

        <p className="mt-2 text-slate-400">
          These values power every load profitability
          calculation inside TRACON Nexus.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">

        <Card
          icon={<ShieldCheck />}
          title="Monthly Insurance / Truck"
        >
          <Input
            value={settings.monthly_insurance_per_truck}
            onChange={(v) =>
              setSettings({
                ...settings,
                monthly_insurance_per_truck: Number(v),
              })
            }
          />
        </Card>

        <Card
          icon={<Truck />}
          title="Average Monthly Miles"
        >
          <Input
            value={settings.average_monthly_miles_per_truck}
            onChange={(v) =>
              setSettings({
                ...settings,
                average_monthly_miles_per_truck:
                  Number(v),
              })
            }
          />
        </Card>

        <Card
          icon={<Fuel />}
          title="Default MPG"
        >
          <Input
            value={settings.default_mpg}
            onChange={(v) =>
              setSettings({
                ...settings,
                default_mpg: Number(v),
              })
            }
          />
        </Card>

        <Card
          icon={<DollarSign />}
          title="Average Fuel Price"
        >
          <Input
            value={settings.default_fuel_price}
            onChange={(v) =>
              setSettings({
                ...settings,
                default_fuel_price: Number(v),
              })
            }
          />
        </Card>

        <Card
          icon={<DollarSign />}
          title="Factoring Percentage"
        >
          <Input
            value={settings.factoring_percent}
            onChange={(v) =>
              setSettings({
                ...settings,
                factoring_percent: Number(v),
              })
            }
          />
        </Card>

        <div className="rounded-2xl border border-cyan-900 bg-[#071421] p-6">

          <p className="text-xs uppercase tracking-[0.25em] text-cyan-400">
            Calculated
          </p>

          <h2 className="mt-3 text-xl font-semibold text-white">
            Insurance Per Mile
          </h2>

          <p className="mt-8 text-5xl font-bold text-cyan-400">
            ${insurancePerMile.toFixed(3)}
          </p>

          <p className="mt-2 text-slate-400">
            Automatically calculated.
          </p>

        </div>

      </div>

      <button
        onClick={save}
        disabled={saving}
        className="flex items-center gap-3 rounded-xl bg-cyan-500 px-8 py-4 font-semibold text-black hover:bg-cyan-400"
      >
        <Save className="h-5 w-5" />
        {saving ? "Saving..." : "Save Financial Settings"}
      </button>
    </div>
  );
}

function Card({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#08121D] p-6">

      <div className="mb-6 flex items-center gap-3 text-cyan-400">
        {icon}
        <h2 className="text-lg font-semibold text-white">
          {title}
        </h2>
      </div>

      {children}

    </div>
  );
}

function Input({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: string) => void;
}) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-slate-700 bg-[#020B14] p-4 text-lg text-white outline-none focus:border-cyan-500"
    />
  );
}