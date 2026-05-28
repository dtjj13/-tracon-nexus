"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "../../components/Navbar";
import { supabase } from "../../lib/supabase";
export default function CompanySettingsPage() {
  const router = useRouter();

  const [companyName, setCompanyName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchCompany();
  }, []);

  const fetchCompany = async () => {
    const { data } = await supabase
      .from("company_settings")
      .select("*")
      .single();

    if (data) {
      setCompanyName(data.company_name || "");
      setLogoUrl(data.company_logo_url || "");
    }
  };

  const saveCompanyName = async () => {
    setLoading(true);

    const { error } = await supabase
      .from("company_settings")
      .upsert({
        id: 1,
        company_name: companyName,
      });

    setLoading(false);

    if (error) {
      alert(error.message);
      return;
    }

    alert("Company name updated");
  };

  const uploadLogo = async (fileToUpload?: File) => {
    const file = fileToUpload || logoFile;

    if (!file) {
      alert("Choose a logo first");
      return;
    }

    setLoading(true);

    const filePath = `company-logo-${Date.now()}`;

    const { error: uploadError } = await supabase.storage
      .from("company-assets")
      .upload(filePath, file, {
        upsert: true,
      });

    if (uploadError) {
      setLoading(false);
      alert(uploadError.message);
      return;
    }

    const {
      data: { publicUrl },
    } = supabase.storage
      .from("company-assets")
      .getPublicUrl(filePath);

    const { error: dbError } = await supabase
      .from("company_settings")
      .upsert({
        id: 1,
        company_logo_url: publicUrl,
      });

    setLoading(false);

    if (dbError) {
      alert(dbError.message);
      return;
    }

    setLogoUrl(publicUrl);

    alert("Logo updated");
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white">
      <Navbar />

      <div className="p-3 sm:p-6">
        <div className="mb-4">
          <button
            onClick={() => router.back()}
            className="rounded-xl border border-slate-700 bg-[#07101A] px-4 py-2 text-sm text-slate-300 transition hover:border-[#00A3FF] hover:text-white"
          >
            ← Back
          </button>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#07101A] p-5">
          <h1 className="text-2xl font-bold text-white">
            Company Settings
          </h1>

          <p className="mt-2 text-slate-400">
            Manage company branding and settings
          </p>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-800 bg-[#07101A] p-5">
          <h2 className="mb-4 text-xl font-semibold text-white">
            Company Branding
          </h2>

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm text-slate-400">
                Company Name
              </label>

              <input
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Company Name"
                className="w-full rounded-xl border border-slate-700 bg-[#0B1522] p-3 text-white outline-none placeholder:text-slate-500 focus:border-[#00A3FF]"
              />

              <button
                onClick={saveCompanyName}
                disabled={loading}
                className="mt-3 rounded-xl border border-slate-700 bg-[#0B1522] px-4 py-2 text-sm font-semibold text-white transition hover:border-[#00A3FF]"
              >
                Save Name
              </button>
            </div>

            <div>
              <label className="mb-2 block text-sm text-slate-400">
                Company Logo
              </label>

              <label className="flex cursor-pointer items-center justify-center rounded-xl bg-gradient-to-r from-[#16B8FF] to-[#00A3FF] px-4 py-3 text-sm font-semibold text-white">
                Choose Logo

                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];

                    if (!file) return;

                    setLogoFile(file);

                    await uploadLogo(file);
                  }}
                />
              </label>

              {logoUrl && (
                
                <div className="mt-4">
                  <img
                    src={logoUrl}
                    alt="Company Logo"
                    className="h-24 w-24 rounded-xl border border-slate-700 object-cover"
                  />
                  <button
  onClick={async () => {
    const { error } = await supabase
      .from("company_settings")
      .update({
        company_logo_url: "",
      })
      .eq("id", 1);

    if (error) {
      alert(error.message);
      return;
    }

    setLogoUrl("");

    alert("Logo removed");
  }}
  className="mt-3 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/20"
>
  Remove Logo
</button>
                </div>
                
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}