import React, { useState } from 'react';
import {
  FileSpreadsheet,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  Zap,
  CheckCircle2,
  X,
  Code,
  ArrowRight,
  ShieldCheck,
  HelpCircle,
  Users,
} from 'lucide-react';
import { getSavedGoogleSheetUrls } from '../lib/googleSheetService';
import { DEFAULT_EMPLOYEE_SHEETS } from '../lib/employeeSheets';
import { getAuthJsonHeaders } from '../lib/authData';

interface GoogleSheetButtonModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmSuccess?: () => void;
}

export const GoogleSheetButtonModal: React.FC<GoogleSheetButtonModalProps> = ({
  isOpen,
  onClose,
  onConfirmSuccess,
}) => {
  const [selectedTarget, setSelectedTarget] = useState<string>('all'); // 'all', 'emp1', 'emp2', etc.
  const [copiedFormula, setCopiedFormula] = useState(false);
  const [copiedScript, setCopiedScript] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  if (!isOpen) return null;

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com';
  const employeeQuery = selectedTarget !== 'all' ? `?employee=${selectedTarget}` : '';
  const confirmEndpoint = `${origin}/api/daily-pricing/confirm-from-sheet${employeeQuery}`;
  const sheetUrls = getSavedGoogleSheetUrls();
  const masterSheetUrl = sheetUrls.yarnViewUrl.split('#')[0].split('?')[0];

  const buttonLabel = selectedTarget === 'all'
    ? '🟢 CONFIRM PRICES & RETURN TO DASHBOARD'
    : `🟢 CONFIRM PRICES & UNLOCK (${selectedTarget.toUpperCase()})`;

  const formulaText = `=HYPERLINK("${confirmEndpoint}", "${buttonLabel}")`;

  const targetName = selectedTarget === 'all'
    ? 'Company Master'
    : DEFAULT_EMPLOYEE_SHEETS.find((e) => e.empId === selectedTarget)?.employeeName || selectedTarget.toUpperCase();

  const appsScriptCode = `/**
 * Lahoti Overseas Yarn Costing - Google Sheet Automation
 * Target: ${targetName}
 * Adds a custom menu and one-click button to confirm daily prices
 * and unlock calculations for all employees across the company.
 */

function confirmAndOpenDashboard() {
  var url = "${confirmEndpoint}";

  // Open the Costing Dashboard; the Admin clicks "Publish Prices" there to unlock today's prices
  var html = '<div style="font-family:sans-serif;text-align:center;padding:20px;">' +
             '<h3 style="color:#059669;margin-bottom:8px;">✅ Returning to Costing Dashboard</h3>' +
             '<p style="color:#4b5563;font-size:13px;">Click <b>Publish Prices</b> there to unlock today\\'s prices for all employees (${targetName}).</p>' +
             '<p><a href="' + url + '" target="_blank" style="display:inline-block;padding:10px 18px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-weight:bold;font-size:13px;">Open Costing Dashboard ↗</a></p>' +
             '</div>' +
             '<script>window.open("' + url + '", "_blank");setTimeout(function(){google.script.host.close();}, 1500);</script>';

  var ui = HtmlService.createHtmlOutput(html).setWidth(340).setHeight(180);
  SpreadsheetApp.getUi().showModalDialog(ui, "Back to Dashboard");
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("🚀 Lahoti Costing (${selectedTarget.toUpperCase()})")
    .addItem("🟢 Confirm Prices & Return to Dashboard", "confirmAndOpenDashboard")
    .addToUi();
}
`;

  const copyToClipboard = (text: string, type: 'formula' | 'script' | 'url') => {
    navigator.clipboard.writeText(text);
    if (type === 'formula') {
      setCopiedFormula(true);
      setTimeout(() => setCopiedFormula(false), 2000);
    } else if (type === 'script') {
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 2000);
    } else {
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 2000);
    }
  };

  const handleTestConfirmation = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await fetch('/api/daily-pricing/confirm-from-sheet', {
        method: 'POST',
        headers: { ...getAuthJsonHeaders(), 'Accept': 'application/json' },
        body: JSON.stringify({
          confirmedBy: `Admin (Test for ${selectedTarget.toUpperCase()})`,
          employee: selectedTarget,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setTestResult(`✅ Success! Prices marked as confirmed for ${targetName}. Calculations unlocked for all employees.`);
        window.dispatchEvent(new CustomEvent('daily-pricing-updated', { detail: json.status }));
        if (onConfirmSuccess) onConfirmSuccess();
      } else {
        setTestResult("⚠️ Error: " + (json.error || 'Failed to confirm'));
      }
    } catch (e: any) {
      setTestResult("⚠️ Error testing: " + e.message);
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in duration-200 font-sans">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-lg font-bold">Google Sheet "Confirm &amp; Return" Button</h2>
                <span className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                  Employee Unlock
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Generate the button or formula to paste into Google Sheets for emp1, emp2, or Master sheet.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          
          {/* Target Sheet Selector: Master, emp1, emp2 */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <span className="text-xs font-bold text-slate-700 flex items-center space-x-1.5">
              <Users className="w-3.5 h-3.5 text-indigo-600" />
              <span>Which Google Sheet are you configuring this button for?</span>
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedTarget('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedTarget === 'all'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                Company Master Sheet
              </button>
              <button
                type="button"
                onClick={() => setSelectedTarget('emp1')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedTarget === 'emp1'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                ⭐ emp1 (Javier Moreano)
              </button>
              <button
                type="button"
                onClick={() => setSelectedTarget('emp2')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedTarget === 'emp2'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                ⭐ emp2 (Mehadi Hasan)
              </button>
              <button
                type="button"
                onClick={() => setSelectedTarget('emp3')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  selectedTarget === 'emp3'
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                emp3 (Rashmi)
              </button>
            </div>
          </div>

          {/* Banner Explanation */}
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 text-xs flex items-start space-x-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="font-bold text-sm text-emerald-900">
                Workflow for {targetName}:
              </h4>
              <p className="text-slate-700 leading-relaxed">
                When an employee or admin edits rates in this Google Sheet and clicks the button, it:
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-slate-700 font-medium">
                <li>Marks today's prices as <strong>CONFIRMED &amp; ACTIVE</strong> in the MongoDB database.</li>
                <li><strong>Unlocks export costing calculations for every employee</strong> across the company immediately.</li>
                <li>Opens the costing dashboard in the browser with an unlocked status banner.</li>
              </ul>
            </div>
          </div>

          {/* METHOD 1: HYPERLINK FORMULA */}
          <div className="border border-slate-200 rounded-2xl p-5 bg-white space-y-3.5 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                  1
                </span>
                <h3 className="font-bold text-slate-900 text-sm">
                  Quick Method: Formula Link for {targetName} (Recommended - 10 Seconds)
                </h3>
              </div>
              <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Easiest &amp; Instant
              </span>
            </div>

            <p className="text-xs text-slate-600">
              Copy this formula and paste it into <strong>Cell A1</strong> (or any header cell) of your Google Sheet:
            </p>

            <div className="bg-slate-900 rounded-xl p-3 flex items-center justify-between gap-2 border border-slate-800">
              <code className="text-xs font-mono text-emerald-400 truncate flex-1 select-all">
                {formulaText}
              </code>
              <button
                onClick={() => copyToClipboard(formulaText, 'formula')}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shrink-0"
              >
                {copiedFormula ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedFormula ? 'Copied Formula!' : 'Copy Formula'}</span>
              </button>
            </div>

            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600 space-y-1.5">
              <span className="font-bold text-slate-800">Visual Appearance in Google Sheet:</span>
              <div className="p-2.5 bg-white rounded-lg border border-slate-200 flex items-center justify-between">
                <div className="inline-flex items-center space-x-2 text-emerald-700 font-bold underline font-sans text-xs">
                  <span>{buttonLabel}</span>
                </div>
                <span className="text-[10px] text-slate-400 italic">Clicking this link confirms prices &amp; unlocks for everyone</span>
              </div>
            </div>
          </div>

          {/* METHOD 2: APPS SCRIPT BUTTON */}
          <div className="border border-slate-200 rounded-2xl p-5 bg-white space-y-3.5 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                  2
                </span>
                <h3 className="font-bold text-slate-900 text-sm">
                  Advanced: Custom Menu &amp; Clickable Graphic Button ({targetName})
                </h3>
              </div>
              <span className="text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                Menu &amp; Button
              </span>
            </div>

            <p className="text-xs text-slate-600">
              Creates a custom menu in Google Sheets or attaches to an <strong>Insert &gt; Drawing</strong> button:
            </p>

            <ol className="list-decimal list-inside text-xs text-slate-700 space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
              <li>In your Google Sheet, click <strong>Extensions &gt; Apps Script</strong>.</li>
              <li>Delete any sample code and paste the script below, then click <strong>Save (Disk icon)</strong>.</li>
              <li>Refresh your Google Sheet: a new <strong>&quot;🚀 Lahoti Costing ({selectedTarget.toUpperCase()})&quot;</strong> menu appears at the top!</li>
              <li>(Optional button): Click <strong>Insert &gt; Drawing</strong>, draw a rounded button, click the 3 dots on the drawing &gt; <strong>Assign script</strong>, and type: <code className="font-mono font-bold text-indigo-700">confirmAndOpenDashboard</code>.</li>
            </ol>

            <div className="relative">
              <pre className="bg-slate-900 text-slate-100 rounded-xl p-3.5 text-[11px] font-mono overflow-x-auto max-h-44 border border-slate-800">
                {appsScriptCode}
              </pre>
              <button
                onClick={() => copyToClipboard(appsScriptCode, 'script')}
                className="absolute top-2.5 right-2.5 inline-flex items-center space-x-1.5 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold rounded-lg transition-colors cursor-pointer shadow-md"
              >
                {copiedScript ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedScript ? 'Copied Code!' : 'Copy Script'}</span>
              </button>
            </div>
          </div>

          {/* METHOD 3: DIRECT WEBHOOK URL */}
          <div className="border border-slate-200 rounded-2xl p-5 bg-white space-y-3 shadow-xs">
            <div className="flex items-center space-x-2">
              <span className="w-6 h-6 rounded-full bg-slate-700 text-white font-bold text-xs flex items-center justify-center">
                3
              </span>
              <h3 className="font-bold text-slate-900 text-sm">
                Direct Webhook Endpoint URL
              </h3>
            </div>

            <div className="bg-slate-50 rounded-xl p-3 flex items-center justify-between gap-2 border border-slate-200">
              <span className="font-mono text-xs text-slate-700 truncate select-all">
                {confirmEndpoint}
              </span>
              <button
                onClick={() => copyToClipboard(confirmEndpoint, 'url')}
                className="inline-flex items-center space-x-1 px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg transition-colors cursor-pointer shrink-0"
              >
                {copiedUrl ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
                <span>{copiedUrl ? 'Copied!' : 'Copy URL'}</span>
              </button>
            </div>
          </div>

          {/* TEST CONFIRMATION SECTION */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div>
              <span className="font-bold text-slate-800 block">Want to test right now for {targetName}?</span>
              <span className="text-slate-500">
                Simulate clicking the Google Sheet confirmation button to verify prices unlock.
              </span>
              {testResult && (
                <p className="mt-1 font-bold text-xs text-emerald-700">{testResult}</p>
              )}
            </div>

            <button
              onClick={handleTestConfirmation}
              disabled={isTesting}
              className="inline-flex items-center space-x-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold cursor-pointer transition-colors shadow-xs disabled:opacity-50 shrink-0"
            >
              <Zap className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin' : ''}`} />
              <span>{isTesting ? 'Confirming...' : `Test Confirmation (${selectedTarget.toUpperCase()})`}</span>
            </button>
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
          <a
            href={masterSheetUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center space-x-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
          >
            <span>Open Google Sheet ↗</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-xs"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
