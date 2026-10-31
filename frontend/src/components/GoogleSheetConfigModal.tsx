import React, { useState, useEffect } from 'react';
import {
  FileSpreadsheet,
  ExternalLink,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  X,
  HelpCircle,
  Globe,
  Ship,
  Anchor,
  Layers,
  Sparkles,
  Users,
  Copy,
  Check,
  Download,
  PlusCircle,
  UserCheck,
} from 'lucide-react';
import {
  getSavedGoogleSheetUrls,
  saveGoogleSheetUrls,
} from '../lib/googleSheetService';
import { DailyPricingStatus } from '../types';
import { getStoredAuthToken } from '../lib/authData';
import { SyncPreviewModal, PriceDiffChange } from './SyncPreviewModal';
import {
  getSavedEmployeeSheets,
  saveEmployeeSheet,
  downloadEmployeeSheetCsv,
  EmployeeSheetConfig,
  getEmployeeFormula,
} from '../lib/employeeSheets';

interface GoogleSheetConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSyncComplete?: (status: DailyPricingStatus) => void;
  onOpenSheetButtonModal?: () => void;
}

export const GoogleSheetConfigModal: React.FC<GoogleSheetConfigModalProps> = ({
  isOpen,
  onClose,
  onSyncComplete,
  onOpenSheetButtonModal,
}) => {
  const [activeTab, setActiveTab] = useState<'master' | 'employees'>('employees');
  const [urls, setUrls] = useState(() => getSavedGoogleSheetUrls());

  // Master Workbook Link
  const [masterUrl, setMasterUrl] = useState(() => urls.yarnViewUrl.split('#')[0].split('?')[0]);
  const [yarnGid, setYarnGid] = useState('177573931');
  const [fobGid, setFobGid] = useState('1401052388');
  const [freightGid, setFreightGid] = useState('1549189100');

  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Employee Sheets state
  const [employeeSheets, setEmployeeSheets] = useState<EmployeeSheetConfig[]>(() => getSavedEmployeeSheets());
  const [selectedEmpId, setSelectedEmpId] = useState<string>('emp1');
  const [editingUrl, setEditingUrl] = useState<string>('');
  const [copiedFormulaEmpId, setCopiedFormulaEmpId] = useState<string | null>(null);
  const [empSaveSuccess, setEmpSaveSuccess] = useState<string | null>(null);

  // Preview Sync Dialog State
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<{
    count: number;
    changes: PriceDiffChange[];
    hasLargeDiff: boolean;
    message: string;
  } | null>(null);
  const [pendingUrls, setPendingUrls] = useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      const saved = getSavedGoogleSheetUrls();
      setUrls(saved);
      const cleanBase = saved.yarnViewUrl.split('#')[0].split('?')[0];
      setMasterUrl(cleanBase);
      setSyncStatus(null);
      setEmpSaveSuccess(null);

      const emps = getSavedEmployeeSheets();
      setEmployeeSheets(emps);
      const currentEmp = emps.find((e) => e.empId === selectedEmpId) || emps[0];
      if (currentEmp) {
        setEditingUrl(currentEmp.viewUrl);
      }
    }
  }, [isOpen]);

  useEffect(() => {
    const currentEmp = employeeSheets.find((e) => e.empId === selectedEmpId);
    if (currentEmp) {
      setEditingUrl(currentEmp.viewUrl);
      setEmpSaveSuccess(null);
    }
  }, [selectedEmpId, employeeSheets]);

  if (!isOpen) return null;

  const currentSelectedEmp = employeeSheets.find((e) => e.empId === selectedEmpId) || employeeSheets[0];

  const handleMasterUrlChange = (val: string) => {
    setMasterUrl(val);
    const gidMatch = val.match(/[?&]gid=([0-9]+)/) || val.match(/#gid=([0-9]+)/);
    if (gidMatch && gidMatch[1]) {
      const extractedGid = gidMatch[1];
      if (!yarnGid || yarnGid === '177573931') {
        setYarnGid(extractedGid);
      }
    }
  };

  const handleSaveEmpSheetUrl = () => {
    if (!currentSelectedEmp) return;
    const clean = editingUrl.trim();
    if (!clean) return;
    const updated = saveEmployeeSheet(currentSelectedEmp.empId, {
      viewUrl: clean,
    });
    setEmployeeSheets(updated);
    setEmpSaveSuccess(`Saved Google Sheet for ${currentSelectedEmp.employeeName}!`);
    setTimeout(() => setEmpSaveSuccess(null), 3000);
  };

  const handleCopyEmpFormula = (empId: string) => {
    const formula = getEmployeeFormula(empId);
    navigator.clipboard.writeText(formula);
    setCopiedFormulaEmpId(empId);
    setTimeout(() => setCopiedFormulaEmpId(null), 2500);
  };

  const handleInitiateSync = async (overrideCsvUrl?: string, customLabel?: string) => {
    setIsSyncing(true);
    setSyncStatus(null);

    try {
      const cleanBase = masterUrl.trim().replace(/\/edit.*$/, '').replace(/\/export.*$/, '');
      const yarnG = yarnGid.trim() || '177573931';
      const fobG = fobGid.trim() || '1401052388';
      const freightG = freightGid.trim() || '1549189100';

      const yarnFull = `${cleanBase}/edit?gid=${yarnG}#gid=${yarnG}`;
      const fobFull = `${cleanBase}/edit?gid=${fobG}#gid=${fobG}`;
      const freightFull = `${cleanBase}/edit?gid=${freightG}#gid=${freightG}`;

      const updated = saveGoogleSheetUrls({
        yarnUrl: yarnFull,
        fobUrl: fobFull,
        freightUrl: freightFull,
      });
      setUrls(updated);

      const targetYarnCsv = overrideCsvUrl || updated.yarnCsvUrl;
      setPendingUrls({
        yarnCsvUrl: targetYarnCsv,
        fobCsvUrl: updated.fobCsvUrl,
        freightCsvUrl: updated.freightCsvUrl,
        label: customLabel || 'Master Google Sheet',
      });

      // Fetch preview diff first
      const token = getStoredAuthToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/google-sheet/preview-sync', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          yarnCsvUrl: targetYarnCsv,
          fobCsvUrl: updated.fobCsvUrl,
          freightCsvUrl: updated.freightCsvUrl,
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      let data: any = {};
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        const preview = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
        data = {
          success: false,
          error:
            res.status === 403
              ? 'Unauthorized: Only Admin users can publish daily prices. Please log in as Admin.'
              : `Server returned HTTP ${res.status}: ${preview || 'Non-JSON'}`,
        };
      }

      if (res.ok && data.success) {
        setPreviewData({
          count: data.count || 0,
          changes: data.changes || [],
          hasLargeDiff: Boolean(data.hasLargeDiff),
          message: data.message || '',
        });
        setIsPreviewOpen(true);
      } else {
        setSyncStatus({
          type: 'error',
          message: data.error || 'Could not preview Google Sheet sync. Ensure sheet is set to "Anyone with link can view".',
        });
      }
    } catch (err: any) {
      setSyncStatus({
        type: 'error',
        message: err.message || 'Network error while checking Google Sheet.',
      });
    } finally {
      setIsSyncing(false);
    }
  };

  const handleConfirmPublish = async () => {
    if (!pendingUrls) return;
    setIsSyncing(true);

    try {
      const token = getStoredAuthToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/google-sheet/sync-from-sheets', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          yarnCsvUrl: pendingUrls.yarnCsvUrl,
          fobCsvUrl: pendingUrls.fobCsvUrl,
          freightCsvUrl: pendingUrls.freightCsvUrl,
          confirmedBy: `Admin (${pendingUrls.label || 'Google Sheet Sync'})`,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setSyncStatus({
          type: 'success',
          message: `${pendingUrls.label || 'Google Sheet'} synced & published! Daily prices active for all employees.`,
        });
        setIsPreviewOpen(false);
        if (onSyncComplete && data.status) {
          onSyncComplete(data.status);
        }
        window.dispatchEvent(new CustomEvent('daily-pricing-updated', { detail: data.status }));
      } else {
        setSyncStatus({
          type: 'error',
          message: data.error || 'Could not sync from Google Sheet.',
        });
        setIsPreviewOpen(false);
      }
    } catch (err: any) {
      setSyncStatus({
        type: 'error',
        message: err.message || 'Network error while syncing Google Sheet.',
      });
      setIsPreviewOpen(false);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl shadow-2xl max-w-3xl w-full border border-slate-200 overflow-hidden font-sans">
          
          {/* Modal Header */}
          <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
            <div className="flex items-center space-x-3">
              <div className="bg-emerald-500/20 p-2 rounded-xl border border-emerald-500/40">
                <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-base font-bold">Google Sheets Integration &amp; Sync</h3>
                  <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                    emp1 &bull; emp2 &bull; Master
                  </span>
                </div>
                <p className="text-xs text-slate-400 font-sans">
                  Manage Company Master Sheet or create and assign dedicated Google Sheets for every employee
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation Tabs */}
          <div className="bg-slate-100 px-6 pt-3 border-b border-slate-200 flex space-x-3 text-xs font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('employees')}
              className={`pb-2.5 px-3 border-b-2 flex items-center space-x-2 transition-all cursor-pointer ${
                activeTab === 'employees'
                  ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg shadow-2xs'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users className="w-4 h-4 text-indigo-600" />
              <span>Employee Sheets (emp1, emp2...)</span>
              <span className="bg-indigo-100 text-indigo-800 text-[10px] px-1.5 py-0.5 rounded-full font-mono">
                {employeeSheets.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('master')}
              className={`pb-2.5 px-3 border-b-2 flex items-center space-x-2 transition-all cursor-pointer ${
                activeTab === 'master'
                  ? 'border-indigo-600 text-indigo-700 bg-white rounded-t-lg shadow-2xs'
                  : 'border-transparent text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Company Master Sheet</span>
            </button>
          </div>

          {/* Modal Content */}
          <div className="p-6 space-y-6 max-h-[76vh] overflow-y-auto">
            
            {/* Sync Status Banner */}
            {syncStatus && (
              <div
                className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center space-x-2 ${
                  syncStatus.type === 'success'
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                    : 'bg-rose-50 text-rose-900 border-rose-200'
                }`}
              >
                {syncStatus.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                )}
                <span>{syncStatus.message}</span>
              </div>
            )}

            {/* TAB 1: EMPLOYEE SHEETS (emp1, emp2...) */}
            {activeTab === 'employees' && (
              <div className="space-y-5">
                
                {/* Employee Selector Pills */}
                <div className="flex flex-wrap gap-2 items-center bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider px-2">Select Employee:</span>
                  {employeeSheets.map((emp) => {
                    const isSelected = emp.empId === selectedEmpId;
                    const isPrimary = emp.empId === 'emp1' || emp.empId === 'emp2';
                    return (
                      <button
                        key={emp.empId}
                        type="button"
                        onClick={() => setSelectedEmpId(emp.empId)}
                        className={`inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-indigo-600 text-white shadow-xs'
                            : 'bg-white text-slate-700 border border-slate-200 hover:border-indigo-300 hover:bg-slate-100'
                        }`}
                      >
                        <span className={`text-[10px] px-1 py-0.2 rounded font-mono ${isSelected ? 'bg-indigo-800 text-white' : 'bg-slate-100 text-indigo-700'}`}>
                          {emp.empId.toUpperCase()}
                        </span>
                        <span>{emp.employeeName.split(' ')[0]}</span>
                        {isPrimary && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>}
                      </button>
                    );
                  })}
                </div>

                {/* Selected Employee Card */}
                {currentSelectedEmp && (
                  <div className="border border-indigo-200 bg-white rounded-2xl p-5 shadow-xs space-y-4">
                    
                    {/* Employee Profile Header */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center font-black font-mono text-indigo-700">
                          {currentSelectedEmp.empId.toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h4 className="text-sm font-bold text-slate-900">{currentSelectedEmp.employeeName}</h4>
                            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold">
                              {currentSelectedEmp.status === 'custom' ? 'Custom Assigned Sheet' : 'Company Master Template'}
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 font-sans">
                            {currentSelectedEmp.title} &bull; <span className="font-mono text-slate-600">{currentSelectedEmp.email}</span>
                          </p>
                        </div>
                      </div>

                      {/* Quick 1-Click Template Creator */}
                      <a
                        href={currentSelectedEmp.templateCopyUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center space-x-2 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer self-start sm:self-auto shrink-0"
                        title={`Make a fresh copy of Google Sheet for ${currentSelectedEmp.empId}`}
                      >
                        <PlusCircle className="w-4 h-4" />
                        <span>Create {currentSelectedEmp.empId.toUpperCase()} Google Sheet ↗</span>
                      </a>
                    </div>

                    {/* Step-by-Step Guide for this Employee */}
                    <div className="bg-slate-50 rounded-xl p-3.5 text-xs text-slate-700 space-y-1.5 border border-slate-200">
                      <span className="font-bold text-slate-900 block">How to setup Google Sheet for {currentSelectedEmp.empId.toUpperCase()}:</span>
                      <ol className="list-decimal list-inside space-y-1 text-slate-600">
                        <li>
                          Click <strong>&quot;Create {currentSelectedEmp.empId.toUpperCase()} Google Sheet ↗&quot;</strong> above (or download the CSV template below).
                        </li>
                        <li>
                          In Google Sheets, click <strong>&quot;Make a copy&quot;</strong>. It creates a complete Yarn, FOB &amp; Freight sheet in Google Drive.
                        </li>
                        <li>
                          In your new sheet, click <strong>Share &gt; &quot;Anyone with the link can view&quot;</strong>, then paste the URL below and click <strong>Save</strong>.
                        </li>
                      </ol>
                    </div>

                    {/* Assigned Sheet URL Input */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                          <FileSpreadsheet className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Assigned Google Sheet URL for {currentSelectedEmp.empId.toUpperCase()}</span>
                        </label>
                        <a
                          href={currentSelectedEmp.viewUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 flex items-center space-x-1"
                        >
                          <span>Open Active Sheet ↗</span>
                        </a>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={editingUrl}
                          onChange={(e) => setEditingUrl(e.target.value)}
                          placeholder="https://docs.google.com/spreadsheets/d/.../edit"
                          className="flex-1 text-xs font-mono bg-white border border-slate-300 rounded-xl p-2.5 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleSaveEmpSheetUrl}
                          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0"
                        >
                          Save URL
                        </button>
                      </div>
                      {empSaveSuccess && (
                        <p className="text-xs text-emerald-600 font-bold flex items-center space-x-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{empSaveSuccess}</span>
                        </p>
                      )}
                    </div>

                    {/* 1-Click Return & Unlock Button Formula for this employee */}
                    <div className="bg-slate-900 rounded-xl p-3.5 space-y-2 border border-slate-800">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-200 flex items-center space-x-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                          <span>1-Click Return Formula to paste into {currentSelectedEmp.empId.toUpperCase()} Sheet:</span>
                        </span>
                        <span className="text-[10px] text-emerald-400 font-mono font-bold bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                          Paste in Cell A1
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                        <code className="text-xs font-mono text-emerald-400 truncate flex-1 select-all">
                          {getEmployeeFormula(currentSelectedEmp.empId)}
                        </code>
                        <button
                          type="button"
                          onClick={() => handleCopyEmpFormula(currentSelectedEmp.empId)}
                          className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shrink-0"
                        >
                          {copiedFormulaEmpId === currentSelectedEmp.empId ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span>Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy Formula</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Action Buttons for this employee */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                      <button
                        type="button"
                        onClick={() => downloadEmployeeSheetCsv(currentSelectedEmp.empId)}
                        className="inline-flex items-center space-x-2 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition-colors cursor-pointer border border-slate-200"
                      >
                        <Download className="w-3.5 h-3.5 text-slate-600" />
                        <span>Download {currentSelectedEmp.empId.toUpperCase()} CSV Template</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleInitiateSync(currentSelectedEmp.csvUrl, `${currentSelectedEmp.employeeName} Sheet`)}
                        disabled={isSyncing}
                        className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                        <span>Sync Prices from {currentSelectedEmp.empId.toUpperCase()} Sheet</span>
                      </button>
                    </div>

                  </div>
                )}

              </div>
            )}

            {/* TAB 2: MASTER COMPANY SHEET */}
            {activeTab === 'master' && (
              <div className="space-y-6">
                {/* Informational Banner */}
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 space-y-2">
                  <div className="flex items-center space-x-2 font-bold text-amber-900">
                    <HelpCircle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Company Master Google Sheet:</span>
                  </div>
                  <p className="leading-relaxed text-amber-800">
                    1. Open the Company Master Google Sheet, click <strong>Share</strong> &gt; set permission to <strong>&quot;Anyone with the link can view&quot;</strong>.
                  </p>
                  <p className="leading-relaxed text-amber-800">
                    2. Paste the Google Sheet URL below. The system fetches prices from the Yarn, FOB, and Freight sub-sheets.
                  </p>
                </div>

                {/* Master Workbook URL Field */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
                      <Globe className="w-4 h-4 text-emerald-600" />
                      <span>Company Master Google Sheet Link</span>
                    </label>
                    <a
                      href={masterUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs font-semibold text-emerald-600 hover:text-emerald-800 flex items-center space-x-1"
                    >
                      <span>Open Master Sheet in new tab</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <input
                    type="text"
                    value={masterUrl}
                    onChange={(e) => handleMasterUrlChange(e.target.value)}
                    placeholder="https://docs.google.com/spreadsheets/d/1wHihQ-COyhDfU8fbzV5Id8oDRrBbiKvjPWvr3bBxzWE/edit"
                    className="w-full text-xs font-mono bg-white border border-slate-300 rounded-xl p-3 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                  />
                  <p className="text-[11px] text-slate-500">
                    Default: <code className="font-mono bg-slate-100 px-1 py-0.5 rounded">1wHihQ-COyhDfU8fbzV5Id8oDRrBbiKvjPWvr3bBxzWE</code>
                  </p>
                </div>

                {/* Sub-sheet GID Identifiers */}
                <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 space-y-3">
                  <div className="flex items-center space-x-2 text-xs font-bold text-slate-800">
                    <Layers className="w-4 h-4 text-indigo-600" />
                    <span>Sub-Sheet Identifiers (GID)</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Yarn Sub-Sheet GID
                      </label>
                      <input
                        type="text"
                        value={yarnGid}
                        onChange={(e) => setYarnGid(e.target.value)}
                        placeholder="177573931"
                        className="w-full text-xs font-mono bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        FOB Sub-Sheet GID
                      </label>
                      <input
                        type="text"
                        value={fobGid}
                        onChange={(e) => setFobGid(e.target.value)}
                        placeholder="1401052388"
                        className="w-full text-xs font-mono bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Freight Sub-Sheet GID
                      </label>
                      <input
                        type="text"
                        value={freightGid}
                        onChange={(e) => setFreightGid(e.target.value)}
                        placeholder="1549189100"
                        className="w-full text-xs font-mono bg-white border border-slate-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Return Button Callout */}
                {onOpenSheetButtonModal && (
                  <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-50 via-slate-50 to-indigo-50 border border-emerald-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                    <div className="space-y-0.5">
                      <div className="font-bold text-slate-900 flex items-center space-x-1.5">
                        <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Want a button inside Google Sheets to return &amp; unlock prices?</span>
                      </div>
                      <p className="text-slate-600 text-[11px]">
                        Paste a 1-click formula into Cell A1 of your Google Sheet. Clicking it confirms prices in MongoDB &amp; unlocks calculations for all employees!
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenSheetButtonModal();
                      }}
                      className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs shadow-xs cursor-pointer shrink-0 transition-colors"
                    >
                      Get Button / Formula 📋
                    </button>
                  </div>
                )}
              </div>
            )}

          </div>

          {/* Modal Footer Actions */}
          <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
            >
              Close
            </button>

            {activeTab === 'master' ? (
              <button
                type="button"
                onClick={() => handleInitiateSync()}
                disabled={isSyncing}
                className="inline-flex items-center space-x-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Checking Sub-sheets...' : 'Preview & Sync Master Google Sheet'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleInitiateSync(currentSelectedEmp.csvUrl, `${currentSelectedEmp.employeeName} Sheet`)}
                disabled={isSyncing}
                className="inline-flex items-center space-x-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>{isSyncing ? 'Checking Sheet...' : `Preview & Sync ${currentSelectedEmp.empId.toUpperCase()} Sheet`}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation Dialog Before Publishing */}
      {previewData && (
        <SyncPreviewModal
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          onConfirmPublish={handleConfirmPublish}
          isPublishing={isSyncing}
          count={previewData.count}
          changes={previewData.changes}
          hasLargeDiff={previewData.hasLargeDiff}
          message={previewData.message}
        />
      )}
    </>
  );
};
