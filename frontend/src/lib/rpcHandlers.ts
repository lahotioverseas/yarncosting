// RPC Handlers for Cotton Yarn Costing Calculator
// Implements full PL/pgSQL specification logic in JavaScript/TypeScript

export interface SavedCostingRecord {
  reference_no: string;
  created_at: string;
  inputs: any;
  outputs: any;
  usd_inr_used: number;
  eur_inr_used: number | null;
}

import { DEFAULT_PRICING_SNAPSHOT } from './dailyPricingSnapshot';

const savedRecordsStore: SavedCostingRecord[] = [];

// Seed Freight Rates (Exact data from Ocean Freight Master)
const freightRates: Array<{ origin: string; destination: string; amount: number | null }> = [
  // Gujarat
  { origin: 'Gujarat', destination: 'Cat Lai', amount: 300 },
  { origin: 'Gujarat', destination: 'Callao', amount: 2900 },
  { origin: 'Gujarat', destination: 'EL DEKHILA /Ale', amount: 2750 },
  { origin: 'Gujarat', destination: 'Istanbul', amount: 2875 },
  { origin: 'Gujarat', destination: 'Lexious', amount: 3075 },
  { origin: 'Gujarat', destination: 'Hamburg', amount: 2675 },
  { origin: 'Gujarat', destination: 'Chittagong', amount: 950 },
  { origin: 'Gujarat', destination: 'Itajai', amount: null },
  { origin: 'Gujarat', destination: 'Qingdao/SH', amount: 200 },
  { origin: 'Gujarat', destination: 'Psair Gudang', amount: 300 },
  { origin: 'Gujarat', destination: 'Buenaventura', amount: 2750 },
  { origin: 'Gujarat', destination: 'Port Louis', amount: 2100 },
  { origin: 'Gujarat', destination: 'Gdynia', amount: 2050 },
  { origin: 'Gujarat', destination: 'LA, USA', amount: null },
  { origin: 'Gujarat', destination: 'Colombo', amount: 600 },
  { origin: 'Gujarat', destination: 'Wuhu', amount: 300 },
  { origin: 'Gujarat', destination: 'Al Sokhna', amount: 3600 },
  { origin: 'Gujarat', destination: 'Casablanca', amount: 2950 },
  { origin: 'Gujarat', destination: 'Lazaro Cardenas', amount: 3200 },
  { origin: 'Gujarat', destination: 'Tunis', amount: 2950 },
  { origin: 'Gujarat', destination: 'Santos', amount: null },
  { origin: 'Gujarat', destination: 'Puerto quetzal', amount: null },

  // Maharashtra
  { origin: 'Maharashtra', destination: 'Port Louis', amount: 2100 },
  { origin: 'Maharashtra', destination: 'Casablanca', amount: 2900 },

  // Chennai
  { origin: 'Chennai', destination: 'Puerto quetzal', amount: 4065 },
];

// Seed FOB Rates (Exact data from FOB Costing Master)
const fobRates = [
  { id: 1, location: 'FOB Costing', variant_label: 'Standard', display_label: 'FOB Costing (₹70,000)', amount: 70000 },
  { id: 2, location: 'Mundra', variant_label: 'Port', display_label: 'Mundra (₹62,000)', amount: 62000 },
  { id: 3, location: 'North', variant_label: 'Region', display_label: 'North (₹1,00,000)', amount: 100000 },
  { id: 4, location: 'Maharastra', variant_label: 'State', display_label: 'Maharastra (₹85,000)', amount: 85000 },
  { id: 5, location: 'Andhra', variant_label: 'State', display_label: 'Andhra (₹85,000)', amount: 85000 },
  { id: 6, location: 'TN', variant_label: 'State', display_label: 'TN (₹70,000)', amount: 70000 },
  { id: 7, location: 'Nagpur', variant_label: 'Location', display_label: 'Nagpur (₹1,23,000)', amount: 123000 },
  { id: 8, location: 'Pusad', variant_label: 'Location', display_label: 'Pusad (₹1,20,000)', amount: 120000 },
  { id: 9, location: 'Biratnagar', variant_label: '15 tons', display_label: 'Biratnagar 15 tons (₹1,69,000)', amount: 169000 },
  { id: 10, location: 'Katmandu', variant_label: 'Location', display_label: 'Katmandu (₹2,20,000)', amount: 220000 },
  { id: 11, location: 'Biratnagar', variant_label: '23 tons — Route A', display_label: 'Biratnagar 23 tons (₹2,40,000)', amount: 240000 },
  { id: 12, location: 'Biratnagar', variant_label: '23 tons — Route B', display_label: 'Biratnagar 23 tons (₹1,35,000)', amount: 135000 },
  { id: 13, location: 'keytex', variant_label: 'Location', display_label: 'keytex (₹1,20,000)', amount: 120000 },
];

