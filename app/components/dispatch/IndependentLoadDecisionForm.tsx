"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BrainCircuit,
  Calculator,
  Fuel,
  LoaderCircle,
  Route,
  UserRound,
} from "lucide-react";
import {
  FINANCIAL_SETTINGS_COLUMNS,
  type CompanyFinancialSettings,
} from "../../lib/financialSettings";
import type { DriverPayRule } from "../../lib/loadDecision";
import type { LoadDecisionDraft } from "../../lib/loadDecisionDraft";
import { supabase } from "../../lib/supabase";
import {
  describeTruckRoutingProfile,
  toRouteTruckInput,
  type TruckRoutingFields,
} from "../../lib/truckRouting";
import RoutePreviewMap from "../maps/RoutePreviewMap";

type IndependentLoadDecisionFormProps = {
  onAnalyze: (draft: LoadDecisionDraft) => void;
};

type DriverOption = {
  id: string;
  name: string;
  pay_type?: string | null;
  pay_rate?: number | string | null;
  truck_mpg?: number | string | null;
  truck_id?: string | null;
};

type TruckOption = TruckRoutingFields & {
  id: string;
  truck_number: string;
  mpg?: number | string | null;
};

type RouteEstimate = {
  miles: number;
  source: string;
  durationMinutes: number | null;
  pickupMatch: string;
  dropoffMatch: string;
  routeCoordinates: [number, number][];
  advisory: string;
  fuelPrice: number | null;
  fuelSource: string;
  fuelAsOf: string | null;
};

const initialForm = {
  pickup: "",
  dropoff: "",
  revenue: "",
  loadedMiles: "",
  deadheadMiles: "",
  driverId: "",
  fuelCost: "",
  otherExpenses: "",
  truckMpg: "",
};

