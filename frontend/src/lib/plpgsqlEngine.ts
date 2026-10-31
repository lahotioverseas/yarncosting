// PL/pgSQL RPC Calculation Engine Implementation for Node/Express Backend
// Mirrors src/db/schema.sql calculate_cotton_yarn_costing PL/pgSQL procedure

import { CostingCalculationResult, CostingInput } from '../types';

export function calculateCottonYarnCostingPLpgSQL(input: Partial<CostingInput>): CostingCalculationResult {
  const inp = input as any;
  // Inputs from user/config/master
  const currency_code = inp.currency_code || 'USD';
  const ex_mill_price = Number(inp.ex_mill_price_inr_per_kg) ?? 245.0;
  const qty_per_fcl = Number(inp.container_capacity_kg) || 21000.0;
  const fob_amount = Number(inp.total_port_fob_expenses_inr) ?? 62000.0;
  const base_freight_usd = inp.ocean_freight_usd !== undefined && inp.ocean_freight_usd !== null ? Number(inp.ocean_freight_usd) : 950.0;
  const freight_surcharge = 25.0; // Config rule +25
  const fx_pad = 0.50; // Config rule +0.5
  
  const usd_inr = Number(inp.base_fx_rate) || 83.50;
  const eur_inr = inp.eur_inr ? Number(inp.eur_inr) : 90.20;

  const ddb_rodtep_pct = Number(inp.rodtep_rebate_pct ?? 5.0);
  const commission_type = inp.commission_type === 'USD_PER_KG' ? 'USD_PER_KG' : 'PCT';
  const commission_val = Number(inp.commission_value != null ? inp.commission_value : (inp.agent_commission_pct ?? inp.packing_credit_interest_pct_pa ?? 0.0));
  const margin_pct = Number(inp.trader_margin_pct ?? 3.0);
  const bci_org = Number(inp.bci_org ?? 0.0);
  const target_usd = Number(inp.target_usd ?? 2.93);

  // Step 1 — Selected freight (the +25 rule)
  // The surcharge is added to the raw per-FCL USD rate from master, before conversion
  const selected_freight_usd = base_freight_usd + freight_surcharge;

  // Step 2 — DDB & RoDTEP (export incentive earned back)
  const ddb_rodtep = ex_mill_price * (ddb_rodtep_pct / 100.0);

  // Step 3 — Net Ex-Mill
  const net_ex_mill = ex_mill_price - ddb_rodtep;

  // Step 4 — FOB cost per kg
  const fob_cost_per_kg = fob_amount / (qty_per_fcl || 1);

  // Step 5 — Freight cost per kg
  const padded_rate = usd_inr + fx_pad;
  const freight_per_kg = (selected_freight_usd * padded_rate) / (qty_per_fcl || 1);

  // Step 6 — Total cost
  const total_cost = net_ex_mill + fob_cost_per_kg + freight_per_kg;

  // Step 7 — USD price
  const base_amount = total_cost + bci_org;

  let commission_inr = 0;
  let commission_usd = 0;
  let effective_comm_pct = 0;

  if (commission_type === 'USD_PER_KG') {
    commission_usd = commission_val;
    commission_inr = commission_val * usd_inr;
    effective_comm_pct = base_amount > 0 ? (commission_inr / base_amount) * 100.0 : 0;
  } else {
    effective_comm_pct = commission_val;
    commission_inr = base_amount * (commission_val / 100.0);
    commission_usd = usd_inr > 0 ? commission_inr / usd_inr : 0;
  }

  const interest_amt = commission_inr;
  const margin_amt = base_amount * (margin_pct / 100.0);
  const final_inr = base_amount + interest_amt + margin_amt;
  const usd_price = final_inr / usd_inr;

  // Step 8 — EUR price
  let eur_price: number | null = null;
  let eur_unavailable = false;
  if (eur_inr && eur_inr > 0) {
    eur_price = (total_cost + bci_org + (total_cost * (margin_pct / 100.0)) + commission_inr) / eur_inr;
  } else {
    eur_unavailable = true;
  }

  // Step 9 — Target / reverse costing
  const target_inr = target_usd * usd_inr;
  const allowed_ex_mill = target_inr - bci_org - freight_per_kg - fob_cost_per_kg;
  const with_buffer = allowed_ex_mill * 1.05; // target_buffer_factor
  const after_interest = commission_type === 'USD_PER_KG'
    ? with_buffer - commission_inr
    : with_buffer - (with_buffer * (effective_comm_pct / 100.0));
  const final_target = after_interest - (after_interest * (margin_pct / 100.0));

  // Legacy compatibility fields for full container view
  const effective_fx = usd_inr - 0.5;
  const cif_price_usd = currency_code === 'EUR' && eur_price !== null ? eur_price : usd_price;
  const cif_price_inr = cif_price_usd * usd_inr;
  const total_shipment_cost_inr = total_cost * qty_per_fcl;
  const total_net_profit_inr = margin_amt * qty_per_fcl;
  const total_net_profit_usd = total_net_profit_inr / usd_inr;
  const profit_margin_pct = total_shipment_cost_inr > 0 ? (total_net_profit_inr / total_shipment_cost_inr) * 100.0 : 0;

  // Sensitivity Matrix
  const fx_sensitivity = [];
  for (let shift = -2.0; shift <= 2.0; shift += 1.0) {
    const s_fx = usd_inr + shift;
    if (s_fx > 0) {
      const s_padded = s_fx + fx_pad;
      const s_freight_kg = (selected_freight_usd * s_padded) / qty_per_fcl;
      const s_total_cost = net_ex_mill + fob_cost_per_kg + s_freight_kg;
      const s_base = s_total_cost + bci_org;
      const s_final_inr = s_base + (s_base * effective_comm_pct / 100.0) + (s_base * margin_pct / 100.0);
      const s_usd_price = s_final_inr / s_fx;
      const s_profit = margin_amt * qty_per_fcl / s_fx;
      fx_sensitivity.push({
        rate_shift: shift,
        fx_rate: Number(s_fx.toFixed(2)),
        cif_price_usd: Number(s_usd_price.toFixed(4)),
        net_profit_usd: Number(s_profit.toFixed(2))
      });
    }
  }

  const round2 = (num: number) => Number(num.toFixed(2));
  const round4 = (num: number) => Number(num.toFixed(4));

  return {
    currency_code,
    container_capacity_kg: round2(qty_per_fcl),
    effective_fx_rate: round2(usd_inr),
    ex_mill_price_inr_per_kg: round2(ex_mill_price),
    mill_freight_inr_per_kg: 0,
    packaging_cost_inr_per_kg: 0,
    yarn_base_cost_inr_per_kg: round2(ex_mill_price),
    port_expense_inr_per_kg: round2(fob_cost_per_kg),
    interest_cost_inr_per_kg: round2(interest_amt),
    gross_landed_cost_inr_per_kg: round2(total_cost),
    total_incentive_pct: round2(ddb_rodtep_pct),
    incentive_amount_inr_per_kg: round2(ddb_rodtep),
    fob_cost_inr_per_kg: round2(fob_cost_per_kg),
    agent_commission_inr_per_kg: round2(commission_inr),
    ecgc_amount_inr_per_kg: 0,
    trader_margin_inr_per_kg: round2(margin_amt),
    selling_fob_price_inr_per_kg: round2(final_inr),
    ocean_freight_inr_per_kg: round2(freight_per_kg),
    cfr_price_inr_per_kg: round2(final_inr),
    insurance_inr_per_kg: 0,
    cif_price_inr_per_kg: round2(cif_price_inr),

    fob_cost_usd_per_kg: round4(fob_cost_per_kg / usd_inr),
    agent_commission_usd_per_kg: round4(commission_usd),
    ecgc_amount_usd_per_kg: 0,
    trader_margin_usd_per_kg: round4(margin_amt / usd_inr),
    selling_fob_price_usd_per_kg: round4(final_inr / usd_inr),
    ocean_freight_usd_per_kg: round4(selected_freight_usd / qty_per_fcl),
    cfr_price_usd_per_kg: round4(cif_price_usd),
    insurance_usd_per_kg: 0,
    cif_price_usd_per_kg: round4(cif_price_usd),

    total_shipment_weight_kg: round2(qty_per_fcl),
    total_ex_mill_cost_inr: round2(ex_mill_price * qty_per_fcl),
    total_shipment_cost_inr: round2(total_shipment_cost_inr),
    total_fob_revenue_usd: round2((final_inr / usd_inr) * qty_per_fcl),
    total_cif_revenue_usd: round2(cif_price_usd * qty_per_fcl),
    total_net_profit_inr: round2(total_net_profit_inr),
    total_net_profit_usd: round2(total_net_profit_usd),
    profit_margin_pct: round2(profit_margin_pct),

    breakeven_ex_mill_inr_per_kg: round2(final_target),
    breakeven_cif_usd_per_kg: round4(total_cost / usd_inr),

    // Section 5 Specific Fields
    selected_freight_usd: round2(selected_freight_usd),
    ddb_rodtep: round2(ddb_rodtep),
    net_ex_mill: round2(net_ex_mill),
    fob_cost_per_kg: round2(fob_cost_per_kg),
    padded_rate: round2(padded_rate),
    freight_per_kg: round2(freight_per_kg),
    total_cost: round2(total_cost),
    usd_price: round4(usd_price),
    eur_price: eur_price !== null ? round4(eur_price) : null,
    eur_unavailable,

    commission_type: commission_type as any,
    commission_value: round4(commission_val),
    commission_inr: round2(commission_inr),
    commission_usd: round4(commission_usd),
    effective_commission_pct: round2(effective_comm_pct),

    target_calc: {
      target_usd: round4(target_usd),
      target_inr: round2(target_inr),
      allowed_ex_mill: round2(allowed_ex_mill),
      with_buffer: round2(with_buffer),
      after_interest: round2(after_interest),
      final_target: round2(final_target),
    },

    fx_sensitivity,
    fx: {
      usd_inr,
      eur_inr: eur_unavailable ? null : eur_inr,
      rate_date: new Date().toISOString().split('T')[0],
      is_fallback: false,
      padded_usd_inr: padded_rate,
      eur_unavailable,
    }
  };
}
