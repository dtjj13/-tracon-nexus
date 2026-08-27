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

  const expiration = new Date(`${expirationDate}T23:59:59`);
  const today = new Date();
  const warningDate = new Date();

  warningDate.setDate(today.getDate() + warningDays);

  if (expiration.getTime() < today.getTime()) {
    return "expired";
  }

  if (expiration.getTime() <= warningDate.getTime()) {
    return "expiring";
  }

  return "current";
}