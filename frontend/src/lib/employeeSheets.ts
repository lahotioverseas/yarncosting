import { DEFAULT_MASTER_SHEET_ID, convertGoogleSheetUrlToCsvUrl, GOOGLE_SHEET_URL, GOOGLE_FOB_SHEET_URL, GOOGLE_FREIGHT_SHEET_URL } from './googleSheetService';
import { DEFAULT_PRICING_SNAPSHOT } from './dailyPricingSnapshot';

export interface EmployeeSheetConfig {
  empId: string; // e.g. 'emp1', 'emp2'
  employeeName: string;
  email: string;
  title: string;
  sheetTitle: string;
  viewUrl: string;
  csvUrl: string;
  fobUrl?: string;
  freightUrl?: string;
  templateCopyUrl: string;
  customFormula: string;
  lastSyncedAt?: string | null;
  status: 'active' | 'custom' | 'unassigned';
}

const STORAGE_KEY = 'lahoti_employee_sheets_v1';

export const DEFAULT_EMPLOYEE_SHEETS: EmployeeSheetConfig[] = [
  {
    empId: 'emp1',
    employeeName: 'Javier Moreano (emp1)',
    email: 'javier@lahotioverseas.com',
    title: 'International Trade Specialist',
    sheetTitle: 'Lahoti Overseas - Employee 1 Pricing & Costing Sheet (emp1)',
    viewUrl: GOOGLE_SHEET_URL,
    csvUrl: convertGoogleSheetUrlToCsvUrl(GOOGLE_SHEET_URL, '177573931').csvUrl,
    fobUrl: GOOGLE_FOB_SHEET_URL,
    freightUrl: GOOGLE_FREIGHT_SHEET_URL,
    templateCopyUrl: `https://docs.google.com/spreadsheets/d/${DEFAULT_MASTER_SHEET_ID}/copy?title=${encodeURIComponent('Lahoti Overseas - Employee 1 Pricing Sheet (emp1)')}`,
    customFormula: '',
    lastSyncedAt: null,
    status: 'active',
  },
  {
    empId: 'emp2',
    employeeName: 'Mehadi Hasan (emp2)',
    email: 'mehadi@lahotioverseas.com',
    title: 'Regional Sales & Operations',
    sheetTitle: 'Lahoti Overseas - Employee 2 Pricing & Costing Sheet (emp2)',
    viewUrl: GOOGLE_SHEET_URL,
    csvUrl: convertGoogleSheetUrlToCsvUrl(GOOGLE_SHEET_URL, '177573931').csvUrl,
    fobUrl: GOOGLE_FOB_SHEET_URL,
    freightUrl: GOOGLE_FREIGHT_SHEET_URL,
    templateCopyUrl: `https://docs.google.com/spreadsheets/d/${DEFAULT_MASTER_SHEET_ID}/copy?title=${encodeURIComponent('Lahoti Overseas - Employee 2 Pricing Sheet (emp2)')}`,
    customFormula: '',
    lastSyncedAt: null,
    status: 'active',
  },
  {
    empId: 'emp3',
    employeeName: 'Rashmi Shishivkar (emp3)',
    email: 'rashmi@lahotioverseas.com',
    title: 'Export Logistics & Costing',
    sheetTitle: 'Lahoti Overseas - Employee 3 Logistics & Rates (emp3)',
    viewUrl: GOOGLE_SHEET_URL,
    csvUrl: convertGoogleSheetUrlToCsvUrl(GOOGLE_SHEET_URL, '177573931').csvUrl,
    fobUrl: GOOGLE_FOB_SHEET_URL,
    freightUrl: GOOGLE_FREIGHT_SHEET_URL,
    templateCopyUrl: `https://docs.google.com/spreadsheets/d/${DEFAULT_MASTER_SHEET_ID}/copy?title=${encodeURIComponent('Lahoti Overseas - Employee 3 Pricing Sheet (emp3)')}`,
    customFormula: '',
    lastSyncedAt: null,
    status: 'active',
  },
  {
    empId: 'emp4',
    employeeName: 'Tusshar Manekarr (emp4)',
    email: 'tusshar@lahotioverseas.com',
    title: 'Yarn Trading Manager',
    sheetTitle: 'Lahoti Overseas - Employee 4 Trading Sheet (emp4)',
    viewUrl: GOOGLE_SHEET_URL,
    csvUrl: convertGoogleSheetUrlToCsvUrl(GOOGLE_SHEET_URL, '177573931').csvUrl,
    fobUrl: GOOGLE_FOB_SHEET_URL,
    freightUrl: GOOGLE_FREIGHT_SHEET_URL,
    templateCopyUrl: `https://docs.google.com/spreadsheets/d/${DEFAULT_MASTER_SHEET_ID}/copy?title=${encodeURIComponent('Lahoti Overseas - Employee 4 Pricing Sheet (emp4)')}`,
    customFormula: '',
    lastSyncedAt: null,
    status: 'active',
  },
  {
    empId: 'emp5',
    employeeName: 'Avinash (emp5)',
    email: 'avinash@lahotioverseas.com',
    title: 'Trade Operations Specialist',
    sheetTitle: 'Lahoti Overseas - Employee 5 Operations Sheet (emp5)',
    viewUrl: GOOGLE_SHEET_URL,
    csvUrl: convertGoogleSheetUrlToCsvUrl(GOOGLE_SHEET_URL, '177573931').csvUrl,
    fobUrl: GOOGLE_FOB_SHEET_URL,
    freightUrl: GOOGLE_FREIGHT_SHEET_URL,
    templateCopyUrl: `https://docs.google.com/spreadsheets/d/${DEFAULT_MASTER_SHEET_ID}/copy?title=${encodeURIComponent('Lahoti Overseas - Employee 5 Pricing Sheet (emp5)')}`,
    customFormula: '',
    lastSyncedAt: null,
    status: 'active',
  },
  {
    empId: 'emp6',
    employeeName: 'Mahnaz Kausar (emp6)',
    email: 'mahnaz@lahotioverseas.com',
    title: 'Client Relations & Documentation',
    sheetTitle: 'Lahoti Overseas - Employee 6 Client Sheet (emp6)',
    viewUrl: GOOGLE_SHEET_URL,
    csvUrl: convertGoogleSheetUrlToCsvUrl(GOOGLE_SHEET_URL, '177573931').csvUrl,
    fobUrl: GOOGLE_FOB_SHEET_URL,
    freightUrl: GOOGLE_FREIGHT_SHEET_URL,
    templateCopyUrl: `https://docs.google.com/spreadsheets/d/${DEFAULT_MASTER_SHEET_ID}/copy?title=${encodeURIComponent('Lahoti Overseas - Employee 6 Pricing Sheet (emp6)')}`,
    customFormula: '',
    lastSyncedAt: null,
    status: 'active',
  },
];

