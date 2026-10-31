export type ProductCode = 'COTTON_YARN';

export interface Product {
  id: string;
  code: ProductCode;
  name: string;
  description: string;
  active: boolean;
}

export interface YarnCountMaster {
  id: string;
  product_code: ProductCode;
  count_name: string;
  yarn_type: 'Carded' | 'Combed' | 'Compact' | 'Open End';
  purpose: 'Weaving' | 'Hosiery' | 'Knitting' | 'Towel';
  standard_bag_weight_kg: number;
  rodtep_rate_pct: number;
  drawback_rate_pct: number;
}

export interface ContainerConfigMaster {
  id: string;
  product_code: ProductCode;
  container_type: '20FT_FCL' | '40FT_HC';
  display_name: string;
  max_capacity_kg: number;
  bags_count: number;
}

export interface PortLogisticsMaster {
  id: string;
  port_name: string;
  thc_charge_inr: number;
  cha_clearance_inr: number;
  doc_bl_fee_inr: number;
  inspection_fee_inr: number;
  inland_freight_inr: number;
  other_fob_charges_inr: number;
}

export interface FinancialParamsMaster {
  id: string;
  product_code: ProductCode;
  packing_credit_interest_pct_pa: number;
  ecgc_premium_pct: number;
  bank_lc_discounting_pct: number;
  trader_margin_pct: number;
  agent_commission_pct: number;
  insurance_rate_pct: number;
}

export interface FxRateMaster {
  currency_pair: 'USD_INR' | 'EUR_INR';
  rate: number;
  fx_buffer_margin: number;
  effective_rate: number;
  last_updated_at: string;
  rate_date?: string;
  is_fallback?: boolean;
  days_stale?: number;
}

export interface FxProvenance {
  usd_inr: number;
  eur_inr: number | null;
  rate_date: string;
  is_fallback: boolean;
  padded_usd_inr: number;
  eur_unavailable?: boolean;
}

export type CommissionType = 'PCT' | 'USD_PER_KG';

export interface CostingInput {
  product_code: ProductCode;
  yarn_count_id: string;
  yarn_count_name: string;
  ex_mill_price_inr_per_kg: number;
  mill_freight_inr_per_kg: number;
  packaging_cost_inr_per_kg: number;
  container_type: '20FT_FCL' | '40FT_HC';
  container_capacity_kg: number;
  port_id: string;
  port_name: string;
  total_port_fob_expenses_inr: number;
  ocean_freight_usd: number;
  credit_days: number;
  packing_credit_interest_pct_pa: number;
  ecgc_premium_pct: number;
  agent_commission_pct: number;
  commission_type?: CommissionType;
  commission_value?: number;
  trader_margin_pct: number;
  rodtep_rebate_pct: number;
  duty_drawback_pct: number;
  marine_insurance_pct: number;
  base_fx_rate: number;
  fx_margin_buffer_inr: number;
  currency_code: 'USD' | 'EUR';
  customer_name?: string;
  destination_country?: string;
}

export interface CostingCalculationResult {
  // Input Echoes
  currency_code: string;
  container_capacity_kg: number;
  
  // FX Outputs
  effective_fx_rate: number;
  
  // Per KG INR Figures
  ex_mill_price_inr_per_kg: number;
  mill_freight_inr_per_kg: number;
  packaging_cost_inr_per_kg: number;
  yarn_base_cost_inr_per_kg: number;
  port_expense_inr_per_kg: number;
  interest_cost_inr_per_kg: number;
  gross_landed_cost_inr_per_kg: number;
  
  // Incentives & Allowances
  total_incentive_pct: number;
  incentive_amount_inr_per_kg: number;
  
  // Costing & Charges
  fob_cost_inr_per_kg: number;
  agent_commission_inr_per_kg: number;
  ecgc_amount_inr_per_kg: number;
  trader_margin_inr_per_kg: number;
  selling_fob_price_inr_per_kg: number;
  ocean_freight_inr_per_kg: number;
  cfr_price_inr_per_kg: number;
  insurance_inr_per_kg: number;
  cif_price_inr_per_kg: number;

