import React, { useState, useMemo } from 'react';
import {
  Search,
  Plus,
  Filter,
  Trash2,
} from 'lucide-react';
import { SpreadsheetRow } from '../types';

interface YarnMatrixEditorProps {
  rows: SpreadsheetRow[];
  onChange: (
    category: string,
    yarnCount: string,
    quality: string,
    field: 'exMillPrice' | 'factoryLocation',
    value: any
  ) => void;
  onAddCount?: (category: string, newCount: string) => void;
  onDeleteCount?: (category: string, yarnCount: string) => void;
  searchQuery?: string;
  hasUnsavedChanges?: boolean;
}

// Section definitions based on the client's Google Sheet matrix
interface MatrixCategoryConfig {
  id: string;
  displayName: string;
  badge: string;
  badgeColor: string;
  qualities: Array<{
    id: string;
    label: string;
    description: string;
    headerColor: string;
  }>;
}

const MATRIX_CATEGORIES: MatrixCategoryConfig[] = [
  {
    id: 'KNITTING YARNS',
    displayName: 'KNITTING YARNS',
    badge: 'Knitting',
    badgeColor: 'bg-blue-100 text-blue-800 border-blue-200',
    qualities: [
      { id: 'KH', label: 'KH', description: 'Karded Hosiery', headerColor: 'bg-blue-50 text-blue-900' },
      { id: 'CH', label: 'CH', description: 'Combed Hosiery', headerColor: 'bg-indigo-50 text-indigo-900' },
      { id: 'CCH', label: 'CCH', description: 'Compact Combed Hosiery', headerColor: 'bg-violet-50 text-violet-900' },
    ],
  },
  {
    id: 'WAEVING YARNS',
    displayName: 'WAEVING YARNS',
    badge: 'Weaving',
    badgeColor: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    qualities: [
      { id: 'KW', label: 'KW', description: 'Karded Weaving', headerColor: 'bg-emerald-50 text-emerald-900' },
      { id: 'KCW', label: 'KCW', description: 'Karded Combed Weaving', headerColor: 'bg-teal-50 text-teal-900' },
      { id: 'CCW', label: 'CCW', description: 'Compact Combed Weaving', headerColor: 'bg-cyan-50 text-cyan-900' },
    ],
  },
  {
    id: 'DOUBLE YARNS',
    displayName: 'DOUBLE YARNS',
    badge: '2-Ply Doubled',
    badgeColor: 'bg-amber-100 text-amber-800 border-amber-200',
    qualities: [
      { id: 'KW/KH SOFT TWIST', label: 'KW/KH SOFT TWIST', description: 'Soft Twist 2-Ply', headerColor: 'bg-amber-50 text-amber-900' },
      { id: 'KW HARD TWIST', label: 'KW HARD TWIST', description: 'Hard Twist 2-Ply', headerColor: 'bg-orange-50 text-orange-900' },
      { id: 'CH SOFT TWIST', label: 'CH SOFT TWIST', description: 'Combed Soft Twist', headerColor: 'bg-rose-50 text-rose-900' },
      { id: 'CW HARD TWIST', label: 'CW HARD TWIST', description: 'Combed Hard Twist', headerColor: 'bg-purple-50 text-purple-900' },
    ],
  },
];

