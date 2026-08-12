export const FINANCIAL_SETTINGS_COLUMNS =
  "id,company_id,monthly_insurance_per_truck,average_monthly_miles_per_truck,insurance_per_mile,default_mpg,default_fuel_price,factoring_percent,created_at,updated_at" as const;

export type CompanyFinancialSettings = {
  id: string;
  company_id: string | null;
  monthly_insurance_per_truck: number;
  average_monthly_miles_per_truck: number;
  insurance_per_mile: number;
  default_mpg: number;
  default_fuel_price: number;
  factoring_percent: number;
  created_at: string;
  updated_at: string;
};

export type EditableFinancialSettings = Pick<
  CompanyFinancialSettings,
  | "monthly_insurance_per_truck"
  | "average_monthly_miles_per_truck"
  | "default_mpg"
  | "default_fuel_price"
  | "factoring_percent"
>;

export type ProfitCalculationDefaults = {
  insurancePerMile: number;
  defaultMpg: number;
  defaultFuelPrice: number;
  factoringRate: number;
};

export function calculateInsurancePerMile(
  monthlyInsurancePerTruck: number,
  averageMonthlyMilesPerTruck: number
) {
  if (
    !Number.isFinite(monthlyInsurancePerTruck) ||
    !Number.isFinite(averageMonthlyMilesPerTruck) ||
    monthlyInsurancePerTruck < 0 ||
    averageMonthlyMilesPerTruck <= 0
  ) {
    return 0;
  }

  return monthlyInsurancePerTruck / averageMonthlyMilesPerTruck;
}

export function toProfitCalculationDefaults(
  settings: CompanyFinancialSettings
): ProfitCalculationDefaults {
  return {
    insurancePerMile: calculateInsurancePerMile(
      Number(settings.monthly_insurance_per_truck),
      Number(settings.average_monthly_miles_per_truck)
    ),
    defaultMpg: Number(settings.default_mpg),
    defaultFuelPrice: Number(settings.default_fuel_price),
    factoringRate: Number(settings.factoring_percent) / 100,
  };
}
