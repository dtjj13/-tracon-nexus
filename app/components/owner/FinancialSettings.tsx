"use client";

import {
  Calculator,
  CheckCircle2,
  CircleDollarSign,
  Fuel,
  Gauge,
  Loader2,
  Percent,
  RefreshCw,
  Save,
  ShieldCheck,
} from "lucide-react";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  calculateInsurancePerMile,
  type CompanyFinancialSettings,
  type EditableFinancialSettings,
  FINANCIAL_SETTINGS_COLUMNS,
} from "@/app/lib/financialSettings";
import { supabase } from "@/app/lib/supabase";

type FormValues = Record<keyof EditableFinancialSettings, string>;
type FormErrors = Partial<Record<keyof FormValues, string>>;

const emptyForm: FormValues = {
  monthly_insurance_per_truck: "",
  average_monthly_miles_per_truck: "",
  default_mpg: "",
  default_fuel_price: "",
  factoring_percent: "",
};

function rowToForm(row: CompanyFinancialSettings): FormValues {
  return {
    monthly_insurance_per_truck: String(
      row.monthly_insurance_per_truck ?? ""
    ),
    average_monthly_miles_per_truck: String(
      row.average_monthly_miles_per_truck ?? ""
    ),
    default_mpg: String(row.default_mpg ?? ""),
    default_fuel_price: String(row.default_fuel_price ?? ""),
    factoring_percent: String(row.factoring_percent ?? ""),
  };
}

function parseForm(values: FormValues) {
  return {
    monthly_insurance_per_truck: Number(
      values.monthly_insurance_per_truck
    ),
    average_monthly_miles_per_truck: Number(
      values.average_monthly_miles_per_truck
    ),
    default_mpg: Number(values.default_mpg),
    default_fuel_price: Number(values.default_fuel_price),
    factoring_percent: Number(values.factoring_percent),
  } satisfies EditableFinancialSettings;
}

function validateForm(values: FormValues) {
  const errors: FormErrors = {};
  const parsed = parseForm(values);

  if (
    values.monthly_insurance_per_truck.trim() === "" ||
    !Number.isFinite(parsed.monthly_insurance_per_truck) ||
    parsed.monthly_insurance_per_truck < 0
  ) {
    errors.monthly_insurance_per_truck =
      "Enter a monthly amount of $0 or more.";
  }

  if (
    values.average_monthly_miles_per_truck.trim() === "" ||
    !Number.isFinite(parsed.average_monthly_miles_per_truck) ||
    parsed.average_monthly_miles_per_truck <= 0
  ) {
    errors.average_monthly_miles_per_truck =
      "Enter average monthly miles greater than 0.";
  }

  if (
    values.default_mpg.trim() === "" ||
    !Number.isFinite(parsed.default_mpg) ||
    parsed.default_mpg <= 0
  ) {
    errors.default_mpg = "Enter an MPG greater than 0.";
  }

  if (
    values.default_fuel_price.trim() === "" ||
    !Number.isFinite(parsed.default_fuel_price) ||
    parsed.default_fuel_price < 0
  ) {
    errors.default_fuel_price = "Enter a fuel price of $0 or more.";
  }

  if (
    values.factoring_percent.trim() === "" ||
    !Number.isFinite(parsed.factoring_percent) ||
    parsed.factoring_percent < 0 ||
    parsed.factoring_percent > 100
  ) {
    errors.factoring_percent = "Enter a percentage from 0 to 100.";
  }

  return errors;
}

