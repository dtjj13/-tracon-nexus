"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  ImagePlus,
  Loader2,
  Save,
  Trash2,
} from "lucide-react";
import Navbar from "../../components/Navbar";
import { supabase } from "../../lib/supabase";

type CompanyForm = {
  id: string | number | null;
  company_name: string;
  company_logo_url: string;
};

type MessageType = "success" | "error" | "";

const EMPTY_COMPANY: CompanyForm = {
  id: null,
  company_name: "",
  company_logo_url: "",
};

export default function CompanySettingsPage() {
  const [company, setCompany] = useState<CompanyForm>(EMPTY_COMPANY);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<MessageType>("");

  useEffect(() => {
    void loadCompany();
  }, []);

  useEffect(() => {
    if (!logoFile) {
      setPreviewUrl(company.company_logo_url);
      return;
    }

    const objectUrl = URL.createObjectURL(logoFile);
    setPreviewUrl(objectUrl);

    return () => URL.revokeObjectURL(objectUrl);
  }, [logoFile, company.company_logo_url]);

  async function loadCompany() {
    setLoading(true);

    const { data, error } = await supabase
      .from("company_settings")
      .select("id, company_name, company_logo_url")
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Unable to load company profile:", error);
      setMessage("Unable to load the company profile.");
      setMessageType("error");
    } else if (data) {
      setCompany({
        id: data.id,
        company_name: data.company_name || "",
        company_logo_url: data.company_logo_url || "",
      });
    }

    setLoading(false);
  }

  function handleLogoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/png", "image/jpeg", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      setMessage("Choose a PNG, JPG, or WebP logo.");
      setMessageType("error");
      event.target.value = "";
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMessage("The logo must be 5 MB or smaller.");
      setMessageType("error");
      event.target.value = "";
      return;
    }

    setLogoFile(file);
    setMessage("");
    setMessageType("");
  }

  function removeLogo() {
    setLogoFile(null);
    setCompany((current) => ({ ...current, company_logo_url: "" }));
    setMessage("Logo removed from the preview. Save to confirm.");
    setMessageType("");
  }

  async function saveCompany() {
    const companyName = company.company_name.trim();

    if (!companyName) {
      setMessage("Enter the company name before saving.");
      setMessageType("error");
      return;
    }

    setSaving(true);
    setMessage("");
    setMessageType("");

    try {
      let companyLogoUrl = company.company_logo_url;

      if (logoFile) {
        const extension =
          logoFile.name.split(".").pop()?.toLowerCase() || "png";
        const filePath = `company-branding/logo-${Date.now()}.${extension}`;

        const { error: uploadError } = await supabase.storage
          .from("documents")
          .upload(filePath, logoFile, {
            cacheControl: "3600",
            upsert: false,
          });

        if (uploadError) throw uploadError;

        const { data: publicData } = supabase.storage
          .from("documents")
          .getPublicUrl(filePath);

        companyLogoUrl = publicData.publicUrl;
      }

      const payload = {
        company_name: companyName,
        company_logo_url: companyLogoUrl,
      };

      let savedData: {
        id: string | number;
        company_name: string | null;
        company_logo_url: string | null;
      };

      if (company.id !== null) {
        const { data, error } = await supabase
          .from("company_settings")
          .update(payload)
          .eq("id", company.id)
          .select("id, company_name, company_logo_url")
          .single();

        if (error) throw error;
        if (!data) throw new Error("The company profile could not be saved.");
        savedData = data;
      } else {
        const { data, error } = await supabase
          .from("company_settings")
          .insert(payload)
          .select("id, company_name, company_logo_url")
          .single();

        if (error) throw error;
        if (!data) throw new Error("The company profile could not be created.");
        savedData = data;
      }

      const saved: CompanyForm = {
        id: savedData.id,
        company_name: savedData.company_name || companyName,
        company_logo_url: savedData.company_logo_url || "",
      };

      setCompany(saved);
      setLogoFile(null);

      window.dispatchEvent(
        new CustomEvent("tracon:company-updated", {
          detail: {
            company_name: saved.company_name,
            company_logo_url: saved.company_logo_url,
          },
        })
      );

      setMessage("Company profile and logo saved.");
      setMessageType("success");
    } catch (error) {
      console.error("Unable to save company profile:", error);
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to save the company profile."
      );
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#020617] p-3 text-white sm:p-6">
        <div className="mx-auto max-w-[1400px]">
          <Navbar />
          <div className="mt-6 flex min-h-[420px] items-center justify-center rounded-3xl border border-slate-800 bg-[#07101A]">
            <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#020617] p-3 text-white sm:p-6">
      <div className="mx-auto max-w-[1400px]">
        <Navbar />

        <div className="mt-6">
          <Link
            href="/settings"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-[#07101A] px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-cyan-500/40 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Settings
          </Link>
        </div>

        <section className="mt-4 overflow-hidden rounded-3xl border border-slate-800 bg-[#07101A]">
          <header className="border-b border-slate-800 px-5 py-6 sm:px-8">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-3 text-cyan-400">
                <Building2 className="h-6 w-6" />
              </div>

              <div>
                <p className="text-xs font-bold uppercase tracking-[0.3em] text-cyan-400">
                  Company Settings
                </p>
                <h1 className="mt-2 text-3xl font-bold">Company Profile</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                  Update the carrier name and logo shown in the TRACON Nexus header.
                </p>
              </div>
            </div>
          </header>

          <div className="grid gap-6 p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_minmax(320px,0.8fr)]">
            <section className="rounded-2xl border border-slate-800 bg-[#050d18] p-5">
              <label className="text-sm font-semibold text-white">
                Company name
              </label>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                This name appears beside the logo throughout the dashboard.
              </p>

              <input
                value={company.company_name}
                onChange={(event) =>
                  setCompany((current) => ({
                    ...current,
                    company_name: event.target.value,
                  }))
                }
                placeholder="Company name"
                className="mt-4 w-full rounded-xl border border-slate-700 bg-[#07101A] px-4 py-3 text-white outline-none transition placeholder:text-slate-600 focus:border-cyan-500"
              />

              <button
                type="button"
                onClick={saveCompany}
                disabled={saving}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#1E6BFF] to-[#00A3FF] px-5 py-3 font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
              >
                {saving ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <Save className="h-5 w-5" />
                )}
                {saving ? "Saving..." : "Save Company Profile"}
              </button>

              {message && (
                <div
                  className={`mt-4 flex items-start gap-2 rounded-xl border px-4 py-3 text-sm ${
                    messageType === "error"
                      ? "border-red-500/30 bg-red-500/10 text-red-300"
                      : messageType === "success"
                        ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                        : "border-slate-700 bg-slate-900/60 text-slate-300"
                  }`}
                >
                  {messageType === "success" && (
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                  )}
                  <span>{message}</span>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-slate-800 bg-[#050d18] p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-white">Company logo</h2>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    PNG, JPG, or WebP. Maximum file size: 5 MB.
                  </p>
                </div>

                {(previewUrl || company.company_logo_url) && (
                  <button
                    type="button"
                    onClick={removeLogo}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/10"
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </button>
                )}
              </div>

              <div className="mt-4 flex min-h-48 items-center justify-center rounded-2xl border border-dashed border-slate-700 bg-[#07101A] p-5">
                {previewUrl ? (
                  <img
                    src={previewUrl}
                    alt="Company logo preview"
                    className="max-h-40 max-w-full object-contain"
                  />
                ) : (
                  <div className="text-center text-slate-500">
                    <ImagePlus className="mx-auto h-9 w-9" />
                    <p className="mt-3 text-sm font-semibold">
                      No company logo uploaded
                    </p>
                  </div>
                )}
              </div>

              <label className="mt-4 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/15">
                <ImagePlus className="h-5 w-5" />
                {previewUrl ? "Choose a different logo" : "Upload company logo"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleLogoChange}
                  className="hidden"
                />
              </label>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
