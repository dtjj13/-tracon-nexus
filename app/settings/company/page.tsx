"use client";

import { useEffect, useState } from "react";
import Navbar from "../../components/Navbar";
import { supabase } from "../../lib/supabase";

type CompanySettings = {
  id: string;
  company_name?: string;
  company_logo_url?: string;
};

export default function CompanySettingsPage() {
  const [company, setCompany] = useState<CompanySettings | null>(null);
  const [companyName, setCompanyName] = useState("Twelve 10 Logistics");
  const [logoFile, setLogoFile] = useState<File | null>(null);

  useEffect(() => {
    fetchCompany();
  }, []);

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
      alert("Company settings not found");
      return;
    }

    const { error } = await supabase
      .from("company_settings")
      .update({ company_name: companyName })
      .eq("id", company.id);

    if (error) return alert(error.message);

    alert("Company name saved");
    fetchCompany();
  };

  const uploadLogo = async () => {
    if (!company) {
      alert("Company settings not found");
      return;
    }

    if (!logoFile) {
      alert("Choose a logo first");
      return;
    }

    const fileName = `company-logo-${Date.now()}-${logoFile.name}`;

    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(fileName, logoFile, { upsert: true });

    if (uploadError) return alert(uploadError.message);

    const { data } = supabase.storage
      .from("documents")
      .getPublicUrl(fileName);

    const { error } = await supabase
      .from("company_settings")
      .update({ company_logo_url: data.publicUrl })
      .eq("id", company.id);

    if (error) return alert(error.message);

    setLogoFile(null);
    alert("Logo updated");
    fetchCompany();
  };

  const removeLogo = async () => {
    if (!company) return;

    const { error } = await supabase
      .from("company_settings")
      .update({ company_logo_url: null })
      .eq("id", company.id);

    if (error) return alert(error.message);

    alert("Logo removed");
    fetchCompany();
  };

  return (
    <div className="min-h-screen bg-[#020617] p-3 text-white sm:p-6">
      <div className="space-y-6">
        <Navbar />

        <div className="rounded-2xl border border-slate-800 bg-gradient-to-r from-[#07101A] to-[#050A11] p-5">
          <h1 className="text-xl font-semibold text-white">Company</h1>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#07101A] p-5">
          <h2 className="mb-4 font-semibold text-white">Company Branding</h2>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-4">
            <input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Company Name"
              className="rounded-xl border border-slate-700 bg-[#0B1522] p-2 text-sm text-white outline-none placeholder:text-slate-500 focus:border-[#00A3FF]"
            />

            <button
              onClick={saveCompanyName}
              className="rounded-xl border border-slate-700 bg-[#0B1522] px-4 py-2 text-sm font-semibold text-white hover:border-[#00A3FF]"
            >
              Save Name
            </button>

            <label className="cursor-pointer rounded-xl bg-gradient-to-r from-[#1E6BFF] to-[#00A3FF] px-4 py-2 text-center text-sm font-semibold text-white">
              Choose Logo
              <input
                type="file"
                className="hidden"
                onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
              />
            </label>

            <button
              onClick={uploadLogo}
              className="rounded-xl bg-gradient-to-r from-[#1E6BFF] to-[#00A3FF] px-4 py-2 text-sm font-semibold text-white"
            >
              Replace Logo
            </button>
          </div>

          {logoFile && (
            <p className="mt-3 text-sm text-slate-400">
              Selected: {logoFile.name}
            </p>
          )}

          <div className="mt-6 rounded-2xl border border-slate-800 bg-[#0B1522] p-5">
            <p className="mb-3 text-sm text-slate-400">Current Logo</p>

            {company?.company_logo_url ? (
              <div className="space-y-4">
                <img
                  src={company.company_logo_url}
                  alt="Company Logo"
                  className="max-h-24 rounded-xl border border-slate-800 bg-[#020617] p-3"
                />

                <button
                  onClick={removeLogo}
                  className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300"
                >
                  Remove Logo
                </button>
              </div>
            ) : (
              <p className="text-sm text-slate-500">No logo uploaded.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}