  // Per KG Currency (USD / EUR) Figures
  fob_cost_usd_per_kg: number;
  agent_commission_usd_per_kg: number;
  ecgc_amount_usd_per_kg: number;
  trader_margin_usd_per_kg: number;
  selling_fob_price_usd_per_kg: number;
  ocean_freight_usd_per_kg: number;
  cfr_price_usd_per_kg: number;
  insurance_usd_per_kg: number;
  cif_price_usd_per_kg: number;

  // Total Container Shipment Figures
  total_shipment_weight_kg: number;
  total_ex_mill_cost_inr: number;
  total_shipment_cost_inr: number;
  total_fob_revenue_usd: number;
  total_cif_revenue_usd: number;
  total_net_profit_inr: number;
  total_net_profit_usd: number;
  profit_margin_pct: number;

  // Break-even Analysis
  breakeven_ex_mill_inr_per_kg: number;
  breakeven_cif_usd_per_kg: number;

  // Section 5 Specific Translated Spreadsheet Calculations
  selected_freight_usd?: number;
  ddb_rodtep?: number;
  net_ex_mill?: number;
  fob_cost_per_kg?: number;
  padded_rate?: number;
  freight_per_kg?: number;
  total_cost?: number;
  usd_price?: number;
  eur_price?: number | null;
  eur_unavailable?: boolean;

  // Commission Details
  commission_type?: CommissionType;
  commission_value?: number;
  commission_inr?: number;
  commission_usd?: number;
  effective_commission_pct?: number;

  // Step 9 Target / Reverse Costing
  target_calc?: {
    target_usd: number;
    target_inr: number;
    allowed_ex_mill: number;
    with_buffer: number;
    after_interest: number;
    final_target: number;
  };

  // Sensitivity Matrices (Calculated inside RPC)
  fx_sensitivity: Array<{
    rate_shift: number;
    fx_rate: number;
    cif_price_usd: number;
    net_profit_usd: number;
  }>;

  // FX Provenance
  fx?: FxProvenance;
}

export interface SavedQuote {
  id: string;
  quote_number: string;
  customer_name: string;
  destination_country: string;
  yarn_count_name: string;
  container_type: string;
  cif_price_usd_per_kg: number;
  total_net_profit_usd: number;
  created_at: string;
  inputs: CostingInput;
  results: CostingCalculationResult;
}

export interface YarnProductSheetRecord {
  yarnCount: string;
  quality: string;
  category?: string;
  exMillPrice: number | null;
  factoryLocation: string;
  rawRow?: number;
}

export interface GoogleSheetFetchResult {
  records: YarnProductSheetRecord[];
  uniqueCounts: string[];
  fetchedAt: string;
  sourceUrl: string;
  error?: string | null;
  isFallback?: boolean;
  dailyPricingStatus?: DailyPricingStatus;
  duplicates?: Array<{
    yarnCount: string;
    quality: string;
    count: number;
    prices: number[];
    locations: string[];
  }>;
}

export interface FobSheetRecord {
  location: string;
  price: number | null;
  rawRow?: number;
}

export interface FobSheetFetchResult {
  records: FobSheetRecord[];
  locations: string[];
  fetchedAt: string;
  sourceUrl: string;
  error?: string | null;
  isFallback?: boolean;
  dailyPricingStatus?: DailyPricingStatus;
}

export interface FobLookupResult {
  record: FobSheetRecord | null;
  status: 'FOUND' | 'NOT_FOUND' | 'MISSING_PRICE' | 'NO_LOCATION';
  matchedLocation: string | null;
  fobAmount: number | null;
  message: string | null;
}

export interface FreightSheetRecord {
  destination: string;
  amount: number | null;
  rawRow?: number;
}

export interface FreightSheetFetchResult {
  records: FreightSheetRecord[];
  destinations: string[];
  fetchedAt: string;
  sourceUrl: string;
  error?: string | null;
  isFallback?: boolean;
  dailyPricingStatus?: DailyPricingStatus;
}

