"use client";

import { useEffect, useState } from "react";
import Navbar from "../../components/Navbar";
import { supabase } from "../../lib/supabase";

type CompanySettings = {
  id: string;
  default_diesel_price?: number | null;
  default_mpg?: number | null;
  default_cpm?: number | null;
  default_deadhead_percent?: number | null;
};

export default function PayFuelSettingsPage() {
  const [settingsId, setSettingsId] = useState<string>("");

  const [dieselPrice, setDieselPrice] = useState("");
  const [defaultMpg, setDefaultMpg] = useState("");
  const [defaultCpm, setDefaultCpm] = useState("");
  const [deadheadPercent, setDeadheadPercent] = useState("");

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from("company_settings")
      .select("*")
      .limit(1)
      .single();

    if (error) {
      alert(error.message);
      return;
    }

    if (!data) return;

    setSettingsId(data.id);

    setDieselPrice(
      data.default_diesel_price
        ? String(data.default_diesel_price)
        : ""
    );

    setDefaultMpg(
      data.default_mpg ? String(data.default_mpg) : ""
    );

    setDefaultCpm(
      data.default_cpm ? String(data.default_cpm) : ""
    );

    setDeadheadPercent(
      data.default_deadhead_percent
        ? String(data.default_deadhead_percent)
        : ""
    );
  };

  const saveSettings = async () => {
    if (!settingsId) {
      alert("Settings not found");
      return;
    }

    const payload = {
      default_diesel_price: dieselPrice
        ? Number(dieselPrice)
        : null,

      default_mpg: defaultMpg
        ? Number(defaultMpg)
        : null,

      default_cpm: defaultCpm
        ? Number(defaultCpm)
        : null,

      default_deadhead_percent: deadheadPercent
        ? Number(deadheadPercent)
        : null,
    };

    const { error } = await supabase
      .from("company_settings")
      .update(payload)
      .eq("id", settingsId);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Pay & fuel settings updated");
  };

  return (
    <div className="min-h-screen bg-[#020617] p-3 text-white sm:p-6">
      <div className="space-y-6">
        <Navbar />

        <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-[#07101A] to-[#050A11] p-5">
          <h1 className="text-xl font-semibold text-white">
            Pay & Fuel
          </h1>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#07101A] p-5">
          <h2 className="mb-4 font-semibold text-white">
            Fleet Defaults
          </h2>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Input
              label="Default Diesel Price"
              placeholder="3.89"
              value={dieselPrice}
              onChange={setDieselPrice}
            />

            <Input
              label="Default MPG"
              placeholder="6.5"
              value={defaultMpg}
              onChange={setDefaultMpg}
            />

            <Input
              label="Default CPM"
              placeholder="0.65"
              value={defaultCpm}
              onChange={setDefaultCpm}
            />

            <Input
              label="Deadhead %"
              placeholder="15"
              value={deadheadPercent}
              onChange={setDeadheadPercent}
            />
          </div>

          <div className="mt-6">
            <button
              onClick={saveSettings}
              className="rounded-xl bg-gradient-to-r from-[#1E6BFF] to-[#00A3FF] px-5 py-3 text-sm font-semibold text-white"
            >
              Save Settings
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#07101A] p-5">
          <h2 className="mb-3 font-semibold text-white">
            Future Automation
          </h2>

          <div className="space-y-2 text-sm text-slate-400">
            <p>• Route-based diesel pricing</p>
            <p>• MPG-based fuel estimates</p>
            <p>• Automatic deadhead calculations</p>
            <p>• Profit-per-truck analytics</p>
            <p>• Driver payroll automation</p>
            <p>• Load profitability scoring</p>
          </div>
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
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-sm text-slate-400">{label}</p>

      <input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-700 bg-[#0B1522] p-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-[#00A3FF]"
      />
    </div>
  );
}