// Seed Quantity Options
const quantityOptions = [
  { id: 1, packing_type: 'Cartons', qty_per_fcl: 21319.20, is_default: true },
  { id: 2, packing_type: 'Pallets', qty_per_fcl: 19500, is_default: false },
  { id: 3, packing_type: 'Double yarn carton', qty_per_fcl: 20412, is_default: false },
  { id: 4, packing_type: 'OE yarn Pallet', qty_per_fcl: 19000, is_default: false },
  { id: 5, packing_type: 'OE yarn carton', qty_per_fcl: 19000, is_default: false },
];

// Dynamic Margin Terms based on Destination Port
export function getMarginTermsForDestination(destination: string) {
  const dest = (destination || '').toLowerCase();
  
  const isChinaVietnam = dest.includes('qingdao') || dest.includes('shanghai') || dest.includes('cat lai') || dest.includes('wuhu');
  const isSouthAmerica = dest.includes('callao') || dest.includes('buenaventura') || dest.includes('santos') || dest.includes('lazaro cardenas') || dest.includes('quetzal');
  const isChittagong = dest.includes('chittagong');

  if (isChinaVietnam) {
    return [
      { id: 1, term_code: 'LC_SIGHT', term_label: 'LC at sight', margin_pct: 2.0, is_default: true },
      { id: 2, term_code: '20_80', term_label: '20/80', margin_pct: 2.0, is_default: false },
      { id: 3, term_code: 'LC_30_DAYS', term_label: 'Lc 30 days from BL date', margin_pct: 2.5, is_default: false },
      { id: 4, term_code: 'LC_45_DAYS', term_label: 'Lc 45 days from BL date', margin_pct: 2.5, is_default: false },
      { id: 5, term_code: 'LC_60_DAYS', term_label: 'Lc 60 days from BL date', margin_pct: 2.75, is_default: false },
      { id: 6, term_code: 'LC_90_DAYS', term_label: 'Lc 90 days from BL date', margin_pct: 3.0, is_default: false },
    ];
  } else if (isSouthAmerica) {
    return [
      { id: 1, term_code: '20_80', term_label: '20/80', margin_pct: 3.5, is_default: true },
      { id: 2, term_code: 'LC_SIGHT', term_label: 'LC at sight', margin_pct: 3.5, is_default: false },
      { id: 3, term_code: 'LC_90_DAYS', term_label: 'Lc 90 days from BL date', margin_pct: 4.5, is_default: false },
    ];
  } else {
    const add = isChittagong ? 0.25 : 0;
    return [
      { id: 1, term_code: '20_80', term_label: '20/80', margin_pct: 3.0 + add, is_default: false },
      { id: 2, term_code: 'LC_SIGHT', term_label: 'LC at sight', margin_pct: 3.0 + add, is_default: true },
      { id: 3, term_code: 'LC_30_DAYS', term_label: 'Lc 30 days from BL date', margin_pct: 3.0 + add, is_default: false },
      { id: 4, term_code: 'LC_60_DAYS', term_label: 'Lc 60 days from BL date', margin_pct: 3.25 + add, is_default: false },
      { id: 5, term_code: 'LC_90_DAYS', term_label: 'Lc 90 days', margin_pct: 3.5 + add, is_default: false },
      { id: 6, term_code: 'LC_120_DAYS', term_label: 'Lc 120 days from BL date', margin_pct: 4.0 + add, is_default: false },
      { id: 7, term_code: 'LC_150_DAYS', term_label: 'Lc 150 days from BL date', margin_pct: 4.5 + add, is_default: false },
    ];
  }
}