export function getEmployeeFormula(empId: string, origin?: string): string {
  const base = origin || (typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com');
  return `=HYPERLINK("${base}/api/daily-pricing/confirm-from-sheet?employee=${empId}", "🟢 CONFIRM & UNLOCK PRICES (${empId.toUpperCase()})")`;
}

export function getSavedEmployeeSheets(): EmployeeSheetConfig[] {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw) {
      const parsed: EmployeeSheetConfig[] = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Merge with defaults to ensure all fields and formula are up to date
        return DEFAULT_EMPLOYEE_SHEETS.map((def) => {
          const match = parsed.find((p) => p.empId === def.empId);
          if (match) {
            return {
              ...def,
              ...match,
              customFormula: getEmployeeFormula(def.empId),
            };
          }
          return {
            ...def,
            customFormula: getEmployeeFormula(def.empId),
          };
        });
      }
    }
  } catch {}

  return DEFAULT_EMPLOYEE_SHEETS.map((def) => ({
    ...def,
    customFormula: getEmployeeFormula(def.empId),
  }));
}

export function saveEmployeeSheet(empId: string, patch: Partial<EmployeeSheetConfig>): EmployeeSheetConfig[] {
  const current = getSavedEmployeeSheets();
  const updated = current.map((emp) => {
    if (emp.empId === empId) {
      const viewUrl = patch.viewUrl || emp.viewUrl;
      const csv = convertGoogleSheetUrlToCsvUrl(viewUrl);
      return {
        ...emp,
        ...patch,
        viewUrl,
        csvUrl: csv.csvUrl,
        status: viewUrl !== GOOGLE_SHEET_URL ? ('custom' as const) : ('active' as const),
      };
    }
    return emp;
  });

  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    }
  } catch {}

  // Sync to server asynchronously
  fetch('/api/employee-sheets/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ empId, patch }),
  }).catch(() => {});

  return updated;
}

/**
 * Generate a complete, ready-to-import CSV string for any employee
 * containing the Return & Unlock Formula in row 1, followed by yarn products.
 */
export function generateEmployeeSheetCsv(empId: string, origin?: string): string {
  const formula = getEmployeeFormula(empId, origin);
  const yarnRows = DEFAULT_PRICING_SNAPSHOT.sheets?.yarn?.rows || [];

  const lines: string[] = [
    `"RETURN_ACTION","${formula.replace(/"/g, '""')}","Click this button inside Google Sheets to return to dashboard & confirm prices for all employees"`,
    `"EMPLOYEE_ID","${empId.toUpperCase()}","Assigned Employee Pricing Sheet"`,
    `""`,
    `"Yarn Count","Quality","Category","Ex-Mill Price (INR)","Factory Location"`,
  ];

  for (const yr of yarnRows) {
    const count = String(yr.yarnCount || '').replace(/"/g, '""');
    const quality = String(yr.quality || '').replace(/"/g, '""');
    const category = String(yr.category || '').replace(/"/g, '""');
    const price = yr.exMillPrice !== null && yr.exMillPrice !== undefined ? yr.exMillPrice : '';
    const loc = String(yr.factoryLocation || '').replace(/"/g, '""');
    lines.push(`"${count}","${quality}","${category}","${price}","${loc}"`);
  }

  return lines.join('\n');
}

/**
 * Trigger browser file download of pre-populated employee CSV
 */
export function downloadEmployeeSheetCsv(empId: string): void {
  const csvContent = generateEmployeeSheetCsv(empId);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Lahoti_Overseas_${empId.toUpperCase()}_Pricing_Sheet.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
