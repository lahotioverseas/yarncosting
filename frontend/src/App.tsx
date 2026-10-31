import React, { useState, useEffect, useCallback } from 'react';
import { api } from './lib/api';
import { FxRateMaster, UserProfile, DailyPricingStatus } from './types';
import { Header } from './components/Header';
import { ThreePanelCostingView } from './components/ThreePanelCostingView';
import { LoginPage } from './components/LoginPage';
import { MidnightUpdatePromptModal } from './components/MidnightUpdatePromptModal';
import { GoogleSheetConfigModal } from './components/GoogleSheetConfigModal';
import { MongoManagerModal } from './components/MongoManagerModal';
import { GoogleSheetButtonModal } from './components/GoogleSheetButtonModal';

import { getStoredUser, setStoredUser } from './lib/authData';
import { fetchDailyPricing, getTodayDateStringIST, getMsUntilMidnightIST } from './lib/dailyPricingClient';

export default function App() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(() => {
    // If user already logged in previously, restore session; otherwise default to null (shows Login page)
    return getStoredUser();
  });


  // Track unique login session token to ensure fresh quotes and empty basket on every login/switch
  const [loginSessionId, setLoginSessionId] = useState<string>(() => `session_${Date.now()}`);

  const [fxRates, setFxRates] = useState<FxRateMaster[]>([]);
  const [isRefreshingFx, setIsRefreshingFx] = useState(false);

  // Daily Pricing state & Excel Spreadsheet modal - Initialize from cached status if valid for today
  const [dailyPricingStatus, setDailyPricingStatus] = useState<DailyPricingStatus | null>(() => {
    try {
      const cached = localStorage.getItem('lahoti_daily_pricing_cache_v1');
      if (cached) {
        const parsed = JSON.parse(cached);
        const todayStr = getTodayDateStringIST();
        if (parsed && parsed.status) {
          const isConfirmed = Boolean(parsed.status.lastConfirmedDate && parsed.status.lastConfirmedDate === todayStr);
          return {
            ...parsed.status,
            todayDate: todayStr,
            isConfirmedForToday: isConfirmed,
          };
        }
      }
    } catch {}
    return {
      isConfirmedForToday: false, // Default to locked until verified by server
      todayDate: getTodayDateStringIST(),
      lastConfirmedDate: null,
      lastConfirmedAt: null,
      lastConfirmedBy: null,
      confirmationType: null,
      totalYarnProducts: 90,
      totalFobLocations: 12,
      totalFreightDestinations: 21,
    };
  });

  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [excelInitialTab, setExcelInitialTab] = useState<'yarn' | 'fob' | 'freight'>('yarn');
  const [isMidnightPromptOpen, setIsMidnightPromptOpen] = useState(false);
  const [isGoogleSheetConfigOpen, setIsGoogleSheetConfigOpen] = useState(false);
  const [isMongoModalOpen, setIsMongoModalOpen] = useState(false);
  const [isGoogleSheetButtonModalOpen, setIsGoogleSheetButtonModalOpen] = useState(false);
  const [sheetConfirmedBanner, setSheetConfirmedBanner] = useState<string | null>(null);
  const [hasDismissedPrompt, setHasDismissedPrompt] = useState(false);

  const handleOpenExcelPricing = useCallback((tab: 'yarn' | 'fob' | 'freight' = 'yarn') => {
    if (currentUser?.role !== 'admin') {
      return;
    }
    setExcelInitialTab(tab);
    setIsExcelModalOpen(true);
  }, [currentUser]);


  // Load daily pricing status
  const loadDailyPricingStatus = useCallback(async () => {
    try {
      const data = await fetchDailyPricing();
      setDailyPricingStatus(data.status);
      if (data.status) {
        if (data.status.isConfirmedForToday) {
          setIsMidnightPromptOpen(false);
        } else if (currentUser?.role === 'admin' && !data.status.isConfirmedForToday && !hasDismissedPrompt) {
          setIsMidnightPromptOpen(true);
        }
      }
      return data.status;
    } catch (e) {
      console.warn('Could not load daily pricing status:', e);
      return null;
    }
  }, [currentUser?.role, hasDismissedPrompt]);

  // Re-check daily pricing status on tab visibility change or window focus
  useEffect(() => {
    const handleTabRevisit = () => {
      if (document.visibilityState === 'visible') {
        loadDailyPricingStatus();
      }
    };

    document.addEventListener('visibilitychange', handleTabRevisit);
    window.addEventListener('focus', handleTabRevisit);

    // Periodic status sync every 15 seconds to keep all employee browsers synchronized
    const pollInterval = setInterval(() => {
      if (document.visibilityState === 'visible') {
        loadDailyPricingStatus();
      }
    }, 15000);

    return () => {
      document.removeEventListener('visibilitychange', handleTabRevisit);
      window.removeEventListener('focus', handleTabRevisit);
      clearInterval(pollInterval);
    };
  }, [loadDailyPricingStatus]);

  useEffect(() => {
    loadDailyPricingStatus();

    const onPricingUpdated = (e: any) => {
      if (e.detail) {
        setDailyPricingStatus(e.detail);
        if (e.detail.isConfirmedForToday) {
          setIsMidnightPromptOpen(false);
          setHasDismissedPrompt(false);
        }
      } else {
        loadDailyPricingStatus();
      }
    };
    window.addEventListener('daily-pricing-updated', onPricingUpdated);
    return () => window.removeEventListener('daily-pricing-updated', onPricingUpdated);
  }, [loadDailyPricingStatus]);

  // Detect Google Sheet return URL parameters (e.g. ?action=confirmed-from-sheet or ?action=confirm-prices)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const action = params.get('action');
    const statusParam = params.get('status');

    if (action === 'confirmed-from-sheet' || statusParam === 'unlocked') {
      setSheetConfirmedBanner("🎉 Confirmed & Unlocked via Google Sheet! Today's prices are active and calculations are unlocked for all employees.");
      loadDailyPricingStatus();
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (action === 'return-from-sheet' || action === 'confirm-prices') {
      // Back from editing the Google Sheet: show the prompt with the "Publish Prices" button.
      // Prices stay locked until a logged-in Admin publishes them.
      setHasDismissedPrompt(false);
      setIsMidnightPromptOpen(true);
      loadDailyPricingStatus();
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [loadDailyPricingStatus]);

  // EXACT 12:00 AM (00:00 IST) Midnight Watcher:
  // Automatically triggers prompt and expires confirmation when the clock strikes 12:00 AM IST.
  useEffect(() => {
    let midnightTimer: any = null;

    const scheduleNextMidnight = () => {
      const msUntilMidnight = getMsUntilMidnightIST();
      const mins = Math.round(msUntilMidnight / 1000 / 60);
      console.log(`⏱️ 12:00 AM IST midnight watcher scheduled in ${mins} minutes (${msUntilMidnight} ms)`);
      
      midnightTimer = setTimeout(async () => {
        console.log('🕛 12:00 AM IST Midnight arrived! Triggering daily price update prompt...');
        setHasDismissedPrompt(false);
        const newStatus = await loadDailyPricingStatus();
        if (currentUser?.role === 'admin') {
          setIsMidnightPromptOpen(true);
        }
        // Reschedule for following midnight
        scheduleNextMidnight();
      }, msUntilMidnight);
    };

    scheduleNextMidnight();

    // Run a check every 60s to catch machine wake from sleep or date change
    let lastCheckedDateIST = getTodayDateStringIST();
    const intervalCheck = setInterval(() => {
      const currentTodayIST = getTodayDateStringIST();
      if (lastCheckedDateIST !== currentTodayIST) {
        console.log('Date rolled over to', currentTodayIST, '- updating status to expired for new day');
        lastCheckedDateIST = currentTodayIST;
        setHasDismissedPrompt(false);
        loadDailyPricingStatus().then((status) => {
          if (currentUser?.role === 'admin' && status && !status.isConfirmedForToday) {
            setIsMidnightPromptOpen(true);
          }
        });
      }
    }, 60000);

    return () => {
      if (midnightTimer) clearTimeout(midnightTimer);
      clearInterval(intervalCheck);
    };
  }, [loadDailyPricingStatus, currentUser?.role]);

  // 1. Fetch FX Rates and Master Data
  const loadFxRates = useCallback(async () => {
    const { data } = await api.rpc('get_master_data');
    if (data && data.fxRates) {
      setFxRates(data.fxRates);
    }
  }, []);

  useEffect(() => {
    loadFxRates();
  }, [loadFxRates]);

  // 2. Live FX Rates Refresh via RPC
  const handleRefreshFx = useCallback(async () => {
    setIsRefreshingFx(true);
    try {
      const { data } = await api.rpc('refresh_exchange_rates');
      if (data) {
        await loadFxRates();
      }
    } catch (e) {
      console.error('FX Refresh failed:', e);
      await loadFxRates();
    } finally {
      setIsRefreshingFx(false);
    }
  }, [loadFxRates]);

  // Automatically fetch live exchange rates immediately on open / refresh
  useEffect(() => {
    // Immediate initial sync
    handleRefreshFx();

    // Auto-refresh when tab gains focus
    const onFocus = () => {
      handleRefreshFx();
    };
    window.addEventListener('focus', onFocus);

    // Periodic live sync every 2 minutes
    const interval = setInterval(() => {
      handleRefreshFx();
    }, 2 * 60 * 1000);

    return () => {
      window.removeEventListener('focus', onFocus);
      clearInterval(interval);
    };
  }, [handleRefreshFx]);

  const handleLogout = useCallback(() => {
    setStoredUser(null);
    setCurrentUser(null);
    setLoginSessionId(`session_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  }, []);

  // If user is not logged in, show the Login Page
  if (!currentUser) {
    return (
      <LoginPage
        onLoginSuccess={(user) => {
          setCurrentUser(user);
          setLoginSessionId(`session_${user.id}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
        }}
      />
    );
  }

  return (
    <div id="yarn-trading-costing-app" className="min-h-screen bg-slate-50 font-sans text-slate-900 antialiased selection:bg-indigo-500 selection:text-white">
      
      {/* App Header with daily pricing button, view switcher and sign out */}
      <Header
        fxRates={fxRates}
        onRefreshFx={handleRefreshFx}
        isRefreshingFx={isRefreshingFx}
        currentUser={currentUser}
        onLogout={handleLogout}
        onOpenGoogleSheetConfig={() => setIsGoogleSheetConfigOpen(true)}
        onOpenMongoManager={() => setIsMongoModalOpen(true)}
        onOpenGoogleSheetButtonModal={() => setIsGoogleSheetButtonModalOpen(true)}
        dailyPricingStatus={dailyPricingStatus}
        onDailyPricingStatusChange={setDailyPricingStatus}
      />

      {/* Main Content Section */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">

        {/* Celebratory Banner when returning from Google Sheet button */}
        {sheetConfirmedBanner && (
          <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-700 text-white shadow-lg flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top duration-300">
            <div className="flex items-center space-x-3">
              <span className="text-xl">🟢</span>
              <p className="text-xs sm:text-sm font-bold tracking-wide">
                {sheetConfirmedBanner}
              </p>
            </div>
            <button
              onClick={() => setSheetConfirmedBanner(null)}
              className="px-3 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg text-xs font-bold transition-colors cursor-pointer shrink-0"
            >
              Dismiss
            </button>
          </div>
        )}

        <ThreePanelCostingView
          key={loginSessionId}
          loginSessionId={loginSessionId}
          fxRates={fxRates}
          onRefreshFxHeader={handleRefreshFx}
          currentUser={currentUser}
          dailyPricingStatus={dailyPricingStatus}
          onDailyPricingStatusChange={setDailyPricingStatus}
          onOpenGoogleSheetButtonModal={() => setIsGoogleSheetButtonModalOpen(true)}
          onOpenGoogleSheetConfig={() => setIsGoogleSheetConfigOpen(true)}
        />
      </main>

      {/* MongoDB Database & Tables Manager Modal */}
      <MongoManagerModal
        isOpen={isMongoModalOpen}
        onClose={() => setIsMongoModalOpen(false)}
      />

      {/* Google Sheet Config & Sync Modal */}
      <GoogleSheetConfigModal
        isOpen={isGoogleSheetConfigOpen}
        onClose={() => setIsGoogleSheetConfigOpen(false)}
        onSyncComplete={(status) => setDailyPricingStatus(status)}
        onOpenSheetButtonModal={() => setIsGoogleSheetButtonModalOpen(true)}
      />

      {/* Google Sheet "Confirm & Return" Button Modal */}
      <GoogleSheetButtonModal
        isOpen={isGoogleSheetButtonModalOpen}
        onClose={() => setIsGoogleSheetButtonModalOpen(false)}
        onConfirmSuccess={() => {
          loadDailyPricingStatus();
          setSheetConfirmedBanner("🎉 Today's prices confirmed and unlocked for all employees across the company!");
        }}
      />

      {/* 12:00 AM Midnight Pricing Update Prompt Modal */}
      {currentUser && (
        <MidnightUpdatePromptModal
          isOpen={isMidnightPromptOpen && !dailyPricingStatus?.isConfirmedForToday}
          onClose={() => {
            setIsMidnightPromptOpen(false);
            setHasDismissedPrompt(true);
          }}
          status={dailyPricingStatus}
          currentUser={currentUser}
          onOpenExcelEditor={() => {
            setIsMidnightPromptOpen(false);
            setIsGoogleSheetConfigOpen(true);
          }}
          onPricingConfirmed={(status) => {
            setDailyPricingStatus(status);
            setIsMidnightPromptOpen(false);
          }}
        />
      )}

    </div>
  );
}