// Seed Margin Terms (fallback)
const marginTerms = [
  { id: 1, term_code: 'LC_SIGHT', term_label: 'LC at sight', margin_pct: 3.0, is_default: true },
  { id: 2, term_code: '20_80', term_label: '20/80', margin_pct: 3.0, is_default: false },
  { id: 3, term_code: 'LC_30_DAYS', term_label: 'Lc 30 days from BL date', margin_pct: 3.0, is_default: false },
  { id: 4, term_code: 'LC_60_DAYS', term_label: 'Lc 60 days from BL date', margin_pct: 3.25, is_default: false },
  { id: 5, term_code: 'LC_90_DAYS', term_label: 'Lc 90 days', margin_pct: 3.5, is_default: false },
  { id: 6, term_code: 'LC_120_DAYS', term_label: 'Lc 120 days from BL date', margin_pct: 4.0, is_default: false },
  { id: 7, term_code: 'LC_150_DAYS', term_label: 'Lc 150 days from BL date', margin_pct: 4.5, is_default: false },
];

// Seed Daily FX Store with accurate live rates
export const fetchRealtimeFxRates = async (): Promise<{ usdInr: number; eurInr: number; dateStr: string; isFallback: boolean }> => {
  const today = new Date().toISOString().split('T')[0];

  // Strategy 1: open.er-api.com (High accuracy real-time exchange rates)
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD');
    if (res.ok) {
      const data = await res.json();
      if (data?.rates?.INR) {
        const usdInr = Number(Number(data.rates.INR).toFixed(2));
        const eurInr = data.rates.EUR
          ? Number((data.rates.INR / data.rates.EUR).toFixed(2))
          : Number((usdInr * 1.167).toFixed(2));
        const dateStr = data.time_last_update_utc ? new Date(data.time_last_update_utc).toISOString().split('T')[0] : today;
        return { usdInr, eurInr, dateStr, isFallback: false };
      }
    }
  } catch (e) {
    console.warn('FX Provider 1 (open.er-api) failed, trying fallback...', e);
  }

  // Strategy 2: Frankfurter API (ECB Reference Rates)
  try {
    const [usdRes, eurRes] = await Promise.all([
      fetch('https://api.frankfurter.app/latest?from=USD&to=INR').then(r => r.json()),
      fetch('https://api.frankfurter.app/latest?from=EUR&to=INR').then(r => r.json()),
    ]);
    const usdRate = usdRes?.rates?.INR ? Number(Number(usdRes.rates.INR).toFixed(2)) : null;
    const eurRate = eurRes?.rates?.INR ? Number(Number(eurRes.rates.INR).toFixed(2)) : null;
    if (usdRate && eurRate) {
      return { usdInr: usdRate, eurInr: eurRate, dateStr: usdRes.date || today, isFallback: false };
    }
  } catch (e) {
    console.warn('FX Provider 2 (frankfurter) failed, trying fallback...', e);
  }

  // Strategy 3: exchangerate-api.com
  try {
    const res = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
    if (res.ok) {
      const data = await res.json();
      if (data?.rates?.INR) {
        const usdInr = Number(Number(data.rates.INR).toFixed(2));
        const eurInr = data.rates.EUR
          ? Number((data.rates.INR / data.rates.EUR).toFixed(2))
          : Number((usdInr * 1.167).toFixed(2));
        return { usdInr, eurInr, dateStr: data.date || today, isFallback: false };
      }
    }
  } catch (e) {
    console.warn('FX Provider 3 (exchangerate-api) failed', e);
  }

  return { usdInr: 95.43, eurInr: 111.36, dateStr: today, isFallback: true };
};

let exchangeRatesStore: Record<string, { rate: number; rate_date: string; is_fallback: boolean }> = {
  'USD': { rate: 95.43, rate_date: new Date().toISOString().split('T')[0], is_fallback: false },
  'EUR': { rate: 111.36, rate_date: new Date().toISOString().split('T')[0], is_fallback: false },
};

