// Bank, AR, AP, VAT — these always appear regardless of business intent,
// so we exclude them when deciding which expense/revenue account is "normal".
export const TECHNICAL_ACCOUNTS = new Set([
  "100000",
  "100100",
  "140000",
  "160000",
  "157600",
  "177600",
]);