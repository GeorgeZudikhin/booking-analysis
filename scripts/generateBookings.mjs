import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_FILE = resolve(__dirname, '../data/bookings.json');

// Deterministic LCG so re-runs produce the same dataset.
let seed = 42;
function rand() {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}
function randInt(min, max) {
  return Math.floor(rand() * (max - min + 1)) + min;
}
function pick(arr) {
  return arr[randInt(0, arr.length - 1)];
}

// ---------- master data ----------

const COMPANIES = ['1000', '2000'];

const GL = {
  '100000': 'Bank Account',
  '100100': 'Secondary Bank Account',
  '140000': 'Customer Receivables',
  '160000': 'Vendor Payables',
  '157600': 'Input VAT',
  '177600': 'Output VAT',
  '999000': 'Suspense / Clearing Account',
  '400000': 'Software Revenue',
  '410000': 'Consulting Revenue',
  '420000': 'Support Revenue',
  '480000': 'Customer Discounts',
  '500000': 'Cost of Goods Sold',
  '610000': 'Rent Expense',
  '620000': 'Utilities Expense',
  '630000': 'Travel Expense',
  '631000': 'Hotel Expense',
  '640000': 'Software / Cloud Subscriptions',
  '641000': 'IT Equipment',
  '650000': 'Consulting Services',
  '660000': 'General Office Expense',
  '660010': 'Office Supplies',
  '670000': 'Marketing / Ads Expense',
  '680000': 'Meals and Entertainment',
  '690000': 'Training Expense',
  '695000': 'Recruiting Expense',
};

const VENDORS = {
  'V-AWS': 'Amazon Web Services',
  'V-GOOGLE': 'Google Ads',
  'V-DELL': 'Dell Technologies',
  'V-OFFICE': 'Office Depot',
  'V-LANDLORD': 'City Properties GmbH',
  'V-TELEKOM': 'Telekom Austria',
  'V-UBER': 'Uber for Business',
  'V-HOTEL': 'Alpine Hotels',
  'V-CONSULT': 'BluePeak Consulting',
  'V-NOTION': 'Notion Labs',
  'V-GITHUB': 'GitHub',
  'V-LINKEDIN': 'LinkedIn',
  'V-TRAINING': 'DataCamp',
  'V-RECRUIT': 'TalentHub Recruiting',
};

const CUSTOMERS = {
  'C-ACME': 'Acme Corp',
  'C-GLOBEX': 'Globex GmbH',
  'C-INITECH': 'Initech AG',
  'C-UMBRELLA': 'Umbrella Systems',
  'C-SOYLEN': 'Soylent Industries',
  'C-WAYNE': 'Wayne Enterprises',
  'C-STARK': 'Stark Industries',
};

const VI_PATTERNS = [
  { text: 'AWS monthly invoice',     vendor: 'V-AWS',      gl: '640000', cc: 'CC-ENG',                  tax: 'V1', netRange: [900, 1100] },
  { text: 'GitHub subscription',     vendor: 'V-GITHUB',   gl: '640000', cc: 'CC-ENG',                  tax: 'V1', netRange: [200, 300] },
  { text: 'Notion subscription',     vendor: 'V-NOTION',   gl: '640000', cc: ['CC-ADMIN', 'CC-ENG'],    tax: 'V1', netRange: [100, 200] },
  { text: 'Google Ads campaign',     vendor: 'V-GOOGLE',   gl: '670000', cc: 'CC-MKT',                  tax: 'V1', netRange: [1500, 2800] },
  { text: 'Office supplies',         vendor: 'V-OFFICE',   gl: '660010', cc: 'CC-ADMIN',                tax: 'V1', netRange: [100, 250] },
  { text: 'Dell laptop purchase',    vendor: 'V-DELL',     gl: '641000', cc: 'CC-ENG',                  tax: 'V1', netRange: [1200, 2200] },
  { text: 'Consulting services',     vendor: 'V-CONSULT',  gl: '650000', cc: ['CC-OPS', 'CC-FIN'],      tax: 'V1', netRange: [2500, 5000] },
  { text: 'Rent monthly office',     vendor: 'V-LANDLORD', gl: '610000', cc: 'CC-ADMIN',                tax: 'V0', netRange: [7500, 8500] },
  { text: 'Telekom phone bill',      vendor: 'V-TELEKOM',  gl: '620000', cc: 'CC-ADMIN',                tax: 'V1', netRange: [200, 350] },
  { text: 'Travel reimbursement',    vendor: 'V-UBER',     gl: '630000', cc: 'CC-SALES',                tax: 'V0', netRange: [60, 150] },
  { text: 'Hotel accommodation',     vendor: 'V-HOTEL',    gl: '631000', cc: 'CC-SALES',                tax: 'V1', netRange: [300, 550] },
  { text: 'Team lunch',              vendor: 'V-UBER',     gl: '680000', cc: ['CC-SALES', 'CC-ADMIN'],  tax: 'V1', netRange: [80, 160] },
  { text: 'Training subscription',   vendor: 'V-TRAINING', gl: '690000', cc: ['CC-HR', 'CC-ENG'],       tax: 'V1', netRange: [400, 600] },
  { text: 'Recruiting fee',          vendor: 'V-RECRUIT',  gl: '695000', cc: 'CC-HR',                   tax: 'V1', netRange: [2500, 4500] },
  { text: 'LinkedIn campaign',       vendor: 'V-LINKEDIN', gl: '670000', cc: 'CC-MKT',                  tax: 'V1', netRange: [700, 1100] },
];