export default function IndependentLoadDecisionForm({
  onAnalyze,
}: IndependentLoadDecisionFormProps) {
  const [settings, setSettings] =
    useState<CompanyFinancialSettings | null>(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsError, setSettingsError] = useState("");
  const [drivers, setDrivers] = useState<DriverOption[]>([]);
  const [trucks, setTrucks] = useState<TruckOption[]>([]);
  const [driversLoading, setDriversLoading] = useState(true);
  const [driversError, setDriversError] = useState("");
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState("");
  const [routeEstimate, setRouteEstimate] =
    useState<RouteEstimate | null>(null);
  const [form, setForm] = useState(initialForm);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    let active = true;

    async function fetchReferenceData() {
      const [settingsResult, driversResult, trucksResult] = await Promise.all([
        supabase
          .from("company_financial_settings")
          .select(FINANCIAL_SETTINGS_COLUMNS)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("drivers")
          .select("id,name,pay_type,pay_rate,truck_mpg,truck_id")
          .eq("active", true)
          .order("name", { ascending: true }),
        supabase
          .from("trucks")
          .select("*")
          .eq("active", true)
          .order("truck_number", { ascending: true }),
      ]);

      if (!active) return;

      if (settingsResult.error) {
        setSettingsError(settingsResult.error.message);
      } else {
        setSettings(
          settingsResult.data as CompanyFinancialSettings | null
        );
      }

      if (driversResult.error) {
        setDriversError(driversResult.error.message);
      } else {
        setDrivers((driversResult.data || []) as DriverOption[]);
      }

      if (!trucksResult.error) {
        setTrucks((trucksResult.data || []) as TruckOption[]);
      }

      setSettingsLoading(false);
      setDriversLoading(false);
    }

    void fetchReferenceData();

    return () => {
      active = false;
    };
  }, []);

  const selectedDriver = useMemo(
    () => drivers.find((driver) => driver.id === form.driverId) ?? null,
    [drivers, form.driverId]
  );

  const driverPayRule = useMemo(
    () => getDriverPayRule(selectedDriver),
    [selectedDriver]
  );

  const selectedTruck = useMemo(
    () =>
      trucks.find((truck) => truck.id === selectedDriver?.truck_id) ?? null,
    [selectedDriver, trucks]
  );

  const calculatedDriverPay = useMemo(
    () =>
      calculateDriverPay(
        driverPayRule,
        positiveNumber(form.revenue),
        positiveNumber(form.loadedMiles)
      ),
    [driverPayRule, form.loadedMiles, form.revenue]
  );

  const calculationMpg = useMemo(() => {
    const manualMpg = positiveNumber(form.truckMpg);
    if (manualMpg > 0) return manualMpg;

    const driverMpg = positiveNumber(String(selectedDriver?.truck_mpg ?? ""));
    if (driverMpg > 0) return driverMpg;

    const selectedTruckMpg = positiveNumber(String(selectedTruck?.mpg ?? ""));
    if (selectedTruckMpg > 0) return selectedTruckMpg;

    return positiveNumber(String(settings?.default_mpg ?? ""));
  }, [form.truckMpg, selectedDriver, selectedTruck, settings]);

  const calculationFuelPrice =
    routeEstimate?.fuelPrice ??
    positiveNumber(String(settings?.default_fuel_price ?? ""));

  const estimatedFuelCost = useMemo(() => {
    const totalMiles =
      positiveNumber(form.loadedMiles) +
      positiveNumber(form.deadheadMiles);

    if (totalMiles <= 0 || calculationMpg <= 0) return 0;

    return roundMoney((totalMiles / calculationMpg) * calculationFuelPrice);
  }, [
    calculationFuelPrice,
    calculationMpg,
    form.deadheadMiles,
    form.loadedMiles,
  ]);

  const updateField = (field: keyof typeof initialForm, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));

    if (field === "pickup" || field === "dropoff") {
      setRouteEstimate(null);
      setRouteError("");
    }
  };

  const estimateRouteAndFuel = async () => {
    setRouteError("");
    setFormError("");

    if (!form.pickup.trim() || !form.dropoff.trim()) {
      setRouteError("Enter both pickup and delivery before estimating.");
      return;
    }

    try {
      setRouteLoading(true);

      const routeResponse = await fetch("/api/route-mileage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pickup: form.pickup,
          dropoff: form.dropoff,
          truck: toRouteTruckInput(selectedTruck),
        }),
      });

      const routeData = (await routeResponse.json()) as {
        miles?: number;
        source?: string;
        duration_minutes?: number | null;
        pickup_match?: string;
        dropoff_match?: string;
        route?: {
          type?: string;
          coordinates?: [number, number][];
        };
        advisory?: string;
        state_miles?: Array<{ state: string; miles: number }>;
        error?: string;
      };

      if (!routeResponse.ok || !positiveNumber(String(routeData.miles ?? ""))) {
        throw new Error(
          routeData.error || "Truck mileage could not be calculated."
        );
      }

      const miles = positiveNumber(String(routeData.miles));
      let fuelPrice: number | null = null;
      let fuelSource = "Company default diesel price";
      let fuelAsOf: string | null = null;

      if (Array.isArray(routeData.state_miles) && routeData.state_miles.length) {
        try {
          const fuelResponse = await fetch("/api/diesel-price", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ state_miles: routeData.state_miles }),
          });
          const fuelData = (await fuelResponse.json()) as {
            price_per_gallon?: number;
            source?: string;
            as_of?: string;
          };
          const regionalPrice = positiveNumber(
            String(fuelData.price_per_gallon ?? "")
          );

          if (fuelResponse.ok && regionalPrice > 0) {
            fuelPrice = regionalPrice;
            fuelSource = fuelData.source || "Regional diesel estimate";
            fuelAsOf = fuelData.as_of || null;
          }
        } catch (error) {
          console.warn("Regional fuel estimate unavailable:", error);
        }
      }

      setForm((current) => ({
        ...current,
        loadedMiles: String(miles),
      }));
      setRouteEstimate({
        miles,
        source: routeData.source || "Estimated truck route",
        durationMinutes:
          typeof routeData.duration_minutes === "number"
            ? routeData.duration_minutes
            : null,
        pickupMatch: routeData.pickup_match || form.pickup.trim(),
        dropoffMatch: routeData.dropoff_match || form.dropoff.trim(),
        routeCoordinates: Array.isArray(routeData.route?.coordinates)
          ? routeData.route.coordinates
          : [],
        advisory:
          routeData.advisory ||
          "Route estimates are advisory. Follow posted commercial-vehicle restrictions.",
        fuelPrice,
        fuelSource,
        fuelAsOf,
      });
    } catch (error) {
      setRouteEstimate(null);
      setRouteError(
        error instanceof Error
          ? error.message
          : "Truck mileage could not be calculated. Enter it manually."
      );
    } finally {
      setRouteLoading(false);
    }
  };

  const analyze = () => {
    setFormError("");

    if (!settings) {
      setFormError(
        "Company financial settings must be available before analyzing a load."
      );
      return;
    }

    const revenue = positiveNumber(form.revenue);
    const loadedMiles = positiveNumber(form.loadedMiles);

    if (!form.pickup.trim() || !form.dropoff.trim()) {
      setFormError("Enter both pickup and delivery locations.");
      return;
    }

    if (!selectedDriver) {
      setFormError("Select a driver so the saved driver pay rule can be used.");
      return;
    }

    if (driverPayRule.type === "None" || driverPayRule.rate <= 0) {
      setFormError(
        `${selectedDriver.name} does not have a valid pay method and rate in Driver Settings.`
      );
      return;
    }

    if (revenue <= 0 || loadedMiles <= 0) {
      setFormError("Revenue and loaded miles must be greater than zero.");
      return;
    }

    const draft: LoadDecisionDraft = {
      version: 1,
      pickup: form.pickup.trim(),
      dropoff: form.dropoff.trim(),
      input: {
        revenue,
        loadedMiles,
        deadheadMiles: positiveNumber(form.deadheadMiles),
        driverPay: calculatedDriverPay,
        manualFuelCost: form.fuelCost.trim()
          ? positiveNumber(form.fuelCost)
          : null,
        otherExpenses: positiveNumber(form.otherExpenses),
        truckMpg:
          form.truckMpg.trim() || positiveNumber(String(selectedDriver.truck_mpg ?? "")) > 0
            ? calculationMpg
            : null,
        estimatedFuelPrice: routeEstimate?.fuelPrice ?? null,
        settings,
      },
      driverPayRule,
      savedAt: new Date().toISOString(),
    };

    onAnalyze(draft);
  };

  return (
    <div className="p-4 sm:p-6 lg:p-7">
      <section className="rounded-3xl border border-slate-800 bg-[#050e1a] p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-cyan-400/30 bg-cyan-400/10 text-cyan-300">
              <Calculator className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-cyan-300">
                Independent analysis
              </p>
              <h2 className="mt-2 text-xl font-semibold text-white">
                Evaluate a load before creating it
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
                Enter a broker offer manually. Nothing is saved to Dispatch or
                written to the database.
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-[#081525] px-4 py-3 text-xs text-slate-400">
            {settingsLoading
              ? "Loading company cost settings…"
              : settings
                ? "Company fuel, insurance, and factoring settings loaded"
                : "Company cost settings unavailable"}
          </div>
        </div>

        {settingsError && (
          <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            Financial settings could not be loaded: {settingsError}
          </div>
        )}

        {driversError && (
          <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            Drivers could not be loaded: {driversError}
          </div>
        )}

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <DecisionField
            label="Pickup"
            value={form.pickup}
            onChange={(value) => updateField("pickup", value)}
            placeholder="City, State"
            icon="route"
          />
          <DecisionField
            label="Delivery"
            value={form.dropoff}
            onChange={(value) => updateField("dropoff", value)}
            placeholder="City, State"
            icon="route"
          />
          <div className="flex flex-col justify-end">
            <span className="text-xs font-semibold text-slate-300">
              Route lookup
            </span>
            <button
              type="button"
              onClick={() => void estimateRouteAndFuel()}
              disabled={
                routeLoading || !form.pickup.trim() || !form.dropoff.trim()
              }
              className="mt-2 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-400/10 px-4 py-3 text-sm font-semibold text-cyan-200 transition hover:border-cyan-300/60 hover:bg-cyan-400/15 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {routeLoading ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Route className="h-4 w-4" />
              )}
              {routeLoading ? "Estimating route…" : "Estimate miles & fuel"}
            </button>
          </div>
          <DecisionField
            label="Broker offer"
            value={form.revenue}
            onChange={(value) => updateField("revenue", value)}
            placeholder="0.00"
            prefix="$"
            type="number"
          />
          <DecisionField
            label="Loaded miles"
            value={form.loadedMiles}
            onChange={(value) => updateField("loadedMiles", value)}
            placeholder="0"
            suffix="mi"
            type="number"
          />
          <DecisionField
            label="Deadhead miles"
            value={form.deadheadMiles}
            onChange={(value) => updateField("deadheadMiles", value)}
            placeholder="0"
            suffix="mi"
            type="number"
          />
          <label className="block">
            <span className="text-xs font-semibold text-slate-300">
              Driver
            </span>
            <span className="mt-2 flex items-center gap-2 rounded-xl border border-slate-700 bg-[#081525] px-3 focus-within:border-cyan-400/60">
              <UserRound className="h-4 w-4 shrink-0 text-slate-500" />
              <select
                value={form.driverId}
                onChange={(event) => updateField("driverId", event.target.value)}
                disabled={driversLoading}
                className="min-w-0 flex-1 bg-transparent py-3 text-sm text-white outline-none disabled:opacity-50"
              >
                <option value="" className="bg-[#081525]">
                  {driversLoading ? "Loading drivers…" : "Select driver"}
                </option>
                {drivers.map((driver) => (
                  <option
                    key={driver.id}
                    value={driver.id}
                    className="bg-[#081525]"
                  >
                    {driver.name} · {formatDriverPayRule(getDriverPayRule(driver))}
                  </option>
                ))}
              </select>
            </span>
          </label>
          <ReadOnlyMetric
            label="Calculated driver pay"
            value={selectedDriver ? formatMoney(calculatedDriverPay) : "Select driver"}
            detail={
              selectedDriver
                ? formatDriverPayRule(driverPayRule)
                : "Uses the driver's saved pay settings"
            }
            icon="driver"
          />
          <ReadOnlyMetric
            label="Truck routing profile"
            value={selectedTruck?.truck_number || "Generic truck"}
            detail={
              selectedTruck
                ? describeTruckRoutingProfile(selectedTruck)
                : "Assign a truck in Driver Settings for vehicle-specific routing"
            }
            icon="driver"
          />
          <DecisionField
            label="Manual fuel override"
            value={form.fuelCost}
            onChange={(value) => updateField("fuelCost", value)}
            placeholder="Blank = estimated fuel"
            prefix="$"
            type="number"
          />
          <ReadOnlyMetric
            label="Estimated fuel cost"
            value={estimatedFuelCost > 0 ? formatMoney(estimatedFuelCost) : "$0.00"}
            detail={`${formatNumber(calculationMpg)} mpg · ${formatMoney(calculationFuelPrice)}/gal`}
            icon="fuel"
          />
          <DecisionField
            label="Other expenses"
            value={form.otherExpenses}
            onChange={(value) => updateField("otherExpenses", value)}
            placeholder="0.00"
            prefix="$"
            type="number"
          />
          <DecisionField
            label="Truck MPG"
            value={form.truckMpg}
            onChange={(value) => updateField("truckMpg", value)}
            placeholder="Blank = company default"
            suffix="mpg"
            type="number"
          />
        </div>

        {routeEstimate && (
          <div className="mt-5 space-y-4 rounded-2xl border border-cyan-400/20 bg-cyan-400/5 p-4 text-xs">
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <p className="font-semibold text-cyan-200">
                  {formatNumber(routeEstimate.miles)} loaded miles
                </p>
                <p className="mt-1 text-slate-500">{routeEstimate.source}</p>
              </div>
              <div>
                <p className="font-semibold text-cyan-200">
                  {routeEstimate.durationMinutes
                    ? formatDuration(routeEstimate.durationMinutes)
                    : "Drive time unavailable"}
                </p>
                <p className="mt-1 text-slate-500">
                  Estimated travel time before stops and delays
                </p>
              </div>
              <div>
                <p className="font-semibold text-cyan-200">
                  {routeEstimate.fuelPrice
                    ? `${formatMoney(routeEstimate.fuelPrice)}/gal EIA estimate`
                    : `${formatMoney(calculationFuelPrice)}/gal company default`}
                </p>
                <p className="mt-1 text-slate-500">
                  {routeEstimate.fuelSource}
                  {routeEstimate.fuelAsOf
                    ? ` · updated ${routeEstimate.fuelAsOf}`
                    : ""}
                </p>
              </div>
            </div>

            {routeEstimate.routeCoordinates.length >= 2 && (
              <RoutePreviewMap
                coordinates={routeEstimate.routeCoordinates}
                pickupLabel={routeEstimate.pickupMatch}
                dropoffLabel={routeEstimate.dropoffMatch}
              />
            )}

            <p className="leading-5 text-amber-200/80">
              {routeEstimate.advisory}
            </p>
          </div>
        )}

        {routeError && (
          <p className="mt-5 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-200">
            {routeError} You can still enter loaded miles manually.
          </p>
        )}

        {formError && (
          <p className="mt-5 rounded-xl border border-amber-400/30 bg-amber-400/10 p-4 text-sm text-amber-200">
            {formError}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs leading-5 text-slate-500">
            Driver pay comes from Driver Settings. Fuel uses the latest EIA
            diesel estimate when available and falls back to company defaults.
          </p>
          <button
            type="button"
            onClick={analyze}
            disabled={
              settingsLoading || driversLoading || !settings || !selectedDriver
            }
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#1E6BFF] to-[#00A3FF] px-5 py-3 text-sm font-semibold text-white shadow-[0_0_18px_rgba(30,107,255,0.35)] transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <BrainCircuit className="h-4 w-4" />
            Analyze load
          </button>
        </div>
      </section>
    </div>
  );
}

