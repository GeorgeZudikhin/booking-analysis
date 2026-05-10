export type BookingLine = {
  company_code: string;
  posting_date: string;
  document_id: string;
  line_id: number;

  gl_account: string;
  gl_account_name: string;

  cost_center: string | null;

  amount: number;
  currency: string;
  debit_credit: "D" | "C";

  booking_text: string;

  vendor_id: string | null;
  vendor_name: string | null;

  customer_id: string | null;
  customer_name: string | null;

  tax_code: string | null;

  document_type:
    | "vendor_invoice"
    | "customer_invoice"
    | "vendor_payment"
    | "customer_payment"
    | "manual_journal";

  source_system: "SAP";
};

export type AnomalyFinding = {
  id: string;
  type:
    | "possible_typo"
    | "unusual_account_for_text";

  severity: "low" | "medium" | "high";
  confidence: number;

  title: string;
  explanation: string;

  evidence: BookingLine[];
  anomalousLineKeys: string[];

  // Short note shown beneath the evidence table when only a sample of the
  // available normal documents is rendered.
  contextSummary?: string;
};