// Immediately trigger background fetch on load
fetchRealtimeFxRates().then(rates => {
  exchangeRatesStore['USD'] = { rate: rates.usdInr, rate_date: rates.dateStr, is_fallback: rates.isFallback };
  exchangeRatesStore['EUR'] = { rate: rates.eurInr, rate_date: rates.dateStr, is_fallback: rates.isFallback };
}).catch(() => {});

export const handleGetProducts = () => {
  return [{ id: 1, code: 'COTTON', name: 'Cotton Yarn' }];
};

export const handleGetFreightOrigins = (productCode: string) => {
  const origins = Array.from(new Set(freightRates.filter(f => f.amount != null).map(f => f.origin))).sort();
  return origins.map(o => ({ origin: o }));
};

export const handleGetFreightDestinations = (productCode: string, origin?: string) => {
  if (origin) {
    const dests = freightRates.filter(f => f.origin === origin && f.amount != null).map(f => f.destination).sort();
    return dests.map(d => ({ destination: d }));
  }
  const dests = Array.from(new Set(freightRates.filter(f => f.amount != null).map(f => f.destination))).sort();
  return dests.map(d => ({ destination: d }));
};

export const handleGetFreightRate = (productCode: string, origin?: string, destination?: string) => {
  if (!destination) {
    return {
      base_amount_usd: null,
      surcharge: 25,
      selected_freight_usd: null,
      origin: null,
      available: false,
    };
  }

  // If origin is provided, try exact match first
  let record = origin ? freightRates.find(f => f.origin === origin && f.destination === destination) : null;
  // If not found or origin not provided, find any published record matching destination
  if (!record || record.amount == null) {
    record = freightRates.find(f => f.destination.toLowerCase() === destination.toLowerCase() && f.amount != null) || record;
  }

  // Also check dynamic sheet records / daily pricing store (e.g. Surat)
  if (!record || record.amount == null) {
    const dynamicFreight = DEFAULT_PRICING_SNAPSHOT.sheets?.freight?.rows?.find(
      (r: any) => String(r.destination || '').toLowerCase().trim() === destination.toLowerCase().trim()
    );
    if (dynamicFreight && dynamicFreight.amount != null && Number(dynamicFreight.amount) > 0) {
      record = {
        origin: origin || 'Gujarat',
        destination: dynamicFreight.destination,
        amount: Number(dynamicFreight.amount),
      };
    }
  }

  if (!record || record.amount == null) {
    return {
      base_amount_usd: null,
      surcharge: 25,
      selected_freight_usd: null,
      origin: record?.origin || origin || null,
      available: false,
    };
  }
  return {
    base_amount_usd: record.amount,
    surcharge: 25,
    selected_freight_usd: record.amount + 25,
    origin: record.origin,
    available: true,
  };
};

export const handleGetFobLocations = (productCode: string) => {
  return fobRates;
};

export const handleGetQuantityOptions = (productCode: string) => {
  return quantityOptions;
};

export const handleGetMarginTerms = (productCode: string) => {
  return marginTerms;
};

export const handleGetExchangeRates = (p_date?: string) => {
  return {
    USD_INR: exchangeRatesStore['USD'],
    EUR_INR: exchangeRatesStore['EUR'],
  };
};

export const handleRefreshExchangeRates = async () => {
  const rates = await fetchRealtimeFxRates();
  exchangeRatesStore['USD'] = {
    rate: rates.usdInr,
    rate_date: rates.dateStr,
    is_fallback: rates.isFallback,
  };
  exchangeRatesStore['EUR'] = {
    rate: rates.eurInr,
    rate_date: rates.dateStr,
    is_fallback: rates.isFallback,
  };

  return {
    USD_INR: exchangeRatesStore['USD'],
    EUR_INR: exchangeRatesStore['EUR'],
  };
};

