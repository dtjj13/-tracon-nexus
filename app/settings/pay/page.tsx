"use client";

import { useEffect, useState } from "react";
import Navbar from "@/app/components/Navbar";
import { supabase } from "@/app/lib/supabase";

export default function PayFuelSettingsPage() {
  const [dieselPrice, setDieselPrice] = useState("");
  const [defaultMpg, setDefaultMpg] = useState("");
  const [defaultCpm, setDefaultCpm] = useState("");
  const [deadheadPercent, setDeadheadPercent] = useState("");

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from("company_settings")
      .select("*")
      .eq("id", 1)
      .single();

    if (error) {
      console.error(error.message);
      return;
    }

    if (data) {
      setDieselPrice(
        data.default_diesel_price
          ? String(data.default_diesel_price)
          : ""
      );

      setDefaultMpg(
        data.default_mpg
          ? String(data.default_mpg)
          : ""
      );

      setDefaultCpm(
        data.default_cpm
          ? String(data.default_cpm)
          : ""
      );

      setDeadheadPercent(
        data.default_deadhead_percent
          ? String(data.default_deadhead_percent)
          : ""
      );
    }
  };

  const saveSettings = async () => {
    setLoading(true);

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
      .eq("id", 1);

    setLoading(false);

    if (error) {
      alert(error.message);
      console.error(error);
      return;
    }

    alert("Pay & Fuel Settings Updated");
  };

  return (
    <div className="min-h-screen bg-[#020617] p-3 text-white sm:p-6">
      <div className="space-y-6">
        <Navbar />

        <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-[#07101A] to-[#050A11] p-5">
          <h1 className="text-xl font-semibold text-white">
            Pay & Fuel Settings
          </h1>

          <p className="mt-2 text-sm text-slate-400">
            Configure company-wide dispatch defaults.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#07101A] p-5">
          <h2 className="mb-5 text-lg font-semibold text-white">
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
              label="Default Deadhead %"
              placeholder="15"
              value={deadheadPercent}
              onChange={setDeadheadPercent}
            />
          </div>

          <button
            onClick={saveSettings}
            disabled={loading}
            className="mt-6 rounded-xl bg-gradient-to-r from-[#1E6BFF] to-[#00A3FF] px-6 py-3 text-sm font-semibold text-white shadow-[0_0_20px_rgba(30,107,255,0.35)] transition hover:scale-[1.01] disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save Settings"}
          </button>
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
      <p className="mb-2 text-xs uppercase tracking-widest text-slate-500">
        {label}
      </p>

      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-700 bg-[#0B1522] p-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-[#00A3FF]"
      />
    </div>
  );
}