export const YarnMatrixEditor: React.FC<YarnMatrixEditorProps> = ({
  rows,
  onChange,
  onAddCount,
  onDeleteCount,
  searchQuery = '',
}) => {
  const [activeCategoryTab, setActiveCategoryTab] = useState<string>('ALL');
  const [newCountModalCategory, setNewCountModalCategory] = useState<string | null>(null);
  const [newCountValue, setNewCountValue] = useState<string>('');
  const [confirmDelete, setConfirmDelete] = useState<{ category: string; count: string } | null>(null);

  // Fast lookup map: key = `${category}__${yarnCount}__${quality}` -> SpreadsheetRow
  const rowLookup = useMemo(() => {
    const map = new Map<string, SpreadsheetRow>();
    rows.forEach((r) => {
      const cat = r.category || 'General';
      const key = `${cat}__${r.yarnCount}__${r.quality}`;
      map.set(key, r);
    });
    return map;
  }, [rows]);

  // Extract distinct yarnCounts per category, maintaining logical textile sorting (16, 20, 24, 26, 28, 30, 32, 34, 36, 40, 50, etc.)
  const countsByCategory = useMemo(() => {
    const result: Record<string, string[]> = {};

    MATRIX_CATEGORIES.forEach((cat) => {
      const countsSet = new Set<string>();
      rows
        .filter((r) => r.category === cat.id)
        .forEach((r) => {
          if (r.yarnCount) countsSet.add(r.yarnCount.trim());
        });

      // Natural textile sorting helper: extracts the base count number
      const sorted = Array.from(countsSet).sort((a, b) => {
        const numA = parseInt(a.replace(/[^0-9]/g, ''), 10) || 0;
        const numB = parseInt(b.replace(/[^0-9]/g, ''), 10) || 0;
        if (numA !== numB) return numA - numB;
        return a.localeCompare(b);
      });

      result[cat.id] = sorted;
    });

    return result;
  }, [rows]);

  const handleAddNewCountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCountModalCategory || !newCountValue.trim()) return;
    const clean = newCountValue.trim().toUpperCase();
    const formatted = clean.startsWith('NE') ? clean : `NE ${clean}`;

    if (onAddCount) {
      onAddCount(newCountModalCategory, formatted);
    } else {
      // Add a blank row for the first quality in category
      const config = MATRIX_CATEGORIES.find((c) => c.id === newCountModalCategory);
      if (config && config.qualities.length > 0) {
        config.qualities.forEach((q) => {
          onChange(newCountModalCategory, formatted, q.id, 'exMillPrice', null);
          onChange(newCountModalCategory, formatted, q.id, 'factoryLocation', 'Gujrat');
        });
      }
    }

    setNewCountValue('');
    setNewCountModalCategory(null);
  };

  // Filter categories and counts if search query is provided
  const query = searchQuery.toLowerCase().trim();

  return (
    <div className="w-full flex-1 flex flex-col min-w-0 bg-slate-100">
      {/* Category Section Filter Bar */}
      <div className="bg-white border-b border-slate-200 px-3 sm:px-4 py-2 flex items-center justify-between gap-2 overflow-x-auto">
        <div className="flex items-center space-x-1.5 shrink-0">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-1 flex items-center">
            <Filter className="w-3.5 h-3.5 mr-1 text-slate-400" />
            Section:
          </span>
          <button
            onClick={() => setActiveCategoryTab('ALL')}
            className={`px-3 py-1 rounded-md text-xs font-semibold transition-all whitespace-nowrap ${
              activeCategoryTab === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            All Sections (3)
          </button>
          {MATRIX_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategoryTab(cat.id)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all flex items-center space-x-1.5 whitespace-nowrap ${
                activeCategoryTab === cat.id
                  ? 'bg-emerald-700 text-white shadow-xs'
                  : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span>{cat.displayName}</span>
              <span className={`px-1.5 py-0.2 rounded text-[10px] font-mono ${
                activeCategoryTab === cat.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
              }`}>
                {countsByCategory[cat.id]?.length || 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Matrix Container - Full natural flow in the modal scroll container */}
      <div className="p-2 sm:p-4 space-y-4 sm:space-y-6 w-full">
        {MATRIX_CATEGORIES.map((catConfig) => {
          if (activeCategoryTab !== 'ALL' && activeCategoryTab !== catConfig.id) {
            return null;
          }

          const counts = countsByCategory[catConfig.id] || [];
          const filteredCounts = counts.filter((count) => {
            if (!query) return true;
            if (count.toLowerCase().includes(query)) return true;
            if (catConfig.displayName.toLowerCase().includes(query)) return true;
            // Check if any quality cell has matching location or price
            return catConfig.qualities.some((q) => {
              const row = rowLookup.get(`${catConfig.id}__${count}__${q.id}`);
              if (!row) return false;
              if (String(row.exMillPrice || '').includes(query)) return true;
              if (String(row.factoryLocation || '').toLowerCase().includes(query)) return true;
              return false;
            });
          });

          return (
            <div
              key={catConfig.id}
              className="bg-white rounded-xl shadow-xs border border-slate-300 overflow-hidden"
            >
              {/* Category Header Banner (mimicking row 1 & row 15 in user's screenshot) */}
              <div className="bg-slate-900 text-white px-4 py-3 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <h3 className="text-sm font-bold tracking-wider font-mono uppercase text-emerald-400">
                    {catConfig.displayName}
                  </h3>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${catConfig.badgeColor}`}>
                    {catConfig.badge}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    {filteredCounts.length} counts ({filteredCounts.length * catConfig.qualities.length} price points)
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setNewCountModalCategory(catConfig.id)}
                    className="inline-flex items-center space-x-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded cursor-pointer transition-colors shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Count</span>
                  </button>
                </div>
              </div>

              {/* Table Matrix */}
              <div className="overflow-x-auto w-full overscroll-x-contain">
                <table className="w-full min-w-[700px] text-xs border-collapse">
                  <thead>
                    {/* Primary Quality Header Row (Row 2 in screenshot) */}
                    <tr className="border-b border-slate-300 bg-slate-100">
                      <th
                        rowSpan={2}
                        className="w-32 min-w-[124px] px-2.5 py-2 text-left font-bold text-slate-800 bg-slate-200/90 border-r border-slate-300 sticky left-0 z-20 shadow-xs"
                      >
                        <div className="text-[10px] text-slate-500 uppercase tracking-wider font-sans">Row Count</div>
                        <div className="text-xs font-mono font-semibold text-slate-900">Yarn Count</div>
                      </th>

                      {catConfig.qualities.map((q) => (
                        <th
                          key={q.id}
                          colSpan={2}
                          className={`px-3 py-1.5 text-center font-bold border-r border-slate-300 ${q.headerColor}`}
                        >
                          <div className="flex items-center justify-center">
                            <span className="font-mono text-sm tracking-wide text-slate-900">{q.label}</span>
                          </div>
                        </th>
                      ))}
                    </tr>

                    {/* Sub-header row: Price | Factory location for each quality */}
                    <tr className="border-b border-slate-300 bg-slate-50 text-slate-600 font-medium text-[11px]">
                      {catConfig.qualities.map((q) => (
                        <React.Fragment key={`${q.id}_sub`}>
                          <th className="px-2 py-1 text-right border-r border-slate-200 bg-slate-50/90 w-28 text-slate-700 font-semibold">
                            Ex-Mill (₹/kg)
                          </th>
                          <th className="px-2 py-1 text-left border-r border-slate-300 bg-slate-50 w-36 text-slate-500 font-normal">
                            Factory location
                          </th>
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-200">
                    {filteredCounts.length === 0 ? (
                      <tr>
                        <td
                          colSpan={1 + catConfig.qualities.length * 2}
                          className="py-8 text-center text-slate-500 italic bg-white"
                        >
                          {query ? `No counts matched "${query}"` : 'No yarn counts in this category.'}
                        </td>
                      </tr>
                    ) : (
                      filteredCounts.map((count, idx) => (
                        <tr
                          key={count}
                          className={`${
                            idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'
                          } hover:bg-emerald-50/40 transition-colors group`}
                        >
                          {/* Count Column (Left sticky column) with Delete button */}
                          <td className={`px-2.5 py-1.5 font-mono font-bold text-slate-900 border-r border-slate-300 sticky left-0 z-10 whitespace-nowrap shadow-xs ${
                            idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'
                          }`}>
                            <div className="flex items-center justify-between space-x-1.5 min-w-[90px]">
                              <span className="inline-block px-1.5 py-0.5 bg-slate-100 rounded text-slate-800 border border-slate-200/80 text-xs">
                                {count}
                              </span>
                              {onDeleteCount && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmDelete({ category: catConfig.id, count });
                                  }}
                                  className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                  title={`Delete row ${count}`}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>

                          {/* Dynamic Quality Pairs (Price & Factory Location) */}
                          {catConfig.qualities.map((q) => {
                            const record = rowLookup.get(`${catConfig.id}__${count}__${q.id}`);
                            const price = record?.exMillPrice;
                            const location = record?.factoryLocation || '';

                            return (
                              <React.Fragment key={`${count}__${q.id}`}>
                                {/* Price Cell */}
                                <td className="px-1 py-1 border-r border-slate-200 text-right bg-inherit">
                                  <div className="relative flex items-center justify-end">
                                    <input
                                      type="number"
                                      step="0.5"
                                      placeholder="-"
                                      value={price !== null && price !== undefined ? price : ''}
                                      onChange={(e) => {
                                        const val = e.target.value === '' ? null : parseFloat(e.target.value);
                                        onChange(catConfig.id, count, q.id, 'exMillPrice', val);
                                      }}
                                      className={`w-full text-right font-mono px-2 py-1 rounded text-xs transition-all ${
                                        price !== null && price !== undefined && price > 0
                                          ? 'font-bold text-emerald-900 bg-emerald-50/60 border border-emerald-200/70 focus:bg-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500'
                                          : 'text-slate-400 bg-transparent border border-transparent hover:border-slate-300 focus:bg-white focus:border-slate-400 focus:text-slate-900'
                                      }`}
                                    />
                                  </div>
                                </td>

                                {/* Factory Location Cell - Direct editable cell, no dropdown */}
                                <td className="px-1 py-1 border-r border-slate-300 bg-inherit">
                                  <div className="relative">
                                    <input
                                      type="text"
                                      placeholder="Location..."
                                      value={location === 'Factory Location not available.' ? '' : location}
                                      onChange={(e) => {
                                        onChange(catConfig.id, count, q.id, 'factoryLocation', e.target.value);
                                      }}
                                      className="w-full text-left px-2 py-1 rounded text-xs text-slate-700 bg-transparent border border-transparent hover:border-slate-300 focus:bg-white focus:border-slate-400 focus:outline-none transition-all truncate"
                                    />
                                  </div>
                                </td>
                              </React.Fragment>
                            );
                          })}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL: Add New Yarn Count */}
      {newCountModalCategory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-300 w-full max-w-md p-5 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
                <Plus className="w-4 h-4 text-emerald-600" />
                <span>Add Yarn Count to {newCountModalCategory}</span>
              </h3>
              <button
                onClick={() => setNewCountModalCategory(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddNewCountSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Yarn Count (e.g. NE 18/1, NE 44/1, NE 38/2)
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="NE 18/1"
                  value={newCountValue}
                  onChange={(e) => setNewCountValue(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm font-mono focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600 outline-none"
                />
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs text-slate-600">
                This count will be added across all quality columns in <span className="font-bold">{newCountModalCategory}</span> so you can set its prices immediately.
              </div>

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setNewCountModalCategory(null)}
                  className="px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 rounded-md"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white rounded-md shadow-xs cursor-pointer"
                >
                  Add Count
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Confirm Delete Row */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-300 w-full max-w-sm p-5 space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 text-sm flex items-center space-x-2">
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>Delete Yarn Row</span>
              </h3>
              <button
                onClick={() => setConfirmDelete(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Are you sure you want to delete row <span className="font-bold text-slate-900 font-mono">{confirmDelete.count}</span> from <span className="font-bold text-slate-900">{confirmDelete.category}</span>? This will remove all prices for this count.
            </p>

            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-100 rounded-md font-medium"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (onDeleteCount) {
                    onDeleteCount(confirmDelete.category, confirmDelete.count);
                  }
                  setConfirmDelete(null);
                }}
                className="px-3.5 py-1.5 text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white rounded-md shadow-xs cursor-pointer"
              >
                Delete Row
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