export const handleCalculateCosting = (params: any) => {
  const productCode = params.p_product_code || 'COTTON';
  const exMill = Number(params.p_ex_mill);
  const origin = params.p_origin;
  const destination = params.p_destination;
  const fobRateId = Number(params.p_fob_rate_id);
  const qty = Number(params.p_qty);
  const bci = Number(params.p_bci || 0);
  const commissionType: 'PCT' | 'USD_PER_KG' = params.p_commission_type === 'USD_PER_KG' ? 'USD_PER_KG' : 'PCT';
  const commissionVal = Number(params.p_commission_value != null ? params.p_commission_value : (params.p_commission_pct ?? 0));
  const marginTermCode = params.p_margin_term_code || 'LC_SIGHT';
  const targetUsd = params.p_target_usd != null ? Number(params.p_target_usd) : null;

  // Look up FOB amount (direct from Sheet 2 or from ID master)
  let fobAmount = 70000;
  if (params.p_fob_amount != null && !isNaN(Number(params.p_fob_amount)) && Number(params.p_fob_amount) > 0) {
    fobAmount = Number(params.p_fob_amount);
  } else {
    const fobRecord = fobRates.find(f => f.id === fobRateId);
    fobAmount = fobRecord ? fobRecord.amount : (fobRateId === 70000 ? 70000 : 70000);
  }

  // Look up Freight rate (direct from Google Sheet 3 or lookup)
  let baseFreightUsd: number | null = null;
  let surcharge = 25;
  let selectedFreightUsd: number | null = null;

  if (params.p_selected_freight_usd != null && !isNaN(Number(params.p_selected_freight_usd)) && Number(params.p_selected_freight_usd) > 0) {
    selectedFreightUsd = Number(params.p_selected_freight_usd);
    surcharge = Number(params.p_freight_surcharge || 25);
    baseFreightUsd = params.p_base_freight_usd != null ? Number(params.p_base_freight_usd) : selectedFreightUsd - surcharge;
  } else if (params.p_base_freight_usd != null && !isNaN(Number(params.p_base_freight_usd)) && Number(params.p_base_freight_usd) > 0) {
    baseFreightUsd = Number(params.p_base_freight_usd);
    surcharge = Number(params.p_freight_surcharge || 25);
    selectedFreightUsd = baseFreightUsd + surcharge;
  } else {
    const freightRes = handleGetFreightRate(productCode, origin, destination);
    if (!freightRes.available || freightRes.base_amount_usd == null) {
      throw new Error('no freight rate published for this route');
    }
    baseFreightUsd = freightRes.base_amount_usd;
    surcharge = freightRes.surcharge || 25;
    selectedFreightUsd = baseFreightUsd + surcharge;
  }

  // FX Resolution
  let usdInr = params.p_usd_inr != null ? Number(params.p_usd_inr) : exchangeRatesStore['USD']?.rate ?? 95.43;
  let eurInr: number | null = null;
  let eurUnavailable = false;

  if (params.p_eur_inr !== undefined) {
    eurInr = params.p_eur_inr != null ? Number(params.p_eur_inr) : null;
    if (eurInr == null) eurUnavailable = true;
  } else {
    eurInr = exchangeRatesStore['EUR']?.rate ?? 111.36;
  }

  // Margin % based on destination port rules
  const destinationMarginTerms = getMarginTermsForDestination(destination);
  const marginRecord = destinationMarginTerms.find(m => m.term_code === marginTermCode) || marginTerms.find(m => m.term_code === marginTermCode);
  const marginPct = marginRecord ? marginRecord.margin_pct : 3.0;

  // Step Calculations
  const fxPad = 0.50;
  const paddedRate = usdInr + fxPad;
  const ddbRodtepPct = 5.0; // 5%
  const ddbRodtep = exMill * (ddbRodtepPct / 100.0);
  const netExMill = exMill - ddbRodtep;
  const fobCostPerKg = fobAmount / qty;
  const freightPerKg = (selectedFreightUsd * paddedRate) / qty;
  const totalCost = netExMill + fobCostPerKg + freightPerKg;

  const baseAmount = totalCost + bci;

  let commissionInr = 0;
  let commissionUsd = 0;
  let effectiveCommissionPct = 0;

  if (commissionType === 'USD_PER_KG') {
    commissionUsd = commissionVal;
    commissionInr = commissionVal * usdInr;
    effectiveCommissionPct = baseAmount > 0 ? (commissionInr / baseAmount) * 100.0 : 0;
  } else {
    effectiveCommissionPct = commissionVal;
    commissionInr = baseAmount * (commissionVal / 100.0);
    commissionUsd = usdInr > 0 ? commissionInr / usdInr : 0;
  }

  const interestAmt = commissionInr;
  const marginAmt = baseAmount * (marginPct / 100.0);
  const finalInr = baseAmount + interestAmt + marginAmt;

  const usdPrice = finalInr / usdInr;
  const eurPrice = (eurInr && eurInr > 0) ? (baseAmount + (baseAmount * marginPct / 100.0) + commissionInr) / eurInr : null;

  // Reverse / Target Calculation
  let targetCalc = null;
  if (targetUsd != null && targetUsd > 0) {
    const targetInr = targetUsd * usdInr;
    const allowedExMill = targetInr - bci - freightPerKg - fobCostPerKg;
    const withBuffer = allowedExMill * 1.05;
    const afterInterest = commissionType === 'USD_PER_KG'
      ? withBuffer - commissionInr
      : withBuffer - (withBuffer * (effectiveCommissionPct / 100.0));
    const finalTarget = afterInterest - (afterInterest * (marginPct / 100.0));

    targetCalc = {
      target_usd: targetUsd,
      target_inr: targetInr,
      allowed_ex_mill: allowedExMill,
      with_buffer: withBuffer,
      after_interest: afterInterest,
      final_target: finalTarget,
    };
  }

  return {
    ex_mill_price: exMill,
    qty_per_fcl: qty,
    selected_freight_usd: selectedFreightUsd,
    ddb_rodtep: ddbRodtep,
    net_ex_mill: netExMill,
    fob_cost_per_kg: fobCostPerKg,
    padded_rate: paddedRate,
    freight_per_kg: freightPerKg,
    total_cost: totalCost,
    usd_price: usdPrice,
    eur_price: eurPrice,
    eur_unavailable: eurUnavailable,
    commission_type: commissionType,
    commission_value: commissionVal,
    commission_inr: commissionInr,
    commission_usd: commissionUsd,
    effective_commission_pct: effectiveCommissionPct,
    target_calc: targetCalc,
    fx: {
      usd_inr: usdInr,
      eur_inr: eurInr,
      rate_date: new Date().toISOString().split('T')[0],
      is_fallback: false,
      padded_usd_inr: paddedRate,
      eur_unavailable: eurUnavailable,
    },
    assumptions: {
      ddb_rodtep_pct: ddbRodtepPct,
      interest_comm_pct: effectiveCommissionPct,
      commission_type: commissionType,
      commission_value: commissionVal,
      margin_pct: marginPct,
      fx_pad: fxPad,
      freight_surcharge: surcharge,
      target_buffer_factor: 1.05,
    },
  };
};