const CI_PATTERNS = [
  { text: 'Customer invoice software license',    customer: 'C-ACME',     gl: '400000', tax: 'A1', netRange: [4000, 8000] },
  { text: 'Customer invoice software license',    customer: 'C-UMBRELLA', gl: '400000', tax: 'A1', netRange: [6000, 9500] },
  { text: 'Customer invoice software license',    customer: 'C-STARK',    gl: '400000', tax: 'A1', netRange: [8000, 13000] },
  { text: 'Customer invoice consulting services', customer: 'C-GLOBEX',   gl: '410000', tax: 'A1', netRange: [4000, 7000] },
  { text: 'Customer invoice consulting services', customer: 'C-SOYLEN',   gl: '410000', tax: 'A1', netRange: [3000, 5500] },
  { text: 'Customer invoice support package',     customer: 'C-INITECH',  gl: '420000', tax: 'A1', netRange: [2000, 3500] },
  { text: 'Customer invoice support package',     customer: 'C-WAYNE',    gl: '420000', tax: 'A1', netRange: [2000, 3000] },
];

// ---------- helpers ----------

function dateBetween(start, end) {
  const startMs = new Date(`${start}T00:00:00Z`).getTime();
  const endMs = new Date(`${end}T00:00:00Z`).getTime();
  const days = Math.round((endMs - startMs) / 86400000);
  const offset = randInt(0, Math.max(days, 0));
  const d = new Date(startMs + offset * 86400000);
  return d.toISOString().slice(0, 10);
}

function netFromRange([lo, hi]) {
  // round to nearest 5 so 20% VAT is always whole
  const v = randInt(lo, hi);
  return Math.round(v / 5) * 5;
}

function pickCC(cc) {
  return Array.isArray(cc) ? pick(cc) : cc;
}

let docCounter = 100000;
function nextDocId() {
  docCounter += 1;
  return `DOC${docCounter}`;
}

const lines = [];

function addDoc({ docId, docType, postingDate, companyCode }, lineSpecs) {
  lineSpecs.forEach((spec, idx) => {
    const dc = spec.amount >= 0 ? 'D' : 'C';
    lines.push({
      company_code: companyCode,
      posting_date: postingDate,
      document_id: docId,
      line_id: idx + 1,
      gl_account: spec.gl,
      gl_account_name: GL[spec.gl],
      cost_center: spec.cc ?? null,
      amount: spec.amount,
      currency: 'EUR',
      debit_credit: dc,
      booking_text: spec.text,
      vendor_id: spec.vendor ?? null,
      vendor_name: spec.vendor ? VENDORS[spec.vendor] : null,
      customer_id: spec.customer ?? null,
      customer_name: spec.customer ? CUSTOMERS[spec.customer] : null,
      tax_code: spec.tax ?? null,
      document_type: docType,
      source_system: 'SAP',
    });
  });
}

