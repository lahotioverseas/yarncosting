/**
 * Regenerates backend/tests/fixtures/ts_golden.json from the ORIGINAL TypeScript
 * costing engine + sheet parsers, so the Python port is tested against them.
 * Run from frontend/:  npx tsx ../backend/scripts/generate_ts_golden.ts
 */
import fs from 'fs';
import path from 'path';
import { handleCalculateCosting, handleGetFreightRate, handleGetFreightDestinations, handleGetFreightOrigins } from '../../frontend/src/lib/rpcHandlers';
import { calculateCottonYarnCostingPLpgSQL } from '../../frontend/src/lib/plpgsqlEngine';
import { parseGoogleSheetYarnCSV, parseGoogleSheetFobCSV, parseGoogleSheetFreightCSV, FALLBACK_FOB_SNAPSHOT_CSV, FALLBACK_FREIGHT_SNAPSHOT_CSV } from '../../frontend/src/lib/googleSheetService';

const ref = { p_product_code: 'COTTON', p_ex_mill: 338, p_origin: 'Gujarat', p_destination: 'Chittagong', p_fob_rate_id: 1, p_qty: 21000, p_bci: 0, p_margin_term_code: 'LC_SIGHT', p_usd_inr: 95.4, p_eur_inr: 111.36 };
const costingCases: any[] = [
  ref,
  { ...ref, p_target_usd: 2.93 },
  { ...ref, p_eur_inr: null },
  { ...ref, p_usd_inr: 90.0 },
  { ...ref, p_destination: 'Qingdao/SH', p_margin_term_code: 'LC_60_DAYS', p_bci: 4.5, p_commission_value: 1.5, p_target_usd: 3.1 },
  { ...ref, p_destination: 'Callao', p_margin_term_code: 'LC_90_DAYS', p_commission_type: 'USD_PER_KG', p_commission_value: 0.05, p_target_usd: 3.4 },
  { ...ref, p_fob_amount: 125000, p_selected_freight_usd: 1830, p_freight_surcharge: 30, p_qty: 19500 },
  { ...ref, p_base_freight_usd: 1200, p_fob_rate_id: 9, p_qty: '20412', p_ex_mill: '290.5' },
  { ...ref, p_destination: 'Hamburg', p_origin: 'Maharashtra', p_margin_term_code: 'UNKNOWN', p_commission_pct: 2 },
];
const yarnCases: any[] = [
  {},
  { ex_mill_price_inr_per_kg: 338, container_capacity_kg: 21000, total_port_fob_expenses_inr: 70000, ocean_freight_usd: 950, base_fx_rate: 95.4, eur_inr: 111.36, trader_margin_pct: 3 },
  { ex_mill_price_inr_per_kg: 290, container_capacity_kg: 19500, total_port_fob_expenses_inr: 62000, ocean_freight_usd: 2900, base_fx_rate: 88.2, eur_inr: 0, commission_type: 'USD_PER_KG', commission_value: 0.04, bci_org: 3, target_usd: 3.3, currency_code: 'EUR' },
  { ex_mill_price_inr_per_kg: 310, total_port_fob_expenses_inr: 85000, ocean_freight_usd: null, base_fx_rate: 0, agent_commission_pct: 1.25, rodtep_rebate_pct: 4, currency_code: 'EUR' },
];

const MATRIX_CSV = `KNITTING YARNS,,,,,,,,,KH,Factory location ,CH,Factory location ,CCH,Factory location ,,
NE 16/1 ,270,Gujrat,,,,,,
NE 20/1,275,Gujrat,287,Gujrat,289,Gujrat,,
NE 24/1,"₹ 285",Gujrat,298,Gujrat,299,Gujrat,,
NE 50/1,,,,,400,Tamil Nadu,,,,,,,,,,
WAEVING YARNS,,,,,,,,,KW,Factory location ,KCW,Factory location ,CCW,Factory location ,,
NE 16/1 ,260,Nagpur,261,Nagpur,287,Maharastra,,
NE 16/1 ,262,Nagpur,261,Nagpur,287,Maharastra,,
DOUBLE YARNS,,,,,,,,,KW/KH SOFT TWIST,Factory location ,KW HARD TWIST,Factory location ,CH SOFT TWIST,Factory location ,CW HARD TWIST,Factory location 
NE 20/2,285,Nagpur,288,Nagpur,306,Gujrat,310,Maharastra
"NE 40/2",,,,,384,"Gujrat, West",391,Maharastra`;
const FLAT_CSV = `Some title
Yarn Count,Quality,Ex-Mill Price (INR),Factory Location
NE 30/1,KH,301.5,Gujrat
NE 30/1,CH,,
NE 32/1, CCH ,"1,315",Tamil   Nadu`;

const out = {
  costing: costingCases.map((input) => ({ input, output: handleCalculateCosting(input) })),
  yarnEngine: yarnCases.map((input) => {
    const o: any = calculateCottonYarnCostingPLpgSQL(input);
    delete o.fx.rate_date;
    return { input, output: o };
  }),
  freightRates: [
    ['Gujarat', 'Chittagong'], ['Gujarat', 'Santos'], [undefined, 'callao'], ['Chennai', 'Puerto quetzal'], ['Gujarat', ''],
  ].map(([o, d]) => ({ origin: o ?? null, destination: d, output: handleGetFreightRate('COTTON', o as any, d as any) })),
  destinations: { Maharashtra: handleGetFreightDestinations('COTTON', 'Maharashtra'), all: handleGetFreightDestinations('COTTON') },
  origins: handleGetFreightOrigins('COTTON'),
  parsers: {
    matrix: { csv: MATRIX_CSV, output: parseGoogleSheetYarnCSV(MATRIX_CSV) },
    flat: { csv: FLAT_CSV, output: parseGoogleSheetYarnCSV(FLAT_CSV) },
    fob: { csv: FALLBACK_FOB_SNAPSHOT_CSV, output: parseGoogleSheetFobCSV(FALLBACK_FOB_SNAPSHOT_CSV) },
    freight: { csv: FALLBACK_FREIGHT_SNAPSHOT_CSV, output: parseGoogleSheetFreightCSV(FALLBACK_FREIGHT_SNAPSHOT_CSV) },
  },
};
for (const c of out.costing) delete (c.output as any).fx.rate_date;
fs.writeFileSync(path.resolve(__dirname, '../tests/fixtures/ts_golden.json'), JSON.stringify(out, null, 2) + '\n');
console.log('golden written');
process.exit(0);