function DecisionField({
  label,
  value,
  onChange,
  placeholder,
  prefix,
  suffix,
  type = "text",
  icon,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  prefix?: string;
  suffix?: string;
  type?: "text" | "number";
  icon?: "route";
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-slate-300">{label}</span>
      <span className="mt-2 flex items-center gap-2 rounded-xl border border-slate-700 bg-[#081525] px-3 focus-within:border-cyan-400/60">
        {icon === "route" && <Route className="h-4 w-4 text-slate-500" />}
        {prefix && <span className="text-sm text-slate-500">{prefix}</span>}
        <input
          type={type}
          min={type === "number" ? "0" : undefined}
          step={type === "number" ? "0.01" : undefined}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="min-w-0 flex-1 bg-transparent py-3 text-sm text-white outline-none placeholder:text-slate-600"
        />
        {suffix && <span className="text-xs text-slate-500">{suffix}</span>}
      </span>
    </label>
  );
}

function ReadOnlyMetric({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: "driver" | "fuel";
}) {
  return (
    <div>
      <span className="text-xs font-semibold text-slate-300">{label}</span>
      <div className="mt-2 flex min-h-12 items-center gap-3 rounded-xl border border-slate-700 bg-[#081525] px-3 py-2.5">
        {icon === "driver" ? (
          <UserRound className="h-4 w-4 shrink-0 text-cyan-400" />
        ) : (
          <Fuel className="h-4 w-4 shrink-0 text-cyan-400" />
        )}
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{value}</p>
          <p className="truncate text-[10px] text-slate-500">{detail}</p>
        </div>
      </div>
    </div>
  );
}

