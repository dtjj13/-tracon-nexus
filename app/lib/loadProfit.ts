import {
  type CompanyFinancialSettings,
  toProfitCalculationDefaults,
} from "./financialSettings";

export type FuelCostSource = "manual" | "estimated";

export type LoadProfitInput = {
  revenue: number;
  loadedMiles: number;
  deadheadMiles: number;
  driverPay: number;
  manualFuelCost?: number | null;
  otherExpenses?: number;
  truckMpg?: number | null;
  settings: CompanyFinancialSettings;
};

export type LoadProfitResult = {
  totalMiles: number;
  driverPay: number;
  fuelCost: number;
  fuelCostSource: FuelCostSource;
  fuelMpgUsed: number | null;
  fuelPriceUsed: number | null;
  insuranceRatePerMile: number;
  insuranceCost: number;
  factoringPercentUsed: number;
  factoringCost: number;
  otherExpenses: number;
  totalExpenses: number;
  netProfit: number;
  profitMargin: number;
  calculationVersion: number;
};

export function calculateLoadProfit({
  revenue,
  loadedMiles,
  deadheadMiles,
  driverPay,
  manualFuelCost,
  otherExpenses = 0,
  truckMpg,
  settings,
}: LoadProfitInput): LoadProfitResult {
  const safeRevenue = nonNegative(revenue);
  const safeLoadedMiles = nonNegative(loadedMiles);
  const safeDeadheadMiles = nonNegative(deadheadMiles);
  const safeDriverPay = nonNegative(driverPay);
  const safeOtherExpenses = nonNegative(otherExpenses);

  const totalMiles = round(
    safeLoadedMiles + safeDeadheadMiles,
    2
  );

  const defaults = toProfitCalculationDefaults(settings);

  const insuranceRatePerMile = round(
    defaults.insurancePerMile,
    4
  );

  const insuranceCost = round(
    totalMiles * insuranceRatePerMile,
    2
  );

  const selectedMpg =
    truckMpg && truckMpg > 0
      ? truckMpg
      : defaults.defaultMpg;

  const hasManualFuelCost =
    manualFuelCost !== null &&
    manualFuelCost !== undefined &&
    Number.isFinite(Number(manualFuelCost)) &&
    Number(manualFuelCost) > 0;

  const estimatedFuelCost =
    selectedMpg > 0
      ? (totalMiles / selectedMpg) *
        defaults.defaultFuelPrice
      : 0;

  const fuelCost = round(
    hasManualFuelCost
      ? Number(manualFuelCost)
      : estimatedFuelCost,
    2
  );

  const fuelCostSource: FuelCostSource =
    hasManualFuelCost ? "manual" : "estimated";

  const factoringPercentUsed = round(
    nonNegative(settings.factoring_percent),
    3
  );

  const factoringCost = round(
    safeRevenue * (factoringPercentUsed / 100),
    2
  );

  const totalExpenses = round(
    safeDriverPay +
      fuelCost +
      insuranceCost +
      factoringCost +
      safeOtherExpenses,
    2
  );

  const netProfit = round(
    safeRevenue - totalExpenses,
    2
  );

  const profitMargin =
    safeRevenue > 0
      ? round((netProfit / safeRevenue) * 100, 4)
      : 0;

  return {
    totalMiles,
    driverPay: safeDriverPay,
    fuelCost,
    fuelCostSource,
    fuelMpgUsed: hasManualFuelCost
      ? null
      : round(selectedMpg, 2),
    fuelPriceUsed: hasManualFuelCost
      ? null
      : round(defaults.defaultFuelPrice, 3),
    insuranceRatePerMile,
    insuranceCost,
    factoringPercentUsed,
    factoringCost,
    otherExpenses: safeOtherExpenses,
    totalExpenses,
    netProfit,
    profitMargin,
    calculationVersion: 1,
  };
}

export function toLoadProfitColumns(
  result: LoadProfitResult
) {
  return {
    driver_pay: result.driverPay,
    fuel_cost: result.fuelCost,
    fuel_cost_source: result.fuelCostSource,
    fuel_mpg_used: result.fuelMpgUsed,
    fuel_price_used: result.fuelPriceUsed,
    insurance_rate_per_mile:
      result.insuranceRatePerMile,
    insurance_cost: result.insuranceCost,
    factoring_percent_used:
      result.factoringPercentUsed,
    factoring_cost: result.factoringCost,
    other_expenses: result.otherExpenses,
    total_expenses: result.totalExpenses,
    net_profit: result.netProfit,
    profit_margin: result.profitMargin,

    // Keep the existing profit field working
    // while the dashboard transitions to net_profit.
    profit: result.netProfit,

    calculation_version:
      result.calculationVersion,
    profit_calculated_at: new Date().toISOString(),
  };
}

function nonNegative(value: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return parsed;
}

function round(value: number, decimals: number) {
  const multiplier = 10 ** decimals;

  return (
    Math.round((value + Number.EPSILON) * multiplier) /
    multiplier
  );
}