export default function FinancialSettings() {
  const [settingsRow, setSettingsRow] =
    useState<CompanyFinancialSettings | null>(null);
  const [values, setValues] = useState<FormValues>(emptyForm);
  const [savedValues, setSavedValues] = useState<FormValues>(emptyForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [status, setStatus] = useState("");

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setLoadError("");

    const { data, error } = await supabase
      .from("company_financial_settings")
      .select(FINANCIAL_SETTINGS_COLUMNS)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Unable to load financial settings:", error);
      setLoadError(
        "We couldn’t load your company’s financial settings. Check your connection and try again."
      );
      setLoading(false);
      return;
    }

    if (!data) {
      setLoadError(
        "No company financial settings row was found. Add the initial settings row in Supabase, then try again."
      );
      setLoading(false);
      return;
    }

    const row = data as CompanyFinancialSettings;
    const formValues = rowToForm(row);

    setSettingsRow(row);
    setValues(formValues);
    setSavedValues(formValues);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const insurancePerMile = useMemo(
    () =>
      calculateInsurancePerMile(
        Number(values.monthly_insurance_per_truck),
        Number(values.average_monthly_miles_per_truck)
      ),
    [
      values.average_monthly_miles_per_truck,
      values.monthly_insurance_per_truck,
    ]
  );

  const isDirty = JSON.stringify(values) !== JSON.stringify(savedValues);

  function updateValue(field: keyof FormValues, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setStatus("");
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!settingsRow || saving) return;

    const nextErrors = validateForm(values);
    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setStatus("Review the highlighted fields before saving.");
      return;
    }

    setSaving(true);
    setStatus("");

    const payload = parseForm(values);
    const { data, error } = await supabase
      .from("company_financial_settings")
      .update({
        ...payload,
        updated_at: new Date().toISOString(),
      })
      .eq("id", settingsRow.id)
      .select(FINANCIAL_SETTINGS_COLUMNS)
      .single();

    if (error) {
      console.error("Unable to save financial settings:", error);
      setStatus(
        "Your changes weren’t saved. Please check your connection and try again."
      );
      setSaving(false);
      return;
    }

    const updatedRow = data as CompanyFinancialSettings;
    const updatedValues = rowToForm(updatedRow);

    setSettingsRow(updatedRow);
    setValues(updatedValues);
    setSavedValues(updatedValues);
    setStatus("Financial settings saved. Future load calculations can use these defaults.");
    setSaving(false);
  }

  if (loading) {
    return <FinancialSettingsSkeleton />;
  }

  if (loadError || !settingsRow) {
    return (
      <section className="rounded-3xl border border-red-500/20 bg-[#07101A] p-6 shadow-2xl shadow-black/20 sm:p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-red-500/20 bg-red-500/10 text-red-300">
          <RefreshCw className="h-5 w-5" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold text-white">
          Financial settings unavailable
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
          {loadError}
        </p>
        <button
          type="button"
          onClick={() => void loadSettings()}
          className="mt-6 inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-[#0B1522] px-4 py-2.5 text-sm font-semibold text-white transition hover:border-cyan-500/50 hover:text-cyan-300"
        >
          <RefreshCw className="h-4 w-4" />
          Try again
        </button>
      </section>
    );
  }

  const isErrorStatus =
    status.includes("highlighted") || status.includes("weren’t saved");

  return (
    <section className="overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-br from-[#07101A] via-[#07111D] to-[#040A12] shadow-2xl shadow-black/20">
      <div className="relative overflow-hidden border-b border-slate-800 px-6 py-7 sm:px-8 sm:py-8">
        <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/20 bg-cyan-400/10 text-cyan-300">
                <Calculator className="h-5 w-5" />
              </span>
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-cyan-400">
                Company financials
              </p>
            </div>
            <h1 className="mt-5 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Financial Settings
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400 sm:text-base">
              Set the company-wide defaults TRACON Nexus will use for estimated
              fuel, insurance, factoring, and future load-profit calculations.
            </p>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <span
              className={`h-2 w-2 rounded-full ${
                isDirty ? "bg-amber-400" : "bg-emerald-400"
              }`}
            />
            <span className={isDirty ? "text-amber-300" : "text-slate-400"}>
              {isDirty ? "Unsaved changes" : "Settings up to date"}
            </span>
          </div>
        </div>
      </div>

      <form onSubmit={saveSettings} noValidate>
        <div className="grid gap-6 p-6 sm:p-8 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-8">
            <SettingsGroup
              icon={<ShieldCheck className="h-5 w-5" />}
              title="Insurance defaults"
              description="Used to assign a fair share of monthly insurance to every mile a truck runs."
            >
              <FinancialField
                id="monthly-insurance"
                label="Monthly insurance per truck"
                description="The average monthly premium for one truck."
                value={values.monthly_insurance_per_truck}
                onChange={(value) =>
                  updateValue("monthly_insurance_per_truck", value)
                }
                error={errors.monthly_insurance_per_truck}
                prefix="$"
                min="0"
                step="0.01"
                inputMode="decimal"
              />
              <FinancialField
                id="monthly-miles"
                label="Average monthly miles per truck"
                description="Include both loaded and empty operating miles."
                value={values.average_monthly_miles_per_truck}
                onChange={(value) =>
                  updateValue("average_monthly_miles_per_truck", value)
                }
                error={errors.average_monthly_miles_per_truck}
                suffix="mi"
                min="1"
                step="1"
                inputMode="numeric"
              />
            </SettingsGroup>

            <SettingsGroup
              icon={<Fuel className="h-5 w-5" />}
              title="Fuel defaults"
              description="Provides a reliable estimate when an actual fuel expense has not been entered."
            >
              <FinancialField
                id="default-mpg"
                label="Default MPG"
                description="Your fleet’s typical miles per gallon."
                value={values.default_mpg}
                onChange={(value) => updateValue("default_mpg", value)}
                error={errors.default_mpg}
                suffix="MPG"
                min="0.1"
                step="0.1"
                inputMode="decimal"
              />
              <FinancialField
                id="fuel-price"
                label="Default fuel price"
                description="Average diesel price used for estimates."
                value={values.default_fuel_price}
                onChange={(value) => updateValue("default_fuel_price", value)}
                error={errors.default_fuel_price}
                prefix="$"
                suffix="/gal"
                min="0"
                step="0.001"
                inputMode="decimal"
              />
            </SettingsGroup>

            <SettingsGroup
              icon={<Percent className="h-5 w-5" />}
              title="Factoring default"
              description="Applied to load revenue when estimating the cost of factoring an invoice."
            >
              <FinancialField
                id="factoring-percent"
                label="Factoring percentage"
                description="Enter 0 if your company does not factor invoices."
                value={values.factoring_percent}
                onChange={(value) => updateValue("factoring_percent", value)}
                error={errors.factoring_percent}
                suffix="%"
                min="0"
                max="100"
                step="0.001"
                inputMode="decimal"
              />
            </SettingsGroup>
          </div>

          <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
            <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.06] p-6">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-400">
                  Insurance per mile
                </p>
                <Gauge className="h-5 w-5 text-cyan-300" />
              </div>
              <div className="mt-5 flex items-baseline gap-2">
                <span className="text-4xl font-semibold tracking-tight text-white">
                  ${insurancePerMile.toFixed(4)}
                </span>
                <span className="text-sm font-medium text-slate-400">/ mi</span>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-400">
                Updates instantly as insurance or monthly mileage changes.
              </p>
              <div className="mt-5 rounded-xl border border-slate-700/70 bg-[#07101A]/80 p-4 text-sm text-slate-400">
                <div className="flex items-center justify-between gap-3">
                  <span>Monthly insurance</span>
                  <span className="font-medium text-slate-200">
                    {formatCurrency(Number(values.monthly_insurance_per_truck))}
                  </span>
                </div>
                <div className="my-3 h-px bg-slate-800" />
                <div className="flex items-center justify-between gap-3">
                  <span>Monthly miles</span>
                  <span className="font-medium text-slate-200">
                    {formatMiles(
                      Number(values.average_monthly_miles_per_truck)
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-800 bg-[#0B1522]/80 p-5">
              <div className="flex items-center gap-3">
                <CircleDollarSign className="h-5 w-5 text-emerald-400" />
                <h2 className="font-semibold text-white">Profit-ready defaults</h2>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                These values are stored as the source of truth for insurance,
                estimated fuel, and factoring costs on future loads.
              </p>
            </div>
          </aside>
        </div>

        <div className="flex flex-col gap-4 border-t border-slate-800 bg-[#050B13]/80 px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div aria-live="polite" className="min-h-6">
            {status && (
              <p
                className={`flex items-start gap-2 text-sm ${
                  isErrorStatus ? "text-red-300" : "text-emerald-300"
                }`}
              >
                {!isErrorStatus && (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                )}
                {status}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={saving || !isDirty}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#16BFFF] px-6 py-3 text-sm font-bold text-[#020617] shadow-lg shadow-cyan-500/10 transition hover:bg-cyan-300 focus:outline-none focus:ring-2 focus:ring-cyan-300 focus:ring-offset-2 focus:ring-offset-[#050B13] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {saving ? "Saving settings…" : "Save financial settings"}
          </button>
        </div>
      </form>
    </section>
  );
}

function SettingsGroup({
  icon,
  title,
  description,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <fieldset>
      <legend className="sr-only">{title}</legend>
      <div className="mb-4 flex items-start gap-3">
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-700 bg-[#0B1522] text-cyan-300">
          {icon}
        </span>
        <div>
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <p className="mt-1 text-sm leading-5 text-slate-500">{description}</p>
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">{children}</div>
    </fieldset>
  );
}

function FinancialField({
  id,
  label,
  description,
  value,
  onChange,
  error,
  prefix,
  suffix,
  min,
  max,
  step,
  inputMode,
}: {
  id: string;
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  prefix?: string;
  suffix?: string;
  min?: string;
  max?: string;
  step: string;
  inputMode: "decimal" | "numeric";
}) {
  const descriptionId = `${id}-description`;
  const errorId = `${id}-error`;

  return (
    <div className="rounded-2xl border border-slate-800 bg-[#09121E]/70 p-4 transition focus-within:border-cyan-500/50 focus-within:bg-[#0B1522]">
      <label htmlFor={id} className="block text-sm font-semibold text-slate-200">
        {label}
      </label>
      <p id={descriptionId} className="mt-1 text-xs leading-5 text-slate-500">
        {description}
      </p>
      <div className="relative mt-3">
        {prefix && (
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
            {prefix}
          </span>
        )}
        <input
          id={id}
          name={id}
          type="number"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-describedby={`${descriptionId}${error ? ` ${errorId}` : ""}`}
          aria-invalid={Boolean(error)}
          inputMode={inputMode}
          min={min}
          max={max}
          step={step}
          className={`min-h-12 w-full rounded-xl border bg-[#050C15] py-3 text-base font-semibold text-white outline-none transition placeholder:text-slate-700 focus:ring-2 focus:ring-cyan-500/15 ${
            error
              ? "border-red-500/60 focus:border-red-400"
              : "border-slate-700 focus:border-cyan-400/70"
          } ${prefix ? "pl-9" : "pl-4"} ${suffix ? "pr-16" : "pr-4"}`}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs font-medium text-slate-500">
            {suffix}
          </span>
        )}
      </div>
      {error && (
        <p id={errorId} className="mt-2 text-xs text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}

function FinancialSettingsSkeleton() {
  return (
    <section
      aria-label="Loading financial settings"
      className="animate-pulse overflow-hidden rounded-3xl border border-slate-800 bg-[#07101A]"
    >
      <div className="border-b border-slate-800 p-8">
        <div className="h-4 w-44 rounded bg-slate-800" />
        <div className="mt-5 h-10 w-72 max-w-full rounded bg-slate-800" />
        <div className="mt-4 h-4 w-full max-w-2xl rounded bg-slate-800/70" />
      </div>
      <div className="grid gap-5 p-8 md:grid-cols-2">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-32 rounded-2xl bg-slate-800/60" />
        ))}
      </div>
    </section>
  );
}

function formatCurrency(value: number) {
  if (!Number.isFinite(value)) return "$0.00";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatMiles(value: number) {
  if (!Number.isFinite(value)) return "0 mi";

  return `${new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 0,
  }).format(value)} mi`;
}
