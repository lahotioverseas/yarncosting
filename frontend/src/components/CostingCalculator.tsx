import React from 'react';
import { ContainerConfigMaster, CostingInput, FxRateMaster, PortLogisticsMaster, YarnCountMaster } from '../types';
import { Package, Container, Anchor, Percent, DollarSign, RefreshCw, Sliders, ChevronRight, ChevronDown } from 'lucide-react';
import { formatINR, formatPercent } from '../utils/formatters';

interface CostingCalculatorProps {
  inputState: CostingInput;
  yarnCounts: YarnCountMaster[];
  containerConfigs: ContainerConfigMaster[];
  portLogistics: PortLogisticsMaster[];
  fxRates: FxRateMaster[];
  onInputChange: (field: keyof CostingInput, value: any) => void;
  onSelectYarnCount: (countId: string) => void;
  onSelectPort: (portId: string) => void;
  onSelectContainer: (containerType: '20FT_FCL' | '40FT_HC') => void;
  onRefreshFx: () => void;
  isRefreshingFx: boolean;
}

export const CostingCalculator: React.FC<CostingCalculatorProps> = ({
  inputState,
  yarnCounts,
  containerConfigs,
  portLogistics,
  fxRates,
  onInputChange,
  onSelectYarnCount,
  onSelectPort,
  onSelectContainer,
  onRefreshFx,
  isRefreshingFx,
}) => {
  return (
    <div id="costing-calculator-form" className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-6">
      
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
            <Sliders className="w-5 h-5 text-indigo-600" />
            <span>Cotton Yarn Costing Parameters</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Modify inputs to re-calculate via Postgres PL/pgSQL function backend.
          </p>
        </div>

        <div className="flex items-center space-x-2 bg-indigo-50 text-indigo-700 px-3 py-1 rounded-full text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-indigo-600 animate-ping"></span>
          <span>RPC Auto-Sync Active</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

        {/* Section 1: Yarn Purchase & Count */}
        <div className="space-y-4 bg-slate-50/60 p-4 rounded-xl border border-slate-200/80">
          <div className="flex items-center space-x-2 text-indigo-900 font-bold text-xs uppercase tracking-wider border-b border-slate-200 pb-2">
            <Package className="w-4 h-4 text-indigo-600" />
            <span>1. Yarn Purchase & Specification</span>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 block">Yarn Count Specification</label>
            <select
              id="input-yarn-count-id"
              value={inputState.yarn_count_id}
              onChange={(e) => onSelectYarnCount(e.target.value)}
              className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              {yarnCounts.map((count) => (
                <option key={count.id} value={count.id}>
                  {count.count_name} ({count.yarn_type})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 block">Ex-Mill Price (INR / kg)</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">₹</span>
              <input
                id="input-ex-mill-price"
                type="number"
                step="0.50"
                min="0"
                value={inputState.ex_mill_price_inr_per_kg}
                onChange={(e) => onInputChange('ex_mill_price_inr_per_kg', Number(e.target.value))}
                className="w-full text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg py-2 pl-7 pr-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 block">Mill Freight to Port (INR / kg)</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">₹</span>
              <input
                id="input-mill-freight"
                type="number"
                step="0.10"
                min="0"
                value={inputState.mill_freight_inr_per_kg}
                onChange={(e) => onInputChange('mill_freight_inr_per_kg', Number(e.target.value))}
                className="w-full text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg py-2 pl-7 pr-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 block">Packaging Cost (INR / kg)</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">₹</span>
              <input
                id="input-packaging-cost"
                type="number"
                step="0.10"
                min="0"
                value={inputState.packaging_cost_inr_per_kg}
                onChange={(e) => onInputChange('packaging_cost_inr_per_kg', Number(e.target.value))}
                className="w-full text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg py-2 pl-7 pr-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 2: Container & Logistics */}
        <div className="space-y-4 bg-slate-50/60 p-4 rounded-xl border border-slate-200/80">
          <div className="flex items-center space-x-2 text-indigo-900 font-bold text-xs uppercase tracking-wider border-b border-slate-200 pb-2">
            <Container className="w-4 h-4 text-indigo-600" />
            <span>2. Container & Port THC</span>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 block">Container Load Capacity</label>
            <select
              id="input-container-type"
              value={inputState.container_type}
              onChange={(e) => onSelectContainer(e.target.value as any)}
              className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              {containerConfigs.map((cc) => (
                <option key={cc.id} value={cc.container_type}>
                  {cc.display_name} ({cc.max_capacity_kg.toLocaleString()} kg)
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 block">Export Loading Port</label>
            <select
              id="input-port-id"
              value={inputState.port_id}
              onChange={(e) => onSelectPort(e.target.value)}
              className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            >
              {portLogistics.map((port) => (
                <option key={port.id} value={port.id}>
                  {port.port_name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 block">Total Port THC & Clearance (INR)</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">₹</span>
              <input
                id="input-port-fob-expenses"
                type="number"
                step="500"
                min="0"
                value={inputState.total_port_fob_expenses_inr}
                onChange={(e) => onInputChange('total_port_fob_expenses_inr', Number(e.target.value))}
                className="w-full text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg py-2 pl-7 pr-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 block">Ocean Freight (USD / Container)</label>
            <div className="relative">
              <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-bold">$</span>
              <input
                id="input-ocean-freight"
                type="number"
                step="50"
                min="0"
                value={inputState.ocean_freight_usd}
                onChange={(e) => onInputChange('ocean_freight_usd', Number(e.target.value))}
                className="w-full text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg py-2 pl-7 pr-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 3: Finance, Margin & Export Rebates */}
        <div className="space-y-4 bg-slate-50/60 p-4 rounded-xl border border-slate-200/80">
          <div className="flex items-center space-x-2 text-indigo-900 font-bold text-xs uppercase tracking-wider border-b border-slate-200 pb-2">
            <Percent className="w-4 h-4 text-indigo-600" />
            <span>3. Finance, Margin & Rebates</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 block">Credit Days</label>
              <select
                id="input-credit-days"
                value={inputState.credit_days}
                onChange={(e) => onInputChange('credit_days', Number(e.target.value))}
                className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value={0}>0 Days (Site / Advance)</option>
                <option value={30}>30 Days Credit</option>
                <option value={60}>60 Days Credit</option>
                <option value={90}>90 Days Credit</option>
                <option value={120}>120 Days Credit</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 block">Interest % p.a.</label>
              <input
                id="input-interest-pct"
                type="number"
                step="0.25"
                min="0"
                value={inputState.packing_credit_interest_pct_pa}
                onChange={(e) => onInputChange('packing_credit_interest_pct_pa', Number(e.target.value))}
                className="w-full text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 block">Commission</label>
              <div className="relative flex items-center">
                <input
                  id="input-agent-comm-pct"
                  type="number"
                  step="any"
                  min="0"
                  value={inputState.commission_value ?? inputState.agent_commission_pct}
                  onChange={(e) => {
                    const val = e.target.value === '' ? 0 : Number(e.target.value);
                    onInputChange('commission_value', isNaN(val) ? 0 : val);
                    if (inputState.commission_type !== 'USD_PER_KG') {
                      onInputChange('agent_commission_pct', isNaN(val) ? 0 : val);
                    }
                  }}
                  className="w-full text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none pr-12 text-right"
                />
                <div className="absolute inset-y-0 right-0 pr-1 flex items-center">
                  <div className="relative inline-flex items-center">
                    <select
                      value={inputState.commission_type || 'PCT'}
                      onChange={(e) => onInputChange('commission_type', e.target.value)}
                      className="appearance-none bg-transparent hover:bg-slate-100 text-slate-600 hover:text-indigo-600 rounded pl-1.5 pr-4 py-0.5 text-xs font-bold font-mono focus:outline-none cursor-pointer transition-colors"
                      title="Click to switch unit (% or $/kg)"
                    >
                      <option value="PCT">%</option>
                      <option value="USD_PER_KG">$/kg</option>
                    </select>
                    <ChevronDown className="w-3 h-3 text-slate-400 pointer-events-none absolute right-0.5" />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 block">Trader Margin %</label>
              <input
                id="input-trader-margin-pct"
                type="number"
                step="0.25"
                min="0"
                value={inputState.trader_margin_pct}
                onChange={(e) => onInputChange('trader_margin_pct', Number(e.target.value))}
                className="w-full text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 block">RoDTEP Rebate %</label>
              <input
                id="input-rodtep-pct"
                type="number"
                step="0.10"
                min="0"
                value={inputState.rodtep_rebate_pct}
                onChange={(e) => onInputChange('rodtep_rebate_pct', Number(e.target.value))}
                className="w-full text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 block">Drawback Rebate %</label>
              <input
                id="input-drawback-pct"
                type="number"
                step="0.10"
                min="0"
                value={inputState.duty_drawback_pct}
                onChange={(e) => onInputChange('duty_drawback_pct', Number(e.target.value))}
                className="w-full text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>
        </div>

        {/* Section 4: FX Currency & Customer Header */}
        <div className="space-y-4 bg-slate-50/60 p-4 rounded-xl border border-slate-200/80">
          <div className="flex items-center space-x-2 text-indigo-900 font-bold text-xs uppercase tracking-wider border-b border-slate-200 pb-2">
            <DollarSign className="w-4 h-4 text-indigo-600" />
            <span>4. FX Currency & Customer</span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 block">Quote Currency</label>
              <select
                id="input-currency-code"
                value={inputState.currency_code}
                onChange={(e) => onInputChange('currency_code', e.target.value)}
                className="w-full text-xs font-semibold bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 block">Base FX Rate</label>
              <input
                id="input-base-fx-rate"
                type="number"
                step="0.10"
                min="1"
                value={inputState.base_fx_rate}
                onChange={(e) => onInputChange('base_fx_rate', Number(e.target.value))}
                className="w-full text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 block">FX Safety Buffer (INR)</label>
            <input
              id="input-fx-margin-buffer"
              type="number"
              step="0.10"
              min="0"
              value={inputState.fx_margin_buffer_inr}
              onChange={(e) => onInputChange('fx_margin_buffer_inr', Number(e.target.value))}
              className="w-full text-xs font-mono font-bold bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-semibold text-slate-700 block">Buyer / Customer Name</label>
            <input
              id="input-customer-name"
              type="text"
              placeholder="e.g. Shanghai Textile Trading"
              value={inputState.customer_name || ''}
              onChange={(e) => onInputChange('customer_name', e.target.value)}
              className="w-full text-xs bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
            />
          </div>
        </div>

      </div>

    </div>
  );
};