function vendorInvoice({ pattern, postingDate, companyCode, overrides = {} }) {
  const text = overrides.text ?? pattern.text;
  const vendor = overrides.vendor ?? pattern.vendor;
  const gl = overrides.gl ?? pattern.gl;
  const cc = overrides.cc ?? pickCC(pattern.cc);
  const tax = 'tax' in overrides ? overrides.tax : pattern.tax;
  const net = overrides.net ?? netFromRange(pattern.netRange);

  const docId = nextDocId();
  const meta = { docId, docType: 'vendor_invoice', postingDate, companyCode };

  if (tax === 'V1') {
    const vat = +(net * 0.2).toFixed(2);
    const gross = +(net + vat).toFixed(2);
    addDoc(meta, [
      { gl, cc, amount: net, text, vendor, tax: 'V1' },
      { gl: '157600', cc: null, amount: vat, text, vendor, tax: 'V1' },
      { gl: '160000', cc: null, amount: -gross, text, vendor, tax: null },
    ]);
    return { docId, gross };
  }
  // V0 or null tax: no VAT line, 2-line doc
  addDoc(meta, [
    { gl, cc, amount: net, text, vendor, tax },
    { gl: '160000', cc: null, amount: -net, text, vendor, tax: null },
  ]);
  return { docId, gross: net };
}

function customerInvoice({ pattern, postingDate, companyCode, overrides = {} }) {
  const text = overrides.text ?? pattern.text;
  const customer = overrides.customer ?? pattern.customer;
  const gl = overrides.gl ?? pattern.gl;
  const tax = overrides.tax ?? pattern.tax;
  const net = overrides.net ?? netFromRange(pattern.netRange);
  const vat = +(net * 0.2).toFixed(2);
  const gross = +(net + vat).toFixed(2);

  const docId = nextDocId();
  addDoc({ docId, docType: 'customer_invoice', postingDate, companyCode }, [
    { gl: '140000', cc: null, amount: gross, text, customer, tax: null },
    { gl, cc: 'CC-SALES', amount: -net, text, customer, tax },
    { gl: '177600', cc: null, amount: -vat, text, customer, tax },
  ]);
  return { docId, gross, customer };
}

function vendorPayment({ vendor, gross, postingDate, companyCode }) {
  const bank = pick(['100000', '100100']);
  const docId = nextDocId();
  const text = `Payment to ${VENDORS[vendor]}`;
  addDoc({ docId, docType: 'vendor_payment', postingDate, companyCode }, [
    { gl: '160000', cc: null, amount: gross, text, vendor, tax: null },
    { gl: bank, cc: null, amount: -gross, text, vendor, tax: null },
  ]);
}

function customerPayment({ customer, gross, postingDate, companyCode }) {
  const bank = pick(['100000', '100100']);
  const docId = nextDocId();
  const text = `Payment from ${CUSTOMERS[customer]}`;
  addDoc({ docId, docType: 'customer_payment', postingDate, companyCode }, [
    { gl: bank, cc: null, amount: gross, text, customer, tax: null },
    { gl: '140000', cc: null, amount: -gross, text, customer, tax: null },
  ]);
}

const MJ_VARIANTS = [
  (date, company) => {
    const amt = randInt(1, 10) * 1000;
    addDoc({ docId: nextDocId(), docType: 'manual_journal', postingDate: date, companyCode: company }, [
      { gl: '100100', cc: null, amount: amt, text: 'Bank-to-bank transfer', tax: null },
      { gl: '100000', cc: null, amount: -amt, text: 'Bank-to-bank transfer', tax: null },
    ]);
  },
  (date, company) => {
    const amt = randInt(50, 500);
    addDoc({ docId: nextDocId(), docType: 'manual_journal', postingDate: date, companyCode: company }, [
      { gl: '660010', cc: 'CC-ADMIN', amount: amt, text: 'Reclassify to office supplies', tax: null },
      { gl: '660000', cc: 'CC-ADMIN', amount: -amt, text: 'Reclassify to office supplies', tax: null },
    ]);
  },
  (date, company) => {
    const amt = randInt(500, 3000);
    addDoc({ docId: nextDocId(), docType: 'manual_journal', postingDate: date, companyCode: company }, [
      { gl: '650000', cc: 'CC-OPS', amount: amt, text: 'Month-end consulting accrual', tax: null },
      { gl: '999000', cc: null, amount: -amt, text: 'Month-end consulting accrual', tax: null },
    ]);
  },
  (date, company) => {
    const amt = randInt(10, 80);
    addDoc({ docId: nextDocId(), docType: 'manual_journal', postingDate: date, companyCode: company }, [
      { gl: '660000', cc: 'CC-FIN', amount: amt, text: 'Bank service fee', tax: null },
      { gl: '100000', cc: null, amount: -amt, text: 'Bank service fee', tax: null },
    ]);
  },
  (date, company) => {
    const amt = randInt(100, 900);
    addDoc({ docId: nextDocId(), docType: 'manual_journal', postingDate: date, companyCode: company }, [
      { gl: '660000', cc: 'CC-ADMIN', amount: amt, text: 'Suspense account clearing', tax: null },
      { gl: '999000', cc: null, amount: -amt, text: 'Suspense account clearing', tax: null },
    ]);
  },
  (date, company) => {
    // 3-line cost-of-goods reclass
    const amt = randInt(200, 1500);
    addDoc({ docId: nextDocId(), docType: 'manual_journal', postingDate: date, companyCode: company }, [
      { gl: '500000', cc: 'CC-OPS', amount: amt, text: 'COGS reclassification', tax: null },
      { gl: '660000', cc: 'CC-OPS', amount: Math.floor(amt / 2), text: 'COGS reclassification', tax: null },
      { gl: '999000', cc: null, amount: -(amt + Math.floor(amt / 2)), text: 'COGS reclassification', tax: null },
    ]);
  },
];