export interface FreightLookupResult {
  record: FreightSheetRecord | null;
  status: 'FOUND' | 'NOT_FOUND' | 'MISSING_PRICE' | 'NO_DESTINATION';
  matchedDestination: string | null;
  baseAmountUsd: number | null;
  surcharge: number;
  selectedFreightUsd: number | null;
  message: string | null;
}

export interface ZohoAccountItem {
  id: string;
  name: string;
  type: 'Account' | 'Agent' | 'Vendor';
  owner_name?: string;
  owner_email?: string;
  owner_id?: string;
  contact_name?: string;
  contact_id?: string;
  contact_email?: string;
  contact_phone?: string;
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'employee';
  title: string;
  passwordHint?: string;
  passwords?: string[];
  avatarColor: string;
}

export interface SpreadsheetColumn {
  id: string;
  name: string;
  type?: 'text' | 'number' | 'currency';
  width?: number;
}

export interface SpreadsheetRow {
  id: string;
  [key: string]: any;
}

export interface SpreadsheetSheetData {
  id: 'yarn' | 'fob' | 'freight';
  name: string;
  description: string;
  columns: SpreadsheetColumn[];
  rows: SpreadsheetRow[];
}

export interface DailyPricingStatus {
  isConfirmedForToday: boolean;
  todayDate: string;           // "YYYY-MM-DD"
  lastConfirmedDate: string | null;
  lastConfirmedAt: string | null;
  lastConfirmedBy: string | null;
  confirmationType: 'kept_previous' | 'updated_prices' | null;
  isEditingInSheet?: boolean;  // Admin clicked "Edit" and is changing prices in Google Sheet (still locked)
  editingStartedAt?: string | null;
  editingBy?: string | null;
  totalYarnProducts: number;
  totalFobLocations: number;
  totalFreightDestinations: number;
}

export interface DailyPricingStoreData {
  status: DailyPricingStatus;
  sheets: {
    yarn: SpreadsheetSheetData;
    fob: SpreadsheetSheetData;
    freight: SpreadsheetSheetData;
  };
}

export type LeadStatus =
  | 'new_lead'
  | 'mail_1_sent'
  | 'mail_2_sent'
  | 'mail_3_sent'
  | 'info_received'
  | 'call_pending_1'
  | 'call_pending_2'
  | 'call_connected'
  | 'not_reachable'
  | 'quote_sent'
  | 'converted';

export interface CallAttempt {
  id: string;
  attemptNumber: 1 | 2;
  attemptedAt: string;
  callerName: string;
  outcome: 'no_answer' | 'switched_off' | 'busy' | 'wrong_number' | 'connected' | 'call_back_requested';
  notes: string;
}

export interface EmailLog {
  id: string;
  step: 1 | 2 | 3;
  subject: string;
  body: string;
  sentAt: string;
  sender: string;
  recipient: string;
  status: 'sent' | 'replied' | 'delivered';
  repliedAt?: string;
  replyText?: string;
  extractedFields?: Partial<CrmFields>;
}

export interface CrmFields {
  contactPersonResponsible: string;
  directEmailId: string;
  phoneWhatsApp: string;
  yarnCountsFabricItems: string;
  approximateQuantityPerMonth: string;
  destinationPortCnf: string;
  sourcingReferralContact?: string;
  notes?: string;
}

export interface LeadHistoryItem {
  id: string;
  timestamp: string;
  action: string;
  details: string;
  actor: string;
}

export interface Lead {
  id: string;
  companyName: string;
  leadName: string;
  initialEmail: string;
  initialPhone?: string;
  country: string;
  status: LeadStatus;
  currentStep: number;
  createdAt: string;
  lastActivityAt: string;
  nextActionDueAt: string | null;
  crmFields: CrmFields;
  emailLogs: EmailLog[];
  callAttempts: CallAttempt[];
  history: LeadHistoryItem[];
  assignedTo: string;
  isDripActive: boolean;
}

export interface CampaignTemplate {
  step: 1 | 2 | 3;
  name: string;
  subject: string;
  bodyTemplate: string;
  delayDays: number;
  triggerCondition: string;
}

export interface DripSimulationState {
  virtualDaysForward: number;
  autoProcessEnabled: boolean;
}


