import React from 'react';
import { CostingCalculationResult, CostingInput } from '../types';
import { Printer, X, CheckCircle, ShieldCheck, Package, MapPin, Calendar, FileText } from 'lucide-react';
import { formatCurrencyByCode, formatDate, formatINR, formatPercent, formatUSD, formatWeight } from '../utils/formatters';
import { lahotiOverseasLogo } from '../image/logo';

interface PrintQuoteModalProps {
  input: CostingInput;
  results: CostingCalculationResult;
  quoteNumber?: string;
  onClose: () => void;
}

export const PrintQuoteModal: React.FC<PrintQuoteModalProps> = ({
  input,
  results,
  quoteNumber = `QT-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
  onClose,
}) => {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      
      <div className="bg-white rounded-2xl max-w-4xl w-full shadow-2xl border border-slate-200 overflow-hidden my-8">
        
        {/* Top Modal Controls (Hidden in Print) */}
        <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 print:hidden">
          <div className="flex items-center space-x-2">
            <FileText className="w-5 h-5 text-indigo-400" />
            <h3 className="font-bold text-sm">Cotton Yarn Export Commercial Quotation</h3>
          </div>

          <div className="flex items-center space-x-3">
            <button
              id="btn-print-now"
              onClick={handlePrint}
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg shadow-sm"
            >
              <Printer className="w-4 h-4" />
              <span>Print / Download PDF</span>
            </button>

            <button
              id="btn-close-print-modal"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Commercial Printable Sheet */}
        <div id="printable-quote-document" className="p-8 sm:p-12 space-y-8 text-slate-800">
          
          {/* Letterhead */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b-2 border-slate-900 pb-6 gap-4">
            <div className="flex items-center space-x-4">
              <img
                src={lahotiOverseasLogo}
                alt="Lahoti Overseas"
                className="h-16 w-auto max-w-[140px] object-contain"
                referrerPolicy="no-referrer"
              />
              <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-900 uppercase">
                  Lahoti Overseas Limited
                </h1>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Cotton Yarn Export Merchant & Global Trading Division
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Regd Office: Export Tower, Financial Hub • GSTIN / IEC Certified
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right border-l-2 sm:border-l-0 sm:border-r-2 border-indigo-600 pl-4 sm:pl-0 sm:pr-4">
              <span className="text-xs uppercase font-bold text-indigo-600 tracking-wider">Export Proforma Offer</span>
              <div className="text-lg font-mono font-bold text-slate-900 mt-0.5">{quoteNumber}</div>
              <div className="text-xs text-slate-500 flex items-center sm:justify-end space-x-1 mt-1">
                <Calendar className="w-3 h-3 text-slate-400" />
                <span>Date: {formatDate(new Date().toISOString())}</span>
              </div>
            </div>
          </div>

          {/* Customer & Destination Header Info */}
          <div className="grid grid-cols-2 gap-6 bg-slate-50 p-5 rounded-xl border border-slate-200 text-xs">
            <div>
              <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block">Customer Details</span>
              <div className="text-sm font-bold text-slate-900 mt-1">{input.customer_name || 'Valued Buyer'}</div>
              <div className="text-slate-600 mt-0.5">{input.destination_country || 'Global Destination'}</div>
            </div>

            <div>
              <span className="text-slate-400 font-bold uppercase tracking-wider text-[10px] block">Shipment & Port Terms</span>
              <div className="text-sm font-bold text-slate-900 mt-1">Port: {input.port_name}</div>
              <div className="text-slate-600 mt-0.5">Container: {input.container_type} ({formatWeight(results.total_shipment_weight_kg)})</div>
            </div>
          </div>

          {/* Product Specification Table */}
          <div className="space-y-3">
            <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900 border-b border-slate-200 pb-1">
              Export Yarn Specification & Commercial Price
            </h4>

            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 uppercase">
                <tr>
                  <th className="py-2.5 px-3">Item / Description</th>
                  <th className="py-2.5 px-3">Quality</th>
                  <th className="py-2.5 px-3">Net Weight</th>
                  <th className="py-2.5 px-3 text-right">Unit Price ({input.currency_code}/kg)</th>
                  <th className="py-2.5 px-3 text-right">Total CIF Value ({input.currency_code})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 font-medium">
                <tr>
                  <td className="py-3 px-3 font-bold text-slate-900">
                    100% Cotton Yarn - {input.yarn_count_name}
                  </td>
                  <td className="py-3 px-3">Export Quality Cones</td>
                  <td className="py-3 px-3 font-mono">{formatWeight(results.total_shipment_weight_kg)}</td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-indigo-700">
                    {formatCurrencyByCode(results.cif_price_usd_per_kg, input.currency_code, 4)}
                  </td>
                  <td className="py-3 px-3 text-right font-mono font-bold text-slate-900">
                    {formatUSD(results.total_cif_revenue_usd)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Price Component Breakdown */}
          <div className="bg-slate-50/70 p-5 rounded-xl border border-slate-200 text-xs space-y-2">
            <h4 className="font-bold text-slate-900">Cost Structure Summary (PL/pgSQL RPC Computed)</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-slate-600 font-mono">
              <div>
                <span className="text-[10px] text-slate-400 block">Selling FOB / kg</span>
                <span className="font-bold text-slate-800">{formatCurrencyByCode(results.selling_fob_price_usd_per_kg, input.currency_code, 4)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Ocean Freight / kg</span>
                <span className="font-bold text-slate-800">{formatUSD(results.ocean_freight_usd_per_kg)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Marine Ins / kg</span>
                <span className="font-bold text-slate-800">{formatUSD(results.insurance_usd_per_kg)}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-400 block">Effective FX Rate</span>
                <span className="font-bold text-emerald-700">{formatINR(results.effective_fx_rate)}</span>
              </div>
            </div>
          </div>

          {/* Commercial Terms & Conditions */}
          <div className="space-y-2 text-xs text-slate-600 pt-2 border-t border-slate-200">
            <h5 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">Commercial Terms & Conditions</h5>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-500">
              <li>Payment Terms: Irrevocable Letter of Credit (LC) at {input.credit_days} days or Advance TT.</li>
              <li>Price Basis: CIF Price includes Ocean Freight and Marine Transit Insurance (110% value).</li>
              <li>Tolerance: +/- 5% in quantity and weight as per international yarn export standards.</li>
              <li>Validity: Quote valid for 7 days from issue date subject to exchange rate stability.</li>
            </ul>
          </div>

          {/* Signatures */}
          <div className="pt-8 flex justify-between items-end text-xs">
            <div>
              <p className="text-slate-400">Prepared By: Senior Export Specialist</p>
              <p className="font-bold text-slate-900 mt-1">Yarn Trading Division</p>
            </div>
            <div className="text-right">
              <div className="w-40 border-b border-slate-900 mb-1"></div>
              <p className="font-bold text-slate-900">Authorized Export Signatory</p>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
};
