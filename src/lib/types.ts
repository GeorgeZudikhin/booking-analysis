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

export type DocumentSummary = {
  document_id: string;
  posting_date: string;
  company_code: string;
  currency: string;
  document_type: BookingLine["document_type"];
  lines: BookingLine[];

  party_id: string | null;
  party_name: string | null;
  party_type: "vendor" | "customer" | null;

  representative_text: string;
  debit_total: number;
  meaningful_gl_accounts: string[];
};

export type DuplicateCandidate = {
  id: string;
  documentA: DocumentSummary;
  documentB: DocumentSummary;
  confidence: number;
  severity: "medium" | "high";
  criteria: string[];
};

export type BookingManualRule = {
  id: string;
  type:
    | "text_to_account"
    | "text_to_cost_center"
    | "vendor_to_account"
    | "account_to_tax_code";

  title: string;
  description: string;
  suggested_check: string;

  confidence: number;
  support_count: number;
  total_count: number;
  // total_count - support_count: lines that match the rule's input but
  // diverge from the dominant output. These are the actionable cases.
  violations_count: number;

  evidence: BookingLine[];
};
