import React from 'react';
import { RefreshCw, LogOut, FileSpreadsheet, ExternalLink, Calculator, Sparkles, Flame, Users, Database } from 'lucide-react';
import { FxRateMaster, UserProfile, DailyPricingStatus } from '../types';
import { formatINR, formatDate } from '../utils/formatters';
import { lahotiOverseasLogo } from '../image/logo';
import { getSavedGoogleSheetUrls, invalidateAllSheetCaches } from '../lib/googleSheetService';


interface HeaderProps {
  fxRates: FxRateMaster[];
  onRefreshFx: () => void;
  isRefreshingFx: boolean;
  currentUser: UserProfile | null;
  onLogout: () => void;
  onOpenExcelPricing?: (tab?: 'yarn' | 'fob' | 'freight') => void;
  onOpenGoogleSheetConfig?: () => void;
  onOpenMongoManager?: () => void;
  onOpenGoogleSheetButtonModal?: () => void;
  dailyPricingStatus?: DailyPricingStatus | null;
  onDailyPricingStatusChange?: (status: DailyPricingStatus) => void;
}

export const Header: React.FC<HeaderProps> = ({
  fxRates,
  onRefreshFx,
  isRefreshingFx,
  currentUser,
  onLogout,
  onOpenExcelPricing,
  onOpenGoogleSheetConfig,
  onOpenMongoManager,
  onOpenGoogleSheetButtonModal,
  dailyPricingStatus,
  onDailyPricingStatusChange,
}) => {
  const usdFx = fxRates.find((f) => f.currency_pair === 'USD_INR');
  const eurFx = fxRates.find((f) => f.currency_pair === 'EUR_INR');

const todayStr = formatDate(new Date().toISOString());
  const rateDate = usdFx?.rate_date || todayStr;

  return (
    <header id="app-header" className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          
          {/* Main Title and Ticker */}
          <div className="flex items-center space-x-3.5">
            <div className="bg-white rounded-md p-1.5 flex items-center justify-center shadow-sm shrink-0 border border-slate-700">
              <img
                src={lahotiOverseasLogo}
                alt="Lahoti Overseas Logo"
                className="h-9 w-auto max-w-[130px] object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h1 className="text-lg sm:text-xl font-black tracking-wider text-white uppercase font-sans">
                  LAHOTI OVERSEAS
                </h1>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-300 mt-1 font-mono">
                <div>
                  <span className="text-slate-500 font-sans">Date: </span>
                  <span className="font-semibold text-slate-200">{todayStr}</span>
                </div>
                <div className="h-3 w-px bg-slate-700"></div>
                <div>
                  <span className="text-slate-500 font-sans">USD/INR: </span>
                  <span className="font-bold text-emerald-400">
                    {usdFx ? formatINR(usdFx.rate ?? usdFx.effective_rate) : '₹—'}
                  </span>
                </div>
                <div className="h-3 w-px bg-slate-700"></div>
                <div>
                  <span className="text-slate-500 font-sans">EUR/INR: </span>
                  <span className="font-bold text-emerald-400">
                    {eurFx ? formatINR(eurFx.rate ?? eurFx.effective_rate) : '₹—'}
                  </span>
                </div>
                <button
                  id="refresh-rates-btn"
                  onClick={onRefreshFx}
                  disabled={isRefreshingFx}
                  className="inline-flex items-center space-x-1 px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-sans font-medium rounded border border-slate-700 transition-colors disabled:opacity-50 cursor-pointer"
                  title="Fetch exact market exchange rates of today"
                >
                  <RefreshCw className={`w-3 h-3 ${isRefreshingFx ? 'animate-spin text-indigo-400' : ''}`} />
                  <span>Refresh</span>
                </button>
              </div>

              <p className="text-[11px] text-slate-400 mt-0.5 font-sans">
                Rates as of {rateDate}
              </p>
            </div>
          </div>

          {/* Header Action Controls */}
            <div className="flex flex-wrap items-center gap-2.5 self-end md:self-center">
              {/* Google Sheet Return Button Setup Modal */}
              {onOpenGoogleSheetButtonModal && (
                <button
                  type="button"
                  id="btn-header-sheet-button"
                  onClick={onOpenGoogleSheetButtonModal}
                  className="inline-flex items-center space-x-1.5 px-3 py-2 bg-slate-800 hover:bg-emerald-950/50 hover:text-emerald-300 text-slate-200 border border-slate-700 hover:border-emerald-500/50 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-xs"
                  title="Get 'Confirm & Return' Formula / Button for Google Sheet"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                  <span>Sheet Button</span>
                </button>
              )}

              {/* MongoDB Database Button */}
              {onOpenMongoManager && (
                <button
                  type="button"
                  id="btn-header-mongo"
                  onClick={onOpenMongoManager}
                  className="inline-flex items-center space-x-2 px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 hover:border-emerald-500/50 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-xs"
                  title="MongoDB Database & Tables Manager"
                >
                  <Database className="w-4 h-4 text-emerald-400" />
                  <span>MongoDB</span>
                </button>
              )}

              {/* Sign Out Button */}
              <button
                type="button"
                id="btn-header-signout"
                onClick={onLogout}
                className="inline-flex items-center space-x-2 px-3.5 py-2 bg-slate-800 hover:bg-rose-950/60 hover:text-rose-300 text-slate-300 border border-slate-700 hover:border-rose-700/60 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-xs"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
                <span>Sign Out</span>
              </button>
            </div>

        </div>
      </div>
    </header>
  );
};
