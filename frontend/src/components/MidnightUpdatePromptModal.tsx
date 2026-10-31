import React, { useState } from 'react';
import { Clock, CheckCircle2, FileSpreadsheet, AlertTriangle, ArrowRight, ShieldAlert, RefreshCw } from 'lucide-react';
import { DailyPricingStatus, UserProfile } from '../types';
import { keepPreviousPricesForToday, startSheetEditing, publishPricesFromGoogleSheet } from '../lib/dailyPricingClient';
import { getSavedGoogleSheetUrls } from '../lib/googleSheetService';
import { getAuthJsonHeaders } from '../lib/authData';
import { SyncPreviewModal, PriceDiffChange } from './SyncPreviewModal';

interface MidnightUpdatePromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: DailyPricingStatus | null;
  currentUser: UserProfile;
  onOpenExcelEditor: () => void;
  onPricingConfirmed: (newStatus: DailyPricingStatus) => void;
}

export const MidnightUpdatePromptModal: React.FC<MidnightUpdatePromptModalProps> = ({
  isOpen,
  onClose,
  status,
  currentUser,
  onOpenExcelEditor,
  onPricingConfirmed,
}) => {
  const [isConfirming, setIsConfirming] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Sync Preview state
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<{
    count: number;
    changes: PriceDiffChange[];
    hasLargeDiff: boolean;
    message: string;
  } | null>(null);

  // Set right after the admin clicks "Edit" so the Publish view shows before the server status round-trip
  const [editStartedHere, setEditStartedHere] = useState(false);

  if (!isOpen) return null;

  const isAdmin = currentUser.role === 'admin';
  const todayDate = status?.todayDate || new Date().toISOString().split('T')[0];
  const isEditing = Boolean(status?.isEditingInSheet) || editStartedHere;
  const masterSheetUrl = getSavedGoogleSheetUrls().yarnViewUrl.split('#')[0].split('?')[0];

  // Option 2: open the Google Sheet in a NEW tab (this tab stays open) and remember that editing started
  const handleEditInGoogleSheet = async () => {
    window.open(masterSheetUrl, '_blank', 'noopener');
    setEditStartedHere(true);
    setErrorMessage(null);
    try {
      await startSheetEditing(currentUser.name);
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not start editing. Please log in again as Admin.');
    }
  };

  const handleKeepYesterdayPrices = async () => {
    setIsConfirming(true);
    setErrorMessage(null);
    try {
      const updated = await keepPreviousPricesForToday(currentUser.name);
      onPricingConfirmed(updated);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to keep yesterday's prices.");
    } finally {
      setIsConfirming(false);
    }
  };

  const handleInitiateSync = async () => {
    setIsConfirming(true);
    setErrorMessage(null);
    try {
      const urls = getSavedGoogleSheetUrls();
      const res = await fetch('/api/google-sheet/preview-sync', {
        method: 'POST',
        headers: getAuthJsonHeaders(),
        body: JSON.stringify({
          yarnCsvUrl: urls.yarnCsvUrl,
          fobCsvUrl: urls.fobCsvUrl,
          freightCsvUrl: urls.freightCsvUrl,
        }),
      });

      const contentType = res.headers.get('content-type') || '';
      let data: any = {};
      if (contentType.includes('application/json')) {
        data = await res.json();
      } else {
        const text = await res.text();
        const preview = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
        data = { success: false, error: res.status === 403 ? 'Unauthorized: Only Admin users can publish daily prices. Please log in as Admin.' : `Server returned HTTP ${res.status}: ${preview || 'Non-JSON'}` };
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
        setErrorMessage(data.error || 'Failed to check Google Sheet preview.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error while checking Google Sheet.');
    } finally {
      setIsConfirming(false);
    }
  };

  const handleConfirmPublishSync = async () => {
    setIsConfirming(true);
    setErrorMessage(null);
    try {
      const { status: newStatus } = await publishPricesFromGoogleSheet(currentUser.name);
      if (newStatus) {
        onPricingConfirmed(newStatus);
      }
      setEditStartedHere(false);
      setIsPreviewOpen(false);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Network error while publishing prices from Google Sheet.');
      setIsPreviewOpen(false);
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-200">
        <div className="min-h-full flex items-center justify-center py-4 sm:py-6">
          <div className="bg-white rounded-2xl shadow-2xl border border-amber-300 max-w-lg w-full overflow-hidden font-sans flex flex-col my-auto">
            
            {/* Header Ribbon */}
            <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-yellow-600 px-5 py-3.5 sm:px-6 sm:py-4 text-white flex items-center justify-between shadow-md shrink-0">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-amber-700/60 rounded-xl border border-amber-400/40 shrink-0">
                  <Clock className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-200 animate-pulse" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black tracking-tight flex items-center gap-2">
                    <span>12:00 AM Daily Pricing Update</span>
                    <span className="text-[10px] bg-yellow-300 text-amber-950 font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider">
                      New Day
                    </span>
                  </h2>
                  <p className="text-xs text-amber-100 font-medium">
                    Mandatory daily rate confirmation • {todayDate}
                  </p>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-5 sm:p-6 space-y-3.5 sm:space-y-4 overflow-y-auto max-h-[calc(88vh-75px)]">
            
            <div className="flex items-start space-x-3 bg-amber-50/90 border border-amber-200 rounded-xl p-3.5 text-amber-950">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed">
                <p className="font-bold text-amber-900">
                  Current prices preserved on the sheet
                </p>
                <p className="text-slate-600 mt-1">
                  At 12:00 AM (00:00 IST), pricing expired for the new trading day. All your existing yarn prices, FOB rates, and freight values remain intact.
                </p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-700 space-y-1.5">
              <div className="flex justify-between items-center text-slate-500">
                <span>Total Yarn Products:</span>
                <span className="font-bold font-mono text-slate-800">{status?.totalYarnProducts || 90} counts</span>
              </div>
              <div className="flex justify-between items-center text-slate-500">
                <span>FOB Locations:</span>
                <span className="font-bold font-mono text-slate-800">{status?.totalFobLocations || 12} ports</span>
              </div>
              <div className="flex justify-between items-center text-slate-500">
                <span>Freight Routes:</span>
                <span className="font-bold font-mono text-slate-800">{status?.totalFreightDestinations || 21} destinations</span>
              </div>
            </div>

            {errorMessage && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3.5 rounded-xl text-xs font-semibold leading-relaxed">
                {errorMessage}
              </div>
            )}

            {isAdmin && isEditing ? (
              <div className="pt-2 space-y-3">
                {/* Editing in Google Sheet: simple 3 steps, then one big Publish button */}
                <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3.5 text-xs text-indigo-950 space-y-1.5">
                  <p className="font-bold text-indigo-900">Editing prices in Google Sheet</p>
                  <p>1. Change the prices in the Google Sheet tab (it saves by itself).</p>
                  <p>2. Come back to this Costing page (this tab).</p>
                  <p>3. Click <strong>Publish Prices</strong> below. Prices stay locked until you do.</p>
                </div>

                <button
                  id="btn-publish-prices-modal"
                  type="button"
                  onClick={handleInitiateSync}
                  disabled={isConfirming}
                  className="w-full flex items-center justify-between px-4 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all cursor-pointer border border-emerald-700 group disabled:opacity-50"
                >
                  <div className="flex items-center space-x-3 text-left">
                    <div className="p-1.5 bg-emerald-700/80 rounded-lg">
                      <RefreshCw className={`w-5 h-5 text-emerald-200 ${isConfirming ? 'animate-spin' : ''}`} />
                    </div>
                    <div>
                      <div className="leading-tight">{isConfirming ? 'Checking Google Sheet...' : 'Publish Prices'}</div>
                      <div className="text-[11px] font-normal text-emerald-100">
                        Read the edited Google Sheet and unlock today&apos;s prices for everyone
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>

                <a
                  href={masterSheetUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full flex items-center justify-between px-4 py-3.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 rounded-xl font-bold text-sm border border-indigo-200 transition-all cursor-pointer group"
                >
                  <div className="flex items-center space-x-3 text-left">
                    <div className="p-1.5 bg-indigo-200/80 rounded-lg">
                      <FileSpreadsheet className="w-5 h-5 text-indigo-700" />
                    </div>
                    <div>
                      <div className="leading-tight">Open Google Sheet Again ↗</div>
                      <div className="text-[11px] font-normal text-indigo-600">
                        Closed the sheet by mistake? Open it here
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-indigo-500 group-hover:translate-x-1 transition-transform" />
                </a>

                <button
                  type="button"
                  onClick={handleKeepYesterdayPrices}
                  disabled={isConfirming}
                  className="w-full text-center text-xs text-slate-500 hover:text-slate-800 font-medium py-1 cursor-pointer underline disabled:opacity-50"
                >
                  No changes needed? Keep yesterday&apos;s prices instead
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full text-center text-xs text-slate-500 hover:text-slate-800 font-medium py-1 cursor-pointer underline"
                >
                  Cancel
                </button>
              </div>
            ) : isAdmin ? (
              <div className="pt-2 space-y-3">
                <p className="text-xs font-semibold text-slate-700">
                  Choose how you would like to proceed for today ({todayDate}):
                </p>

                {/* Option 1: Keep Yesterday's Prices */}
                <button
                  type="button"
                  onClick={handleKeepYesterdayPrices}
                  disabled={isConfirming}
                  className="w-full flex items-center justify-between px-4 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all cursor-pointer border border-emerald-700 group disabled:opacity-50"
                >
                  <div className="flex items-center space-x-3 text-left">
                    <div className="p-1.5 bg-emerald-700/80 rounded-lg">
                      <CheckCircle2 className="w-5 h-5 text-emerald-200" />
                    </div>
                    <div>
                      <div className="leading-tight">Keep Yesterday&apos;s Prices</div>
                      <div className="text-[11px] font-normal text-emerald-100">
                        Confirm stored server prices active for today with 1-click
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </button>

                {/* Option 2: Edit (Open Google Sheet in a new tab; this page then shows "Publish Prices") */}
                <button
                  id="btn-edit-google-sheet-modal"
                  type="button"
                  onClick={handleEditInGoogleSheet}
                  disabled={isConfirming}
                  className="w-full flex items-center justify-between px-4 py-3.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-900 rounded-xl font-bold text-sm border border-indigo-200 transition-all cursor-pointer group disabled:opacity-50"
                >
                  <div className="flex items-center space-x-3 text-left">
                    <div className="p-1.5 bg-indigo-200/80 rounded-lg">
                      <FileSpreadsheet className="w-5 h-5 text-indigo-700" />
                    </div>
                    <div>
                      <div className="leading-tight">Edit (Open Google Sheet) ↗</div>
                      <div className="text-[11px] font-normal text-indigo-600">
                        Edit prices in Google Sheet, then come back here and click Publish Prices
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-indigo-500 group-hover:translate-x-1 transition-transform" />
                </button>

                <button
                  type="button"
                  onClick={onClose}
                  className="w-full text-center text-xs text-slate-500 hover:text-slate-800 font-medium py-2 cursor-pointer underline"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <div className="bg-slate-100 p-4 rounded-xl text-center space-y-2">
                <ShieldAlert className="w-6 h-6 text-slate-500 mx-auto" />
                <p className="text-xs text-slate-600">
                  Rates expired at 12:00 AM. Please wait for an Admin to verify and approve pricing for today ({todayDate}).
                </p>
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Understood
                </button>
              </div>
            )}

          </div>

        </div>
      </div>
    </div>

    {previewData && (
      <SyncPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        onConfirmPublish={handleConfirmPublishSync}
        isPublishing={isConfirming}
        count={previewData.count}
        changes={previewData.changes}
        hasLargeDiff={previewData.hasLargeDiff}
        message={previewData.message}
      />
    )}
  </>
  );
};
