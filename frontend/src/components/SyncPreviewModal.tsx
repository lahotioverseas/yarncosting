import React from 'react';
import { RefreshCw, AlertTriangle, ArrowRight, X, CheckCircle2 } from 'lucide-react';

export interface PriceDiffChange {
  category: string;
  name: string;
  oldPrice: number | null;
  newPrice: number | null;
  diffPct: number;
}

interface SyncPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmPublish: () => void;
  isPublishing: boolean;
  count: number;
  changes: PriceDiffChange[];
  hasLargeDiff: boolean;
  message: string;
}

export const SyncPreviewModal: React.FC<SyncPreviewModalProps> = ({
  isOpen,
  onClose,
  onConfirmPublish,
  isPublishing,
  count,
  changes,
  hasLargeDiff,
  message,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs p-3 sm:p-4 flex items-center justify-center">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xl w-full overflow-hidden font-sans flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg border border-indigo-400/30">
              <RefreshCw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-tight">Sync &amp; Publish Preview</h2>
              <p className="text-xs text-slate-400">{message || `${count} price changes detected`}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {hasLargeDiff && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-bold block text-amber-950">Large Price Deviations Detected</span>
                <p className="mt-0.5">Some items have price changes exceeding standard thresholds (&gt;10%). Please review carefully before publishing.</p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Detected Updates ({changes.length})</h3>
            {changes.length === 0 ? (
              <p className="text-xs text-slate-500 italic py-4 text-center bg-slate-50 rounded-xl border border-slate-200">
                No differences found between current sheet and live master. Rates are already up to date.
              </p>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200 sticky top-0">
                    <tr>
                      <th className="p-2.5">Category / Item</th>
                      <th className="p-2.5 text-right">Old Price</th>
                      <th className="p-2.5 text-right">New Price</th>
                      <th className="p-2.5 text-right">Change</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono">
                    {changes.map((c, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="p-2.5 font-sans">
                          <span className="font-bold text-slate-900 block">{c.name}</span>
                          <span className="text-[10px] text-slate-500">{c.category}</span>
                        </td>
                        <td className="p-2.5 text-right text-slate-600">
                          {c.oldPrice !== null ? `₹${c.oldPrice.toLocaleString()}` : '—'}
                        </td>
                        <td className="p-2.5 text-right font-bold text-indigo-700">
                          {c.newPrice !== null ? `₹${c.newPrice.toLocaleString()}` : '—'}
                        </td>
                        <td className="p-2.5 text-right">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            (c.diffPct || 0) > 0 ? 'bg-emerald-100 text-emerald-800' : (c.diffPct || 0) < 0 ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-650'
                          }`}>
                            {(c.diffPct || 0) > 0 ? `+${Number(c.diffPct || 0).toFixed(1)}%` : `${Number(c.diffPct || 0).toFixed(1)}%`}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-end space-x-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-semibold cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirmPublish}
            disabled={isPublishing}
            className="inline-flex items-center space-x-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{isPublishing ? 'Publishing...' : 'Confirm & Publish Today\'s Prices'}</span>
          </button>
        </div>

      </div>
    </div>
  );
};