function getDriverPayRule(driver: DriverOption | null): DriverPayRule {
  if (!driver) return { type: "None", rate: 0 };

  const payType = String(driver.pay_type || "").trim().toLowerCase();
  const rate = positiveNumber(String(driver.pay_rate ?? ""));

  if (payType === "cpm" || payType.includes("per mile")) {
    return { type: "CPM", rate };
  }

  if (payType.includes("percent")) {
    return { type: "Percentage", rate };
  }

  if (payType.includes("flat")) {
    return { type: "Flat", rate };
  }

  return { type: "None", rate };
}

function calculateDriverPay(
  rule: DriverPayRule,
  revenue: number,
  loadedMiles: number
) {
  if (rule.type === "CPM") return roundMoney(loadedMiles * rule.rate);
  if (rule.type === "Percentage") {
    return roundMoney(revenue * (rule.rate / 100));
  }
  if (rule.type === "Flat") return roundMoney(rule.rate);
  return 0;
}

function formatDriverPayRule(rule: DriverPayRule) {
  if (rule.type === "CPM") return `${formatMoney(rule.rate)}/mile`;
  if (rule.type === "Percentage") return `${formatNumber(rule.rate)}%`;
  if (rule.type === "Flat") return `${formatMoney(rule.rate)} flat`;
  return "Pay setup missing";
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function formatDuration(totalMinutes: number) {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) return `${minutes} min estimated drive time`;
  if (minutes === 0) return `${hours} hr estimated drive time`;

  return `${hours} hr ${minutes} min estimated drive time`;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function positiveNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}
