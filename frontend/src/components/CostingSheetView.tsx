import React from 'react';
import { CostingCalculationResult, CostingInput, UserProfile } from '../types';
import { formatCurrencyByCode, formatINR, formatPercent, formatUSD, formatWeight } from '../utils/formatters';
import { TrendingUp, DollarSign, Package, AlertCircle, Save, Printer, ArrowRight, ShieldCheck, Scale, BarChart3, CheckCircle2, Lock } from 'lucide-react';

interface CostingSheetViewProps {
  input: CostingInput;
  results: CostingCalculationResult | null;
  isCalculating: boolean;
  onSaveQuote: () => void;
  onOpenPrintModal: () => void;
  currentUser?: UserProfile | null;
}

export const CostingSheetView: React.FC<CostingSheetViewProps> = ({
  input,
  results,
  isCalculating,
  onSaveQuote,
  onOpenPrintModal,
  currentUser,
}) => {
  const isAdmin = currentUser?.role === 'admin';
  if (isCalculating && !results) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm space-y-4">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full mx-auto"></div>
        <p className="text-sm font-semibold text-slate-600">Executing Postgres PL/pgSQL RPC Costing Engine...</p>
      </div>
    );
  }

  if (!results) {
    return (
      <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 shadow-sm text-slate-500">
        Enter yarn parameters to calculate export costing sheet via server RPC.
      </div>
    );
  }

  return (
    <div id="costing-sheet-container" className="space-y-6">
      
      {/* Top Highlight Cards: CIF Quote Price & Net Shipment Profit */}
      <div className={`grid grid-cols-1 ${isAdmin ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-4`}>
        
        {/* Card 1: Final CIF Quote Price */}
        <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-indigo-800/50 relative overflow-hidden">
          <div className="absolute -right-4 -bottom-4 opacity-10">
            <DollarSign className="w-32 h-32 text-white" />
          </div>
          <div className="flex items-center justify-between text-indigo-200 text-xs font-semibold mb-2">
            <span>FINAL CIF QUOTE PRICE</span>
            <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 font-mono">
              Per KG ({input.currency_code})
            </span>
          </div>
          <div className="text-3xl font-extrabold font-mono tracking-tight text-white my-1">
            {formatCurrencyByCode(results.cif_price_usd_per_kg, input.currency_code, 4)}
          </div>
          <div className="text-xs text-indigo-300 font-medium flex items-center space-x-1.5 mt-2">
            <span>INR Equivalent:</span>
            <span className="font-mono font-bold text-white">{formatINR(results.cif_price_inr_per_kg)}</span>
          </div>
        </div>

        {/* Card 2: Net Shipment Profit (Admin Only) */}
        {isAdmin && (
          <div className="bg-gradient-to-br from-emerald-950 to-slate-900 text-white rounded-2xl p-6 shadow-md border border-emerald-800/40 relative overflow-hidden">
            <div className="absolute -right-4 -bottom-4 opacity-10">
              <TrendingUp className="w-32 h-32 text-emerald-400" />
            </div>
            <div className="flex items-center justify-between text-emerald-200 text-xs font-semibold mb-2">
              <span>NET SHIPMENT PROFIT</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                Full Container
              </span>
            </div>
            <div className="text-3xl font-extrabold font-mono tracking-tight text-emerald-400 my-1">
              {formatUSD(results.total_net_profit_usd, 2)}
            </div>
            <div className="text-xs text-emerald-200 font-medium flex items-center space-x-1.5 mt-2">
              <span>Profit Margin:</span>
              <span className="font-mono font-bold text-white bg-emerald-500/20 px-2 py-0.5 rounded">
                {formatPercent(results.profit_margin_pct)}
              </span>
              <span className="text-slate-400">({formatINR(results.total_net_profit_inr)})</span>
            </div>
          </div>
        )}

        {/* Card 3: Container Load & Effective FX */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-2">
              <span>SHIPMENT CAPACITY & FX RATE</span>
              <span className="text-slate-700 font-bold">{input.container_type}</span>
            </div>
            <div className="text-xl font-bold font-mono text-slate-900">
              {formatWeight(results.total_shipment_weight_kg)}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">{input.yarn_count_name}</p>
          </div>

          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">Effective FX Rate:</span>
            <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
              1 {input.currency_code} = {formatINR(results.effective_fx_rate)}
            </span>
          </div>
        </div>

      </div>

      {/* Action Buttons: Save Quote & Export Printable Sheet */}
      <div className="flex items-center justify-end space-x-3">
        <button
          id="btn-save-quote"
          onClick={onSaveQuote}
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 shadow-sm transition-all"
        >
          <Save className="w-4 h-4 text-emerald-400" />
          <span>Save Quote to History</span>
        </button>

        <button
          id="btn-print-quote"
          onClick={onOpenPrintModal}
          className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 shadow-sm transition-all"
        >
          <Printer className="w-4 h-4" />
          <span>Print / Export Commercial Sheet</span>
        </button>
      </div>

      {/* Cost Waterfall Breakdown Visual Stack */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BarChart3 className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-900 text-base">Per KG Cost Component Breakdown (INR vs {input.currency_code})</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">PL/pgSQL RPC Computed</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">1. Ex-Mill Purchase</span>
            <div className="text-base font-bold font-mono text-slate-900">{formatINR(results.ex_mill_price_inr_per_kg)}</div>
            <div className="text-xs text-slate-400 font-mono">Base Yarn Purchase</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">2. Freight & Packaging</span>
            <div className="text-base font-bold font-mono text-slate-900">{formatINR(results.mill_freight_inr_per_kg + results.packaging_cost_inr_per_kg)}</div>
            <div className="text-xs text-slate-400 font-mono">Mill Freight + Packaging</div>
          </div>

          <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/80 space-y-1">
            <span className="text-[11px] font-semibold text-amber-700 uppercase tracking-wider block">3. Interest & Working Cap</span>
            <div className="text-base font-bold font-mono text-amber-900">{formatINR(results.interest_cost_inr_per_kg)}</div>
            <div className="text-xs text-amber-600 font-mono">{input.credit_days} Credit Days @ {formatPercent(input.packing_credit_interest_pct_pa)}</div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">4. Port & Logistics THC</span>
            <div className="text-base font-bold font-mono text-slate-900">{formatINR(results.port_expense_inr_per_kg)}</div>
            <div className="text-xs text-slate-400 font-mono">THC + CHA + Inland Transport</div>
          </div>

        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
          
          <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 text-emerald-900 space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 block">Export Rebate Deduction (RoDTEP)</span>
            <div className="text-lg font-extrabold font-mono text-emerald-700">- {formatINR(results.incentive_amount_inr_per_kg)} / kg</div>
            <p className="text-xs text-emerald-600">Total Rebate Rate: {formatPercent(results.total_incentive_pct)} on FOB</p>
          </div>

          <div className="p-4 rounded-xl bg-indigo-50/70 border border-indigo-200 text-indigo-900 space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-700 block">Selling FOB Price</span>
            <div className="text-lg font-extrabold font-mono text-indigo-900">{formatCurrencyByCode(results.selling_fob_price_usd_per_kg, input.currency_code, 4)} / kg</div>
            <p className="text-xs text-indigo-600">({formatINR(results.selling_fob_price_inr_per_kg)})</p>
          </div>

          <div className="p-4 rounded-xl bg-slate-900 text-white space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-300 block">Final CIF Quote Price</span>
            <div className="text-lg font-extrabold font-mono text-white">{formatCurrencyByCode(results.cif_price_usd_per_kg, input.currency_code, 4)} / kg</div>
            <p className="text-xs text-slate-400">Freight ({formatUSD(results.ocean_freight_usd_per_kg)}) + Ins ({formatUSD(results.insurance_usd_per_kg)})</p>
          </div>

        </div>
      </div>

      {/* Comprehensive Line Item Cost Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="font-bold text-slate-900 text-sm">Detailed Export Itemized Cost Structure</h3>
          <span className="text-xs text-slate-500 font-mono">Currency: INR & {input.currency_code}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-700">
            <thead className="bg-slate-100/80 text-slate-600 font-semibold border-b border-slate-200 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Cost Component Element</th>
                <th className="py-3 px-4 text-right">INR / kg</th>
                <th className="py-3 px-4 text-right">{input.currency_code} / kg</th>
                <th className="py-3 px-4 text-right">Full Container ({formatWeight(results.total_shipment_weight_kg)})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              
              {isAdmin && (
                <tr>
                  <td className="py-2.5 px-4 font-semibold text-slate-900">Ex-Mill Purchase Price</td>
                  <td className="py-2.5 px-4 text-right font-mono">{formatINR(results.ex_mill_price_inr_per_kg)}</td>
                  <td className="py-2.5 px-4 text-right font-mono">{formatCurrencyByCode(results.ex_mill_price_inr_per_kg / results.effective_fx_rate, input.currency_code, 4)}</td>
                  <td className="py-2.5 px-4 text-right font-mono">{formatINR(results.total_ex_mill_cost_inr)}</td>
                </tr>
              )}

              <tr>
                <td className="py-2.5 px-4 text-slate-600 pl-8">Mill Freight & Inland Transport to Warehouse</td>
                <td className="py-2.5 px-4 text-right font-mono">{formatINR(results.mill_freight_inr_per_kg)}</td>
                <td className="py-2.5 px-4 text-right font-mono">{formatCurrencyByCode(results.mill_freight_inr_per_kg / results.effective_fx_rate, input.currency_code, 4)}</td>
                <td className="py-2.5 px-4 text-right font-mono">{formatINR(results.mill_freight_inr_per_kg * results.total_shipment_weight_kg)}</td>
              </tr>

              <tr>
                <td className="py-2.5 px-4 text-slate-600 pl-8">Packaging (Cones, Cartons, Strapping)</td>
                <td className="py-2.5 px-4 text-right font-mono">{formatINR(results.packaging_cost_inr_per_kg)}</td>
                <td className="py-2.5 px-4 text-right font-mono">{formatCurrencyByCode(results.packaging_cost_inr_per_kg / results.effective_fx_rate, input.currency_code, 4)}</td>
                <td className="py-2.5 px-4 text-right font-mono">{formatINR(results.packaging_cost_inr_per_kg * results.total_shipment_weight_kg)}</td>
              </tr>

              <tr className="bg-slate-50 font-semibold text-slate-900">
                <td className="py-2.5 px-4">Yarn Base Landed Cost</td>
                <td className="py-2.5 px-4 text-right font-mono">{formatINR(results.yarn_base_cost_inr_per_kg)}</td>
                <td className="py-2.5 px-4 text-right font-mono">{formatCurrencyByCode(results.yarn_base_cost_inr_per_kg / results.effective_fx_rate, input.currency_code, 4)}</td>
                <td className="py-2.5 px-4 text-right font-mono">{formatINR(results.yarn_base_cost_inr_per_kg * results.total_shipment_weight_kg)}</td>
              </tr>

              <tr>
                <td className="py-2.5 px-4 text-slate-600">Port THC & Customs Clearance Expense ({input.port_name})</td>
                <td className="py-2.5 px-4 text-right font-mono">{formatINR(results.port_expense_inr_per_kg)}</td>
                <td className="py-2.5 px-4 text-right font-mono">{formatCurrencyByCode(results.port_expense_inr_per_kg / results.effective_fx_rate, input.currency_code, 4)}</td>
                <td className="py-2.5 px-4 text-right font-mono">{formatINR(input.total_port_fob_expenses_inr)}</td>
              </tr>

              <tr>
                <td className="py-2.5 px-4 text-amber-800">Working Capital Interest ({input.credit_days} Credit Days)</td>
                <td className="py-2.5 px-4 text-right font-mono text-amber-800">{formatINR(results.interest_cost_inr_per_kg)}</td>
                <td className="py-2.5 px-4 text-right font-mono text-amber-800">{formatCurrencyByCode(results.interest_cost_inr_per_kg / results.effective_fx_rate, input.currency_code, 4)}</td>
                <td className="py-2.5 px-4 text-right font-mono text-amber-800">{formatINR(results.interest_cost_inr_per_kg * results.total_shipment_weight_kg)}</td>
              </tr>

              <tr className="bg-slate-50 font-semibold text-slate-900">
                <td className="py-2.5 px-4">Gross Cost before Export Incentives</td>
                <td className="py-2.5 px-4 text-right font-mono">{formatINR(results.gross_landed_cost_inr_per_kg)}</td>
                <td className="py-2.5 px-4 text-right font-mono">{formatCurrencyByCode(results.gross_landed_cost_inr_per_kg / results.effective_fx_rate, input.currency_code, 4)}</td>
                <td className="py-2.5 px-4 text-right font-mono">{formatINR(results.gross_landed_cost_inr_per_kg * results.total_shipment_weight_kg)}</td>
              </tr>

              <tr className="text-emerald-700 bg-emerald-50/40">
                <td className="py-2.5 px-4 font-semibold">Government Export Incentives (RoDTEP + Duty Drawback)</td>
                <td className="py-2.5 px-4 text-right font-mono font-bold">- {formatINR(results.incentive_amount_inr_per_kg)}</td>
                <td className="py-2.5 px-4 text-right font-mono font-bold">- {formatCurrencyByCode(results.incentive_amount_inr_per_kg / results.effective_fx_rate, input.currency_code, 4)}</td>
                <td className="py-2.5 px-4 text-right font-mono font-bold">- {formatINR(results.incentive_amount_inr_per_kg * results.total_shipment_weight_kg)}</td>
              </tr>

              <tr>
                <td className="py-2.5 px-4 text-slate-600">
                  Overseas Agent Commission ({input.commission_type === 'USD_PER_KG' ? `$${(input.commission_value ?? 0).toFixed(2)}/kg` : formatPercent(input.commission_value ?? input.agent_commission_pct)})
                </td>
                <td className="py-2.5 px-4 text-right font-mono">{formatINR(results.agent_commission_inr_per_kg)}</td>
                <td className="py-2.5 px-4 text-right font-mono">{formatCurrencyByCode(results.agent_commission_usd_per_kg, input.currency_code, 4)}</td>
                <td className="py-2.5 px-4 text-right font-mono">{formatUSD(results.agent_commission_usd_per_kg * results.total_shipment_weight_kg)}</td>
              </tr>

              <tr>
                <td className="py-2.5 px-4 text-slate-600">ECGC Export Credit Insurance ({formatPercent(input.ecgc_premium_pct)})</td>
                <td className="py-2.5 px-4 text-right font-mono">{formatINR(results.ecgc_amount_inr_per_kg)}</td>
                <td className="py-2.5 px-4 text-right font-mono">{formatCurrencyByCode(results.ecgc_amount_usd_per_kg, input.currency_code, 4)}</td>
                <td className="py-2.5 px-4 text-right font-mono">{formatUSD(results.ecgc_amount_usd_per_kg * results.total_shipment_weight_kg)}</td>
              </tr>

              <tr className="bg-indigo-50/60 font-bold text-indigo-950">
                <td className="py-3 px-4">Base Net FOB Cost</td>
                <td className="py-3 px-4 text-right font-mono">{formatINR(results.fob_cost_inr_per_kg)}</td>
                <td className="py-3 px-4 text-right font-mono">{formatCurrencyByCode(results.fob_cost_usd_per_kg, input.currency_code, 4)}</td>
                <td className="py-3 px-4 text-right font-mono">{formatUSD(results.fob_cost_usd_per_kg * results.total_shipment_weight_kg)}</td>
              </tr>

              {isAdmin && (
                <tr className="text-emerald-800 font-semibold bg-emerald-50/30">
                  <td className="py-2.5 px-4">margin({formatPercent(input.trader_margin_pct)})</td>
                  <td className="py-2.5 px-4 text-right font-mono">{formatINR(results.trader_margin_inr_per_kg)}</td>
                  <td className="py-2.5 px-4 text-right font-mono">{formatCurrencyByCode(results.trader_margin_usd_per_kg, input.currency_code, 4)}</td>
                  <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-700">{formatUSD(results.total_net_profit_usd)}</td>
                </tr>
              )}

              <tr className="bg-indigo-100/70 font-extrabold text-indigo-900 border-t border-indigo-200">
                <td className="py-3 px-4">Selling FOB Price</td>
                <td className="py-3 px-4 text-right font-mono">{formatINR(results.selling_fob_price_inr_per_kg)}</td>
                <td className="py-3 px-4 text-right font-mono">{formatCurrencyByCode(results.selling_fob_price_usd_per_kg, input.currency_code, 4)}</td>
                <td className="py-3 px-4 text-right font-mono">{formatUSD(results.total_fob_revenue_usd)}</td>
              </tr>

              <tr>
                <td className="py-2.5 px-4 text-slate-600">Ocean Freight ({input.container_type})</td>
                <td className="py-2.5 px-4 text-right font-mono">{formatINR(results.ocean_freight_inr_per_kg)}</td>
                <td className="py-2.5 px-4 text-right font-mono">{formatCurrencyByCode(results.ocean_freight_usd_per_kg, input.currency_code, 4)}</td>
                <td className="py-2.5 px-4 text-right font-mono">{formatUSD(input.ocean_freight_usd)}</td>
              </tr>

              <tr>
                <td className="py-2.5 px-4 text-slate-600">Marine Transit Insurance ({formatPercent(input.marine_insurance_pct)} on 110% CIF)</td>
                <td className="py-2.5 px-4 text-right font-mono">{formatINR(results.insurance_inr_per_kg)}</td>
                <td className="py-2.5 px-4 text-right font-mono">{formatCurrencyByCode(results.insurance_usd_per_kg, input.currency_code, 4)}</td>
                <td className="py-2.5 px-4 text-right font-mono">{formatUSD(results.insurance_usd_per_kg * results.total_shipment_weight_kg)}</td>
              </tr>

              <tr className="bg-slate-900 text-white font-extrabold border-t-2 border-slate-900">
                <td className="py-3.5 px-4 text-sm text-indigo-300">TOTAL FINAL CIF QUOTE PRICE</td>
                <td className="py-3.5 px-4 text-right font-mono text-sm">{formatINR(results.cif_price_inr_per_kg)}</td>
                <td className="py-3.5 px-4 text-right font-mono text-base text-emerald-400">{formatCurrencyByCode(results.cif_price_usd_per_kg, input.currency_code, 4)}</td>
                <td className="py-3.5 px-4 text-right font-mono text-base text-white">{formatUSD(results.total_cif_revenue_usd)}</td>
              </tr>

            </tbody>
          </table>
        </div>
      </div>

      {/* Break-Even & Exchange Rate Sensitivity Analysis Table */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Break-Even Thresholds Card */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
          <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
            <Scale className="w-5 h-5 text-indigo-600" />
            <h3 className="font-bold text-slate-900 text-sm">Break-Even Threshold Analysis</h3>
          </div>

          <div className="space-y-3">
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-xs text-slate-500 font-medium">Max Allowed Ex-Mill Purchase Price</span>
              <div className="text-lg font-bold font-mono text-slate-900">
                {formatINR(results.breakeven_ex_mill_inr_per_kg)} / kg
              </div>
              <p className="text-[11px] text-slate-400">
                Maximum mill price allowed to maintain target profit at current quote.
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="text-xs text-slate-500 font-medium">Zero-Profit Break-Even CIF Selling Price</span>
              <div className="text-lg font-bold font-mono text-amber-700">
                {formatCurrencyByCode(results.breakeven_cif_usd_per_kg, input.currency_code, 4)} / kg
              </div>
              <p className="text-[11px] text-slate-400">
                Absolute floor selling price needed to cover all landed costs without loss.
              </p>
            </div>
          </div>
        </div>

        {/* FX Sensitivity Matrix Table */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center space-x-2">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              <h3 className="font-bold text-slate-900 text-sm">FX Shift Sensitivity Matrix (+/- 2 INR)</h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">RPC Calculated</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 font-semibold text-slate-700 border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3">FX Shift</th>
                  <th className="py-2 px-3">Rate</th>
                  <th className="py-2 px-3 text-right">CIF Price ({input.currency_code})</th>
                  <th className="py-2 px-3 text-right">Net Profit (USD)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {results.fx_sensitivity?.map((item) => (
                  <tr key={item.rate_shift} className={item.rate_shift === 0 ? 'bg-indigo-50/80 font-bold text-indigo-900' : 'hover:bg-slate-50'}>
                    <td className="py-2 px-3">
                      {item.rate_shift > 0 ? `+${item.rate_shift} INR` : `${item.rate_shift} INR`}
                      {item.rate_shift === 0 && ' (Current)'}
                    </td>
                    <td className="py-2 px-3">{formatINR(item.fx_rate)}</td>
                    <td className="py-2 px-3 text-right">{formatCurrencyByCode(item.cif_price_usd, input.currency_code, 4)}</td>
                    <td className={`py-2 px-3 text-right ${item.net_profit_usd >= 0 ? 'text-emerald-600 font-bold' : 'text-rose-600 font-bold'}`}>
                      {formatUSD(item.net_profit_usd, 2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  );
};