export const handleSaveCosting = (p_inputs: any, p_outputs: any) => {
  const refNo = `QT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
  const record: SavedCostingRecord = {
    reference_no: refNo,
    created_at: new Date().toISOString(),
    inputs: p_inputs,
    outputs: p_outputs,
    usd_inr_used: p_outputs.fx.usd_inr,
    eur_inr_used: p_outputs.fx.eur_inr,
  };
  savedRecordsStore.unshift(record);
  return refNo;
};

export const handleReplayCosting = (p_reference_no: string) => {
  const record = savedRecordsStore.find(r => r.reference_no === p_reference_no);
  if (!record) {
    throw new Error(`Reference ${p_reference_no} not found`);
  }
  return handleCalculateCosting({
    ...record.inputs,
    p_product_code: record.inputs.product_code || 'COTTON',
    p_ex_mill: record.inputs.ex_mill,
    p_origin: record.inputs.origin,
    p_destination: record.inputs.destination,
    p_fob_rate_id: record.inputs.fob_rate_id,
    p_qty: record.inputs.qty,
    p_bci: record.inputs.bci,
    p_margin_term_code: record.inputs.margin_term_code,
    p_target_usd: record.inputs.target_usd,
    p_usd_inr: record.usd_inr_used,
    p_eur_inr: record.eur_inr_used,
  });
};
