export const TRUCK_ROUTING_COLUMNS = [
  "routing_height_ft",
  "routing_width_ft",
  "routing_length_ft",
  "routing_gross_weight_lbs",
  "routing_axle_load_lbs",
  "routing_hazmat",
  "routing_avoid_tolls",
] as const;

export type TruckRoutingFields = {
  routing_height_ft?: number | null;
  routing_width_ft?: number | null;
  routing_length_ft?: number | null;
  routing_gross_weight_lbs?: number | null;
  routing_axle_load_lbs?: number | null;
  routing_hazmat?: boolean | null;
  routing_avoid_tolls?: boolean | null;
};

export type RouteTruckInput = {
  height_ft?: number;
  width_ft?: number;
  length_ft?: number;
  gross_weight_lbs?: number;
  axle_load_lbs?: number;
  hazmat?: boolean;
  avoid_tolls?: boolean;
};

export function toRouteTruckInput(
  truck: TruckRoutingFields | null | undefined
): RouteTruckInput | undefined {
  if (!truck) return undefined;

  const input: RouteTruckInput = {};
  setPositiveNumber(input, "height_ft", truck.routing_height_ft);
  setPositiveNumber(input, "width_ft", truck.routing_width_ft);
  setPositiveNumber(input, "length_ft", truck.routing_length_ft);
  setPositiveNumber(
    input,
    "gross_weight_lbs",
    truck.routing_gross_weight_lbs
  );
  setPositiveNumber(input, "axle_load_lbs", truck.routing_axle_load_lbs);

  if (truck.routing_hazmat) input.hazmat = true;
  if (truck.routing_avoid_tolls) input.avoid_tolls = true;

  return Object.keys(input).length ? input : undefined;
}

export function hasTruckRoutingDimensions(
  truck: TruckRoutingFields | null | undefined
) {
  return Boolean(
    toPositiveNumber(truck?.routing_height_ft) ||
      toPositiveNumber(truck?.routing_width_ft) ||
      toPositiveNumber(truck?.routing_length_ft) ||
      toPositiveNumber(truck?.routing_gross_weight_lbs) ||
      toPositiveNumber(truck?.routing_axle_load_lbs)
  );
}

export function describeTruckRoutingProfile(
  truck: TruckRoutingFields | null | undefined,
  genericLabel = "Generic truck restrictions"
) {
  if (!truck) return genericLabel;

  const parts: string[] = [];
  addMeasurement(parts, "Height", truck.routing_height_ft, "ft", 2);
  addMeasurement(parts, "Width", truck.routing_width_ft, "ft", 2);
  addMeasurement(parts, "Length", truck.routing_length_ft, "ft", 2);
  addMeasurement(
    parts,
    "GVWR",
    truck.routing_gross_weight_lbs,
    "lb",
    0
  );
  addMeasurement(parts, "Axle", truck.routing_axle_load_lbs, "lb", 0);

  if (truck.routing_hazmat) parts.push("Hazmat");
  if (truck.routing_avoid_tolls) parts.push("Prefer no tolls");

  return parts.join(" · ") || genericLabel;
}

function setPositiveNumber<K extends keyof RouteTruckInput>(
  target: RouteTruckInput,
  key: K,
  value: unknown
) {
  const number = toPositiveNumber(value);
  if (number !== null) target[key] = number as RouteTruckInput[K];
}

function toPositiveNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function addMeasurement(
  parts: string[],
  label: string,
  value: unknown,
  unit: string,
  maximumFractionDigits: number
) {
  const number = toPositiveNumber(value);
  if (number === null) return;

  parts.push(
    `${label} ${new Intl.NumberFormat("en-US", {
      maximumFractionDigits,
    }).format(number)} ${unit}`
  );
}