function manualJournal(date, company) {
  pick(MJ_VARIANTS)(date, company);
}

// ---------- generation ----------

const START = '2026-04-01';
const END = '2026-05-31';

const openInvoices = [];
const openCustomerInvoices = [];

// Give every recurring vendor-invoice pattern a baseline of 5 docs so the
// "common text" heuristic (count >= 5) can reliably anchor typo detection,
// then add a few random extras for variation.
const MIN_PER_PATTERN = 5;
const EXTRA_RANDOM_VI = 10;

function emitVendorInvoice(pattern) {
  const date = dateBetween(START, END);
  const company = rand() < 0.75 ? '1000' : '2000';
  const r = vendorInvoice({ pattern, postingDate: date, companyCode: company });
  openInvoices.push({ vendor: pattern.vendor, gross: r.gross, postingDate: date, company });
}

for (const pattern of VI_PATTERNS) {
  for (let i = 0; i < MIN_PER_PATTERN; i += 1) emitVendorInvoice(pattern);
}
for (let i = 0; i < EXTRA_RANDOM_VI; i += 1) emitVendorInvoice(pick(VI_PATTERNS));

for (let i = 0; i < 30; i += 1) {
  const pattern = pick(CI_PATTERNS);
  const date = dateBetween(START, END);
  const company = rand() < 0.7 ? '1000' : '2000';
  const r = customerInvoice({ pattern, postingDate: date, companyCode: company });
  openCustomerInvoices.push({ customer: r.customer, gross: r.gross, postingDate: date, company });
}

for (let i = 0; i < 35 && openInvoices.length > 0; i += 1) {
  const idx = randInt(0, openInvoices.length - 1);
  const inv = openInvoices.splice(idx, 1)[0];
  const payDate = dateBetween(inv.postingDate, END);
  vendorPayment({ vendor: inv.vendor, gross: inv.gross, postingDate: payDate, companyCode: inv.company });
}

for (let i = 0; i < 20 && openCustomerInvoices.length > 0; i += 1) {
  const idx = randInt(0, openCustomerInvoices.length - 1);
  const inv = openCustomerInvoices.splice(idx, 1)[0];
  const payDate = dateBetween(inv.postingDate, END);
  customerPayment({ customer: inv.customer, gross: inv.gross, postingDate: payDate, companyCode: inv.company });
}

for (let i = 0; i < 10; i += 1) {
  manualJournal(dateBetween(START, END), pick(COMPANIES));
}

// ---------- seeded suspicious cases ----------

const officeP   = VI_PATTERNS.find(p => p.text === 'Office supplies');
const awsP      = VI_PATTERNS.find(p => p.text === 'AWS monthly invoice');
const consultP  = VI_PATTERNS.find(p => p.text === 'Consulting services');
const googleP   = VI_PATTERNS.find(p => p.text === 'Google Ads campaign');
const trainingP = VI_PATTERNS.find(p => p.text === 'Training subscription');
const dellP     = VI_PATTERNS.find(p => p.text === 'Dell laptop purchase');
const acmeP     = CI_PATTERNS.find(p => p.customer === 'C-ACME');

// 1. Office suplies typo
vendorInvoice({ pattern: officeP, postingDate: '2026-04-14', companyCode: '1000',
  overrides: { text: 'Office suplies', net: 180 } });

// 2. AWS montly invoice typo
vendorInvoice({ pattern: awsP, postingDate: '2026-04-18', companyCode: '1000',
  overrides: { text: 'AWS montly invoice', net: 1000 } });

// 3. Consultng services typo
vendorInvoice({ pattern: consultP, postingDate: '2026-05-18', companyCode: '1000',
  overrides: { text: 'Consultng services', net: 2400, cc: 'CC-OPS' } });

