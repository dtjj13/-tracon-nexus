export type ComplianceEntityType = "driver" | "truck";

export type ComplianceDocument = {
  id: string;
  entity_type: ComplianceEntityType;
  entity_id: string;
  entity_name: string;
  document_type: string;
  document_number: string | null;
  issue_date: string | null;
  expiration_date: string | null;
  file_name: string | null;
  file_path: string | null;
  file_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type ComplianceStatus =
  | "missing"
  | "expired"
  | "expiring"
  | "current";

export function getComplianceStatus(
  expirationDate: string | null,
  warningDays = 30
): ComplianceStatus {
  if (!expirationDate) return "missing";

  const expiration = startOfLocalDay(expirationDate);
  const today = startOfLocalDay(new Date());
  const warningDate = new Date(today);

  warningDate.setDate(today.getDate() + warningDays);

  if (expiration.getTime() < today.getTime()) {
    return "expired";
  }

  if (expiration.getTime() <= warningDate.getTime()) {
    return "expiring";
  }

  return "current";
}

export function getDaysUntilExpiration(expirationDate: string | null) {
  if (!expirationDate) return null;

  const expiration = startOfLocalDay(expirationDate);
  const today = startOfLocalDay(new Date());

  return Math.round(
    (expiration.getTime() - today.getTime()) / (24 * 60 * 60 * 1000)
  );
}

export function formatComplianceDate(value: string | null) {
  if (!value) return "No expiration date";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(startOfLocalDay(value));
}

function startOfLocalDay(value: string | Date) {
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}
