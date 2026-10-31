import React, { useState } from 'react';
import { Layers, CheckCircle, Save, RefreshCw, Anchor, Container, Percent, DollarSign, Edit3, Plus } from 'lucide-react';
import { ContainerConfigMaster, FinancialParamsMaster, FxRateMaster, PortLogisticsMaster, YarnCountMaster } from '../types';
import { formatINR, formatPercent } from '../utils/formatters';

interface MasterDataDrawerProps {
  yarnCounts: YarnCountMaster[];
  containerConfigs: ContainerConfigMaster[];
  portLogistics: PortLogisticsMaster[];
  financialParams: FinancialParamsMaster[];
  fxRates: FxRateMaster[];
  onUpdateMasterRecord: (table: string, record: any) => Promise<void>;
  onRefreshFx: () => Promise<void>;
  isRefreshingFx: boolean;
}

export const MasterDataDrawer: React.FC<MasterDataDrawerProps> = ({
  yarnCounts,
  containerConfigs,
  portLogistics,
  financialParams,
  fxRates,
  onUpdateMasterRecord,
  onRefreshFx,
  isRefreshingFx,
}) => {
  const [activeSection, setActiveSection] = useState<'counts' | 'containers' | 'ports' | 'financial' | 'fx'>('counts');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const handleStartEdit = (id: string, record: any) => {
    setEditingId(id);
    setEditForm({ ...record });
  };

  const handleSave = async (table: string) => {
    setIsSaving(true);
    try {
      await onUpdateMasterRecord(table, editForm);
      setEditingId(null);
      setSuccessMsg('Master data updated successfully in database via RPC.');
      setTimeout(() => setSuccessMsg(''), 3000);
    } catch (err) {
      console.error('Failed to update master data:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-slate-50 min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Title & Navigation Tabs */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between pb-4 border-b border-slate-100 gap-4">
            <div>
              <div className="flex items-center space-x-2">
                <Layers className="w-6 h-6 text-indigo-600" />
                <h2 className="text-xl font-bold text-slate-900">Master Data Administration</h2>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Product-Aware Master Data Tables • Product Scope: <span className="font-semibold text-slate-700">COTTON_YARN</span>
              </p>
            </div>

            {successMsg && (
              <div className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-200">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span>{successMsg}</span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 mt-4">
            <button
              id="md-tab-counts"
              onClick={() => setActiveSection('counts')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeSection === 'counts'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Percent className="w-4 h-4" />
              <span>Yarn Counts Master ({yarnCounts.length})</span>
            </button>

            <button
              id="md-tab-containers"
              onClick={() => setActiveSection('containers')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeSection === 'containers'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Container className="w-4 h-4" />
              <span>Container Configs ({containerConfigs.length})</span>
            </button>

            <button
              id="md-tab-ports"
              onClick={() => setActiveSection('ports')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeSection === 'ports'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Anchor className="w-4 h-4" />
              <span>Port & THC Logistics ({portLogistics.length})</span>
            </button>

            <button
              id="md-tab-financial"
              onClick={() => setActiveSection('financial')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeSection === 'financial'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Percent className="w-4 h-4" />
              <span>Financial Defaults</span>
            </button>

            <button
              id="md-tab-fx"
              onClick={() => setActiveSection('fx')}
              className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeSection === 'fx'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <DollarSign className="w-4 h-4" />
              <span>FX Rates & Buffers</span>
            </button>
          </div>
        </div>

        {/* Section 1: Yarn Counts Master */}
        {activeSection === 'counts' && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900">Cotton Yarn Counts & Standard Export Rebate Rates</h3>
              <span className="text-xs text-slate-500">Table: <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono">yarn_counts_master</code></span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Count Name</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">End Purpose</th>
                    <th className="py-3 px-4">Std Bag Weight (kg)</th>
                    <th className="py-3 px-4">RoDTEP Rebate %</th>
                    <th className="py-3 px-4">Duty Drawback %</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {yarnCounts.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4 font-bold text-slate-900">{item.count_name}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[11px] bg-slate-100 text-slate-700 font-semibold">
                          {item.yarn_type}
                        </span>
                      </td>
                      <td className="py-3 px-4">{item.purpose}</td>
                      <td className="py-3 px-4 font-mono">{item.standard_bag_weight_kg} kg</td>
                      <td className="py-3 px-4 font-mono text-emerald-600 font-semibold">{formatPercent(item.rodtep_rate_pct)}</td>
                      <td className="py-3 px-4 font-mono text-blue-600 font-semibold">{formatPercent(item.drawback_rate_pct)}</td>
                      <td className="py-3 px-4 text-right">
                        {editingId === item.id ? (
                          <button
                            id={`save-count-${item.id}`}
                            onClick={() => handleSave('yarn_counts_master')}
                            disabled={isSaving}
                            className="inline-flex items-center space-x-1 px-3 py-1 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>Save</span>
                          </button>
                        ) : (
                          <button
                            id={`edit-count-${item.id}`}
                            onClick={() => handleStartEdit(item.id, item)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg text-xs"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>Edit</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Section 2: Container Configs Master */}
        {activeSection === 'containers' && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900">Container Types & Export Net Capacity Master</h3>
              <span className="text-xs text-slate-500">Table: <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono">container_configs_master</code></span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {containerConfigs.map((item) => (
                <div key={item.id} className="border border-slate-200 rounded-xl p-5 hover:border-indigo-300 transition-all bg-slate-50/50">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-3">
                    <div className="flex items-center space-x-2">
                      <Container className="w-5 h-5 text-indigo-600" />
                      <h4 className="font-bold text-slate-900">{item.display_name}</h4>
                    </div>
                    <span className="text-xs font-mono font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded">
                      {item.container_type}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 block">Max Net Weight Capacity</span>
                      <span className="text-slate-900 font-mono font-bold text-sm">{item.max_capacity_kg.toLocaleString()} kg</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Bags / Cartons Load</span>
                      <span className="text-slate-900 font-mono font-bold text-sm">{item.bags_count} units</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section 3: Port & Logistics Charges Master */}
        {activeSection === 'ports' && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900">Port Terminal Handling (THC) & Clearance Master</h3>
              <span className="text-xs text-slate-500">Table: <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono">port_logistics_master</code></span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-600">
                <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Port Name</th>
                    <th className="py-3 px-4">THC (INR)</th>
                    <th className="py-3 px-4">CHA Clearance</th>
                    <th className="py-3 px-4">Docs & BL</th>
                    <th className="py-3 px-4">Inspection</th>
                    <th className="py-3 px-4">Inland Transport</th>
                    <th className="py-3 px-4 font-bold text-slate-900">Total Port FOB Expense</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {portLogistics.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4 font-bold text-slate-900">{item.port_name}</td>
                      <td className="py-3 px-4 font-mono">{formatINR(item.thc_charge_inr)}</td>
                      <td className="py-3 px-4 font-mono">{formatINR(item.cha_clearance_inr)}</td>
                      <td className="py-3 px-4 font-mono">{formatINR(item.doc_bl_fee_inr)}</td>
                      <td className="py-3 px-4 font-mono">{formatINR(item.inspection_fee_inr)}</td>
                      <td className="py-3 px-4 font-mono">{formatINR(item.inland_freight_inr)}</td>
                      <td className="py-3 px-4 font-mono font-bold text-indigo-600">
                        {formatINR(item.thc_charge_inr + item.cha_clearance_inr + item.doc_bl_fee_inr + item.inspection_fee_inr + item.inland_freight_inr + item.other_fob_charges_inr)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Section 4: Financial Defaults */}
        {activeSection === 'financial' && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-bold text-slate-900">Financial Interest & Export Default Rates</h3>
              <span className="text-xs text-slate-500">Table: <code className="bg-slate-100 px-1.5 py-0.5 rounded font-mono">financial_params_master</code></span>
            </div>
            {financialParams.map((item) => (
              <div key={item.id} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-xs text-slate-500 font-medium">Packing Credit Interest % p.a.</span>
                  <div className="text-lg font-bold text-slate-900 font-mono mt-1">{formatPercent(item.packing_credit_interest_pct_pa)}</div>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-xs text-slate-500 font-medium">ECGC Premium Rate %</span>
                  <div className="text-lg font-bold text-slate-900 font-mono mt-1">{formatPercent(item.ecgc_premium_pct)}</div>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-xs text-slate-500 font-medium">Default Overseas Agent Comm %</span>
                  <div className="text-lg font-bold text-slate-900 font-mono mt-1">{formatPercent(item.agent_commission_pct)}</div>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-xs text-slate-500 font-medium">Target Trader Profit Margin %</span>
                  <div className="text-lg font-bold text-slate-900 font-mono mt-1">{formatPercent(item.trader_margin_pct)}</div>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                  <span className="text-xs text-slate-500 font-medium">Marine Insurance Rate %</span>
                  <div className="text-lg font-bold text-slate-900 font-mono mt-1">{formatPercent(item.insurance_rate_pct)}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Section 5: FX Rates & Buffers */}
        {activeSection === 'fx' && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Exchange Rates & Bank Margin Buffers</h3>
                <p className="text-xs text-slate-500">Live sync via FX rate providers (open.er-api / Frankfurter)</p>
              </div>
              <button
                id="btn-refresh-fx-master"
                onClick={onRefreshFx}
                disabled={isRefreshingFx}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingFx ? 'animate-spin' : ''}`} />
                <span>Sync Live FX Rates</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {fxRates.map((fx) => (
                <div key={fx.currency_pair} className="border border-slate-200 rounded-xl p-5 bg-slate-50/50">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-3 mb-3">
                    <span className="font-bold text-slate-900">{fx.currency_pair} Exchange Rate</span>
                    <span className="text-[11px] text-slate-400 font-mono">Updated: {new Date(fx.last_updated_at).toLocaleTimeString()}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-slate-400 block">Spot Rate</span>
                      <span className="text-slate-900 font-mono font-bold text-sm">{formatINR(fx.rate)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">FX Buffer Margin</span>
                      <span className="text-amber-600 font-mono font-bold text-sm">- {formatINR(fx.fx_buffer_margin)}</span>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Effective Rate</span>
                      <span className="text-emerald-600 font-mono font-bold text-sm">{formatINR(fx.effective_rate)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