// 4. AWS monthly invoice posted to 680000 Meals (wrong account)
vendorInvoice({ pattern: awsP, postingDate: '2026-04-25', companyCode: '1000',
  overrides: { gl: '680000', cc: 'CC-ENG', net: 900 } });

// 5. Google Ads on CC-ENG (wrong cost center)
vendorInvoice({ pattern: googleP, postingDate: '2026-05-16', companyCode: '1000',
  overrides: { cc: 'CC-ENG', net: 1500 } });

// 6. Office supplies main expense line null tax_code (3-line doc, expense tax missing while VAT line present)
{
  const net = 220, vat = 44, gross = 264;
  addDoc({ docId: nextDocId(), docType: 'vendor_invoice', postingDate: '2026-05-14', companyCode: '1000' }, [
    { gl: '660010', cc: 'CC-ADMIN', amount: net,    text: 'Office supplies', vendor: 'V-OFFICE', tax: null },
    { gl: '157600', cc: null,       amount: vat,    text: 'Office supplies', vendor: 'V-OFFICE', tax: 'V1' },
    { gl: '160000', cc: null,       amount: -gross, text: 'Office supplies', vendor: 'V-OFFICE', tax: null },
  ]);
}

// 7. Training subscription posted to 999000 Suspense
vendorInvoice({ pattern: trainingP, postingDate: '2026-05-15', companyCode: '1000',
  overrides: { gl: '999000', cc: 'CC-HR', net: 600 } });

// 8. Two AWS duplicates, gross 1200, within 3 days
vendorInvoice({ pattern: awsP, postingDate: '2026-05-09', companyCode: '1000', overrides: { net: 1000 } });
vendorInvoice({ pattern: awsP, postingDate: '2026-05-11', companyCode: '1000', overrides: { net: 1000 } });

// 9. Two Dell duplicates, gross 2400, similar typo text, within 5 days
vendorInvoice({ pattern: dellP, postingDate: '2026-05-04', companyCode: '1000', overrides: { net: 2000 } });
vendorInvoice({ pattern: dellP, postingDate: '2026-05-07', companyCode: '1000',
  overrides: { text: 'Dell laptop purchse', net: 2000 } });

// 10. Two ACME customer invoice duplicates, gross 6000, within 4 days
customerInvoice({ pattern: acmeP, postingDate: '2026-04-23', companyCode: '1000', overrides: { net: 5000 } });
customerInvoice({ pattern: acmeP, postingDate: '2026-04-26', companyCode: '1000', overrides: { net: 5000 } });

// ---------- validation ----------

function groupBy(arr, fn) {
  const m = new Map();
  for (const x of arr) {
    const k = fn(x);
    if (!m.has(k)) m.set(k, []);
    m.get(k).push(x);
  }
  return m;
}

const errors = [];
const byDoc = groupBy(lines, l => l.document_id);

for (const [docId, docLines] of byDoc) {
  if (docLines.length < 2) errors.push(`${docId}: only ${docLines.length} line(s)`);
  const sum = docLines.reduce((a, l) => a + l.amount, 0);
  if (Math.abs(sum) > 0.005) errors.push(`${docId}: not balanced (sum=${sum})`);
}

for (const l of lines) {
  const expected = l.amount >= 0 ? 'D' : 'C';
  if (l.debit_credit !== expected) {
    errors.push(`${l.document_id}#${l.line_id}: debit_credit ${l.debit_credit} mismatches sign of ${l.amount}`);
  }
}

if (lines.length < 480 || lines.length > 520) {
  errors.push(`line count ${lines.length} outside [480, 520]`);
}

const distinctGL = new Set(lines.map(l => l.gl_account));
if (distinctGL.size < 20) {
  errors.push(`only ${distinctGL.size} distinct GL accounts (need >= 20)`);
}

if (errors.length > 0) {
  console.error('VALIDATION FAILED:');
  for (const e of errors) console.error('  -', e);
  process.exit(1);
}

mkdirSync(dirname(OUT_FILE), { recursive: true });
writeFileSync(OUT_FILE, JSON.stringify(lines, null, 2));

const docTypes = groupBy(lines, l => l.document_type);
console.log('Generated bookings:');
console.log(`  documents:       ${byDoc.size}`);
console.log(`  line items:      ${lines.length}`);
console.log(`  distinct GLs:    ${distinctGL.size}`);
for (const [t, ls] of docTypes) {
  console.log(`  ${t.padEnd(18)} lines=${ls.length}`);
}
console.log(`Wrote ${OUT_FILE}`);
