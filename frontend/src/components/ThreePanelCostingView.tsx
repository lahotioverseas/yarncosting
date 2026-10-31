import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { api } from '../lib/api';
import { formatINR, formatUSD, formatDecimal4, formatFclAmount, formatPercent, formatDate } from '../utils/formatters';
import {
  FxRateMaster,
  YarnProductSheetRecord,
  GoogleSheetFetchResult,
  FobSheetRecord,
  FobSheetFetchResult,
  FobLookupResult,
  FreightSheetRecord,
  FreightSheetFetchResult,
  FreightLookupResult,
  ZohoAccountItem,
  UserProfile,
  CommissionType,
} from '../types';
import {
  fetchGoogleSheetYarnProducts,
  fetchGoogleSheetFobPrices,
  fetchGoogleSheetFreightRates,
  findFobForFactoryLocation,
  findFreightForDestination,
  searchYarnCounts,
  getQualitiesForCount,
  findMatchingRow,
  invalidateAllSheetCaches,
  getSavedGoogleSheetUrls,
  addNewDestinationPort,
  addNewFobLocation,
  addNewYarnProduct,
  GOOGLE_SHEET_URL,
  GOOGLE_FOB_SHEET_URL,
  GOOGLE_FREIGHT_SHEET_URL,
} from '../lib/googleSheetService';
import { getMarginTermsForDestination } from '../lib/rpcHandlers';
import { ZohoQuoteSection } from './ZohoQuoteSection';
import { FALLBACK_ZOHO_ACCOUNTS } from '../lib/zohoFallbackData';
import { DEFAULT_PRICING_SNAPSHOT } from '../lib/dailyPricingSnapshot';

const initialYarnRecords: YarnProductSheetRecord[] = (DEFAULT_PRICING_SNAPSHOT.sheets?.yarn?.rows || []).map((r: any, idx: number) => ({
  yarnCount: String(r.yarnCount || '').trim(),
  quality: String(r.quality || '').trim(),
  category: String(r.category || 'General').trim(),
  exMillPrice: r.exMillPrice !== null && r.exMillPrice !== undefined && r.exMillPrice !== '' ? Number(r.exMillPrice) : null,
  factoryLocation: String(r.factoryLocation || 'Factory Location not available.').trim(),
  rawRow: idx + 1,
}));

const initialFobRecords: FobSheetRecord[] = (DEFAULT_PRICING_SNAPSHOT.sheets?.fob?.rows || []).map((r: any, idx: number) => ({
  location: String(r.location || '').trim(),
  price: r.price !== null && r.price !== undefined && r.price !== '' ? Number(r.price) : null,
  rawRow: idx + 1,
}));

const initialFreightRecords: FreightSheetRecord[] = (DEFAULT_PRICING_SNAPSHOT.sheets?.freight?.rows || []).map((r: any, idx: number) => ({
  destination: String(r.destination || '').trim(),
  amount: r.amount !== null && r.amount !== undefined && r.amount !== '' ? Number(r.amount) : null,
  rawRow: idx + 1,
}));

const initialDestinations: string[] = Array.from(new Set(initialFreightRecords.map((r) => r.destination).filter(Boolean)));
const initialFobLocations: string[] = Array.from(new Set(initialFobRecords.map((r) => r.location).filter(Boolean)));
import {
  RefreshCw,
  Calculator,
  ArrowRight,
  ShieldAlert,
  Search,
  Check,
  X,
  Building2,
  FileSpreadsheet,
  AlertTriangle,
  ExternalLink,
  ChevronDown,
  MapPin,
  Link2,
  Ship,
  Globe,
  UserCheck,
  Users,
  Lock,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';
import { keepPreviousPricesForToday, startSheetEditing, publishPricesFromGoogleSheet } from '../lib/dailyPricingClient';
import { DailyPricingStatus } from '../types';

interface ThreePanelCostingViewProps {
  fxRates?: FxRateMaster[];
  onRefreshFxHeader?: () => void;
  currentUser?: UserProfile | null;
  dailyPricingStatus?: DailyPricingStatus | null;
  onOpenExcelPricing?: (tab?: 'yarn' | 'fob' | 'freight') => void;
  onDailyPricingStatusChange?: (status: DailyPricingStatus) => void;
  onOpenGoogleSheetButtonModal?: () => void;
  onOpenGoogleSheetConfig?: () => void;
  loginSessionId?: string;
}

export const ThreePanelCostingView: React.FC<ThreePanelCostingViewProps> = ({
  fxRates,
  onRefreshFxHeader,
  currentUser,
  dailyPricingStatus,
  onOpenExcelPricing,
  onDailyPricingStatusChange,
  onOpenGoogleSheetButtonModal,
  onOpenGoogleSheetConfig,
  loginSessionId,
}) => {
  const isAdmin = currentUser?.role === 'admin';
  const isPricingLocked = !dailyPricingStatus?.isConfirmedForToday;
  const productCode = 'COTTON';

  const [isConfirmingPrevious, setIsConfirmingPrevious] = useState<boolean>(false);

  // -------------------------------------------------------------
  // GOOGLE SHEET 3 (FREIGHT RATES) STATE
  // -------------------------------------------------------------
  const [freightSheetRecords, setFreightSheetRecords] = useState<FreightSheetRecord[]>(initialFreightRecords);
  const [freightSheetFetchInfo, setFreightSheetFetchInfo] = useState<FreightSheetFetchResult | null>(null);
  const [isLoadingFreightSheet, setIsLoadingFreightSheet] = useState<boolean>(false);
  const [freightSheetError, setFreightSheetError] = useState<string | null>(null);

  // Freight selection state
  const [selectedOrigin, setSelectedOrigin] = useState<string>('Gujarat');
  const [destinations, setDestinations] = useState<string[]>(initialDestinations);
  const [selectedDestination, setSelectedDestination] = useState<string>('AI Sokhna');

  // -------------------------------------------------------------
  // GOOGLE SHEET 2 (FOB SHEET) STATE
  // -------------------------------------------------------------
  const [fobSheetRecords, setFobSheetRecords] = useState<FobSheetRecord[]>(initialFobRecords);
  const [fobSheetFetchInfo, setFobSheetFetchInfo] = useState<FobSheetFetchResult | null>(null);
  const [fobLocations, setFobLocations] = useState<string[]>(initialFobLocations);
  const [selectedFobLocation, setSelectedFobLocation] = useState<string>('AUTO');
  const [isLoadingFobSheet, setIsLoadingFobSheet] = useState<boolean>(false);
  const [fobSheetError, setFobSheetError] = useState<string | null>(null);

  // Quick Add Destination and FOB Modal State
  const [showAddPortModal, setShowAddPortModal] = useState<boolean>(false);
  const [newPortName, setNewPortName] = useState<string>('');
  const [newPortAmount, setNewPortAmount] = useState<string>('');
  const [isAddingPort, setIsAddingPort] = useState<boolean>(false);

  const [showAddFobModal, setShowAddFobModal] = useState<boolean>(false);
  const [newFobName, setNewFobName] = useState<string>('');
  const [newFobPrice, setNewFobPrice] = useState<string>('');
  const [isAddingFob, setIsAddingFob] = useState<boolean>(false);

  const [showAddProductModal, setShowAddProductModal] = useState<boolean>(false);
  const [newProductCount, setNewProductCount] = useState<string>('');
  const [newProductQuality, setNewProductQuality] = useState<string>('');
  const [newProductPrice, setNewProductPrice] = useState<string>('');
  const [newProductLocation, setNewProductLocation] = useState<string>('');
  const [isAddingProduct, setIsAddingProduct] = useState<boolean>(false);

  // Ex-Mill & Options state
  const [quantityOptions, setQuantityOptions] = useState<Array<{
    id: number;
    packing_type: string;
    qty_per_fcl: number;
    is_default: boolean;
  }>>([]);
  const [selectedQty, setSelectedQty] = useState<number>(21000);

  const [selectedMarginCode, setSelectedMarginCode] = useState<string>('LC_SIGHT');

  // Compute margin terms dynamically based on selected destination port
  const marginTerms = useMemo(() => {
    return getMarginTermsForDestination(selectedDestination);
  }, [selectedDestination]);

  useEffect(() => {
    if (marginTerms.length > 0) {
      const exists = marginTerms.some(m => m.term_code === selectedMarginCode);
      if (!exists) {
        const def = marginTerms.find(m => m.is_default) || marginTerms[0];
        if (def) setSelectedMarginCode(def.term_code);
      }
    }
  }, [marginTerms, selectedMarginCode]);

  const [bciOrg, setBciOrg] = useState<number>(0.00);

  // -------------------------------------------------------------
  // DYNAMIC GOOGLE SHEET 1 YARN LOOKUP STATE
  // -------------------------------------------------------------
  const [sheetRecords, setSheetRecords] = useState<YarnProductSheetRecord[]>(initialYarnRecords);
  const [sheetFetchInfo, setSheetFetchInfo] = useState<GoogleSheetFetchResult | null>(null);
  const [isLoadingSheet, setIsLoadingSheet] = useState<boolean>(false);
  const [sheetError, setSheetError] = useState<string | null>(null);

  // Unified Product Search & Dropdown State
  const [productSearchInput, setProductSearchInput] = useState<string>('NE 32/1 KW');
  const [selectedYarnCount, setSelectedYarnCount] = useState<string>('NE 32/1');
  const [selectedQuality, setSelectedQuality] = useState<string>('KW');
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState<boolean>(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const productInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const selectedYarnCountRef = useRef(selectedYarnCount);
  const selectedQualityRef = useRef(selectedQuality);

  useEffect(() => {
    selectedYarnCountRef.current = selectedYarnCount;
    selectedQualityRef.current = selectedQuality;
  }, [selectedYarnCount, selectedQuality]);

  // Dynamic Matched Record
  const [matchedRecord, setMatchedRecord] = useState<YarnProductSheetRecord | null>(null);
  const [exMillPrice, setExMillPrice] = useState<number>(294.00);
  const [factoryLocation, setFactoryLocation] = useState<string>('Guntur');
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // RPC Calculation Results
  const [calcResults, setCalcResults] = useState<any>(null);
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Commission State (% or USD/kg)
  const [commissionType, setCommissionType] = useState<CommissionType>('PCT');
  const [commissionValue, setCommissionValue] = useState<number>(0.00);
  const [commissionInputStr, setCommissionInputStr] = useState<string>('');

  // Switch Commission Type between % and USD/kg
  const handleCommissionTypeChange = useCallback((newType: CommissionType) => {
    if (newType === commissionType) return;
    setCommissionType(newType);
  }, [commissionType]);

  // -------------------------------------------------------------
  // ZOHO CRM CLIENT & AGENT ACCOUNTS STATE
  // -------------------------------------------------------------
  const [customerName, setCustomerName] = useState<string>('');
  const [agentName, setAgentName] = useState<string>('');
  const [zohoAccounts, setZohoAccounts] = useState<ZohoAccountItem[]>(() => {
    try {
      const cached = localStorage.getItem('lahoti_zoho_accounts_v3');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {}
    return FALLBACK_ZOHO_ACCOUNTS;
  });
  const [isZohoConnected, setIsZohoConnected] = useState<boolean>(true);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState<boolean>(false);
  const [zohoError, setZohoError] = useState<string | null>(null);

  // Fetch Zoho Accounts & Agents on mount with robust content-type validation & retry
  const fetchZohoAccounts = useCallback(async (retryCount = 0) => {
    setIsLoadingAccounts(true);
    setZohoError(null);
    try {
      const res = await fetch('/api/zoho/accounts-and-agents');
      const contentType = res.headers.get('content-type') || '';
      
      // If server is warming up or returning HTML error/fallback page, avoid calling res.json()
      if (!res.ok || !contentType.includes('application/json')) {
        if (retryCount < 2) {
          setTimeout(() => fetchZohoAccounts(retryCount + 1), 1200);
          return;
        }
        return;
      }

      const data = await res.json();
      if (data && Array.isArray(data.items) && data.items.length > 0) {
        setZohoAccounts(data.items);
        try {
          localStorage.setItem('lahoti_zoho_accounts_v3', JSON.stringify(data.items));
        } catch (e) {}
        setIsZohoConnected(data.is_connected ?? true);
        if (data.error) {
          setZohoError(data.error);
        }
      }
    } catch (err: any) {
      console.warn('Zoho accounts fetch warning:', err?.message || err);
    } finally {
      setIsLoadingAccounts(false);
    }
  }, []);

  useEffect(() => {
    fetchZohoAccounts();
  }, [fetchZohoAccounts]);

  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [agentSearch, setAgentSearch] = useState<string>('');
  const [showCustomerDropdown, setShowCustomerDropdown] = useState<boolean>(false);
  const [showAgentDropdown, setShowAgentDropdown] = useState<boolean>(false);

  // Clear customer and agent selection on login / user switch
  useEffect(() => {
    setCustomerName('');
    setAgentName('');
    setCustomerSearch('');
    setAgentSearch('');
  }, [loginSessionId, currentUser?.id]);

  const customerDropdownRef = useRef<HTMLDivElement>(null);
  const agentDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (customerDropdownRef.current && !customerDropdownRef.current.contains(e.target as Node)) {
        setShowCustomerDropdown(false);
      }
      if (agentDropdownRef.current && !agentDropdownRef.current.contains(e.target as Node)) {
        setShowAgentDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtered lists: Customers (Accounts module only) and Agents (Agent/Vendor)
  const [filterMyAccountsOnly, setFilterMyAccountsOnly] = useState<boolean>(true);
  // Non-admin employees are strictly locked to their own accounts
  const effectiveFilterMyAccounts = isAdmin ? filterMyAccountsOnly : true;

  // Matcher for account ownership
  const isAccountOwnedByUser = useCallback((item: ZohoAccountItem, user?: UserProfile | null) => {
    if (!user) return true;
    if (!item.owner_name && !item.owner_email) {
      return false; // If no owner assigned, don't show when filtered to user
    }
    const uName = user.name.toLowerCase().trim();
    const uEmail = user.email.toLowerCase().trim();
    const uFirst = uName.split(' ')[0];

    const itemOwnerName = (item.owner_name || '').toLowerCase().trim();
    const itemOwnerEmail = (item.owner_email || '').toLowerCase().trim();

    if (itemOwnerEmail && uEmail && itemOwnerEmail === uEmail) return true;
    if (itemOwnerName && itemOwnerName === uName) return true;
    if (itemOwnerName && (itemOwnerName.includes(uName) || uName.includes(itemOwnerName))) return true;
    if (uFirst.length >= 3 && itemOwnerName.includes(uFirst)) return true;

    return false;
  }, []);

  // Filtered lists: Customers strictly from Accounts module
  const filteredCustomers = useMemo(() => {
    let customersOnly = zohoAccounts.filter(acc => acc.type === 'Account');
    if (effectiveFilterMyAccounts && currentUser) {
      customersOnly = customersOnly.filter(acc => isAccountOwnedByUser(acc, currentUser));
    }
    if (!customerSearch.trim()) return customersOnly;
    const q = customerSearch.toLowerCase().trim();
    return customersOnly.filter(acc => 
      acc.name.toLowerCase().includes(q) || 
      (acc.contact_name && acc.contact_name.toLowerCase().includes(q)) ||
      (acc.owner_name && acc.owner_name.toLowerCase().includes(q))
    );
  }, [zohoAccounts, customerSearch, effectiveFilterMyAccounts, currentUser, isAccountOwnedByUser]);

  const filteredAgents = useMemo(() => {
    let agentsOnly = zohoAccounts.filter(acc => acc.type === 'Agent' || acc.type === 'Vendor');
    if (effectiveFilterMyAccounts && currentUser) {
      agentsOnly = agentsOnly.filter(acc => isAccountOwnedByUser(acc, currentUser));
    }
    if (!agentSearch.trim()) return agentsOnly;
    const q = agentSearch.toLowerCase().trim();
    return agentsOnly.filter(acc => 
      acc.name.toLowerCase().includes(q) || 
      (acc.owner_name && acc.owner_name.toLowerCase().includes(q))
    );
  }, [zohoAccounts, agentSearch, effectiveFilterMyAccounts, currentUser, isAccountOwnedByUser]);

  // 1. Fetch Google Sheet 1 Yarn Data
  const loadGoogleSheetData = useCallback(async (forceRefresh = false) => {
    setIsLoadingSheet(true);
    setSheetError(null);
    try {
      const data = await fetchGoogleSheetYarnProducts(forceRefresh);
      setSheetFetchInfo(data);
      setSheetRecords(data.records);
      if (data.dailyPricingStatus && onDailyPricingStatusChange) {
        onDailyPricingStatusChange(data.dailyPricingStatus);
      }

      if (data.records.length > 0) {
        const curCount = selectedYarnCountRef.current;
        const curQual = selectedQualityRef.current;

        const currentExists = curCount && curQual && data.records.some(
          (r) => r.yarnCount.toUpperCase() === curCount.toUpperCase() &&
                 r.quality.toUpperCase() === curQual.toUpperCase()
        );

        if (!curCount || !curQual || !currentExists) {
          const defaultRec = data.records.find((r) => r.exMillPrice !== null && r.exMillPrice > 0) || data.records[0];
          setSelectedYarnCount(defaultRec.yarnCount);
          setSelectedQuality(defaultRec.quality);
          setProductSearchInput(`${defaultRec.yarnCount} ${defaultRec.quality}`);
          setMatchedRecord(defaultRec);
          setExMillPrice(defaultRec.exMillPrice || 0);
          setFactoryLocation(defaultRec.factoryLocation || 'Factory Location not available.');
        } else {
          // Keep user's selection, but update price/location in real time if sheet updated
          const updatedMatch = data.records.find(
            (r) => r.yarnCount.toUpperCase() === curCount.toUpperCase() &&
                   r.quality.toUpperCase() === curQual.toUpperCase()
          );
          if (updatedMatch) {
            setMatchedRecord(updatedMatch);
            setExMillPrice(updatedMatch.exMillPrice || 0);
            setFactoryLocation(updatedMatch.factoryLocation || 'Factory Location not available.');
          }
        }
      }
    } catch (err: any) {
      console.error('Failed to load Google Sheet data:', err);
      setSheetError(err.message || 'Failed to fetch Google Sheet data');
    } finally {
      setIsLoadingSheet(false);
    }
  }, [onDailyPricingStatusChange]);

  // Filtered products for unified search dropdown (showing all products from sheet)
  const filteredProducts = useMemo(() => {
    if (!productSearchInput.trim()) return sheetRecords;
    const query = productSearchInput.toLowerCase().trim();
    return sheetRecords.filter((r) => {
      const combined = `${r.yarnCount} ${r.quality}`.toLowerCase();
      return (
        combined.includes(query) ||
        r.yarnCount.toLowerCase().includes(query) ||
        r.quality.toLowerCase().includes(query) ||
        (r.factoryLocation && r.factoryLocation.toLowerCase().includes(query))
      );
    });
  }, [sheetRecords, productSearchInput]);

  const handleSelectProduct = (record: YarnProductSheetRecord) => {
    setSelectedYarnCount(record.yarnCount);
    setSelectedQuality(record.quality);
    setMatchedRecord(record);
    setExMillPrice(record.exMillPrice || 0);
    setFactoryLocation(record.factoryLocation || 'Factory Location not available.');
    setProductSearchInput(`${record.yarnCount} ${record.quality}`);
    setIsProductDropdownOpen(false);
    setHighlightedIndex(-1);
  };

  // 2. Fetch Google Sheet 2 (FOB Sheet) Data
  const loadGoogleSheetFobData = useCallback(async (forceRefresh = false) => {
    setIsLoadingFobSheet(true);
    setFobSheetError(null);
    try {
      const data = await fetchGoogleSheetFobPrices(forceRefresh);
      setFobSheetFetchInfo(data);
      setFobSheetRecords(data.records);
      if (data.locations && data.locations.length > 0) {
        setFobLocations(data.locations);
        setSelectedFobLocation((prev) => {
          if (prev !== 'AUTO' && !data.locations.includes(prev)) {
            return 'AUTO';
          }
          return prev;
        });
      }
      if (data.dailyPricingStatus && onDailyPricingStatusChange) {
        onDailyPricingStatusChange(data.dailyPricingStatus);
      }
    } catch (err: any) {
      console.error('Failed to load FOB Google Sheet data:', err);
      setFobSheetError(err.message || 'Failed to fetch FOB Google Sheet data');
    } finally {
      setIsLoadingFobSheet(false);
    }
  }, [onDailyPricingStatusChange]);

  // 3. Fetch Google Sheet 3 (Freight Rates Sheet) Data
  const loadGoogleSheetFreightData = useCallback(async (forceRefresh = false) => {
    setIsLoadingFreightSheet(true);
    setFreightSheetError(null);
    try {
      const data = await fetchGoogleSheetFreightRates(forceRefresh);
      setFreightSheetFetchInfo(data);
      setFreightSheetRecords(data.records);
      if (data.dailyPricingStatus && onDailyPricingStatusChange) {
        onDailyPricingStatusChange(data.dailyPricingStatus);
      }
      if (data.destinations && data.destinations.length > 0) {
        setDestinations(data.destinations);
        if (!selectedDestination || !data.destinations.includes(selectedDestination)) {
          // Default to AI Sokhna or first destination with valid price
          const preferred =
            data.destinations.find((d) => d.toUpperCase().includes('SOKHNA')) ||
            data.records.find((r) => r.amount !== null && r.amount > 0)?.destination ||
            data.destinations[0];
          setSelectedDestination(preferred);
        }
      }
    } catch (err: any) {
      console.error('Failed to load Freight Google Sheet data:', err);
      setFreightSheetError(err.message || 'Failed to fetch Freight Google Sheet data');
    } finally {
      setIsLoadingFreightSheet(false);
    }
  }, [selectedDestination, onDailyPricingStatusChange]);

  // Combined refresh of all 3 sheets
  const handleRefreshAllSheets = useCallback(async () => {
    invalidateAllSheetCaches();
    await Promise.all([
      loadGoogleSheetData(true),
      loadGoogleSheetFobData(true),
      loadGoogleSheetFreightData(true),
    ]);
  }, [loadGoogleSheetData, loadGoogleSheetFobData, loadGoogleSheetFreightData]);

  // Handle keep previous prices for today (instant 1-click confirmation)
  const handleKeepPreviousPrices = async () => {
    if (!isAdmin) return;
    setIsConfirmingPrevious(true);
    try {
      invalidateAllSheetCaches();
      const updatedStatus = await keepPreviousPricesForToday(currentUser?.name || 'Admin');
      if (onDailyPricingStatusChange) {
        onDailyPricingStatusChange(updatedStatus);
      }
      await handleRefreshAllSheets();
    } catch (e) {
      console.error('Failed to keep previous prices:', e);
    } finally {
      setIsConfirmingPrevious(false);
    }
  };

  const [isSyncingSheet, setIsSyncingSheet] = useState(false);

  // Sync latest edits from Google Sheets & publish for today
  const handleSyncFromSheet = async () => {
    if (!isAdmin) return;
    setIsSyncingSheet(true);
    try {
      invalidateAllSheetCaches();
      const { status } = await publishPricesFromGoogleSheet(currentUser?.name || 'Admin');
      if (onDailyPricingStatusChange && status) {
        onDailyPricingStatusChange(status);
      }
      await handleRefreshAllSheets();
    } catch (e: any) {
      console.error('Failed to sync from sheet:', e);
      window.alert(e?.message || 'Could not publish prices from Google Sheet. Please try again.');
    } finally {
      setIsSyncingSheet(false);
    }
  };

  // Load all 3 master sheets on initial mount and when daily pricing updates
  useEffect(() => {
    loadGoogleSheetData(false);
    loadGoogleSheetFobData(false);
    loadGoogleSheetFreightData(false);

    // Automatic sync check every 15s to keep dropdowns dynamically in sync with Google Sheets
    const interval = setInterval(() => {
      loadGoogleSheetData(false);
      loadGoogleSheetFobData(false);
      loadGoogleSheetFreightData(false);
    }, 15000);

    const onPricingUpdated = (evt: any) => {
      if (evt?.detail) {
        if (onDailyPricingStatusChange) {
          onDailyPricingStatusChange(evt.detail);
        }
        if (!evt.detail.isConfirmedForToday) {
          setCalcResults(null);
        }
      }
      handleRefreshAllSheets();
    };
    const onTabRevisit = () => {
      if (document.visibilityState === 'visible') {
        invalidateAllSheetCaches();
        loadGoogleSheetData(true);
        loadGoogleSheetFobData(true);
        loadGoogleSheetFreightData(true);
      }
    };

    window.addEventListener('daily-pricing-updated', onPricingUpdated);
    window.addEventListener('focus', onTabRevisit);
    document.addEventListener('visibilitychange', onTabRevisit);

    return () => {
      clearInterval(interval);
      window.removeEventListener('daily-pricing-updated', onPricingUpdated);
      window.removeEventListener('focus', onTabRevisit);
      document.removeEventListener('visibilitychange', onTabRevisit);
    };
  }, [loadGoogleSheetData, loadGoogleSheetFobData, loadGoogleSheetFreightData, handleRefreshAllSheets]);

  // Compute Effective FOB location (either auto-detected from factory location or user-selected from FOB dropdown)
  const effectiveFobLocation = useMemo(() => {
    if (selectedFobLocation && selectedFobLocation !== 'AUTO') {
      return selectedFobLocation;
    }
    return factoryLocation;
  }, [selectedFobLocation, factoryLocation]);

  // Compute FOB Lookup Result reactively from Factory Location & Sheet 2 Records
  const fobLookupResult: FobLookupResult = useMemo(() => {
    return findFobForFactoryLocation(effectiveFobLocation, fobSheetRecords);
  }, [effectiveFobLocation, fobSheetRecords]);

  // Compute Freight Lookup Result reactively from Destination Port & Sheet 3 Records
  const freightLookupResult: FreightLookupResult = useMemo(() => {
    return findFreightForDestination(selectedDestination, freightSheetRecords, 25);
  }, [selectedDestination, freightSheetRecords]);

  const handleAddNewDestination = async () => {
    if (!newPortName.trim()) return;
    setIsAddingPort(true);
    try {
      const amtNum = newPortAmount.trim() ? parseFloat(newPortAmount.replace(/[^0-9.]/g, '')) : undefined;
      const res = await addNewDestinationPort(newPortName.trim(), amtNum);
      if (res && res.destinations) {
        setDestinations(res.destinations);
        setFreightSheetRecords(res.records);
      }
      setSelectedDestination(newPortName.trim());
      setShowAddPortModal(false);
      setNewPortName('');
      setNewPortAmount('');
    } catch (err: any) {
      alert(`Could not add destination port: ${err.message}`);
    } finally {
      setIsAddingPort(false);
    }
  };

  const handleAddNewFobLocation = async () => {
    if (!newFobName.trim()) return;
    setIsAddingFob(true);
    try {
      const priceNum = newFobPrice.trim() ? parseFloat(newFobPrice.replace(/[^0-9.]/g, '')) : undefined;
      const res = await addNewFobLocation(newFobName.trim(), priceNum);
      if (res && res.locations) {
        setFobLocations(res.locations);
        setFobSheetRecords(res.records);
      }
      setSelectedFobLocation(newFobName.trim());
      setShowAddFobModal(false);
      setNewFobName('');
      setNewFobPrice('');
    } catch (err: any) {
      alert(`Could not add FOB location: ${err.message}`);
    } finally {
      setIsAddingFob(false);
    }
  };

  const handleAddNewProduct = async () => {
    if (!newProductCount.trim() || !newProductQuality.trim()) return;
    setIsAddingProduct(true);
    try {
      const priceNum = newProductPrice.trim() ? parseFloat(newProductPrice.replace(/[^0-9.]/g, '')) : undefined;
      const res = await addNewYarnProduct(
        newProductCount.trim(),
        newProductQuality.trim(),
        priceNum,
        newProductLocation.trim() || undefined
      );
      if (res && res.records) {
        setSheetRecords(res.records);
        const added = res.records.find(
          (r) =>
            r.yarnCount.toLowerCase() === newProductCount.trim().toLowerCase() &&
            r.quality.toLowerCase() === newProductQuality.trim().toLowerCase()
        );
        if (added) {
          handleSelectProduct(added);
        }
      }
      setShowAddProductModal(false);
      setNewProductCount('');
      setNewProductQuality('');
      setNewProductPrice('');
      setNewProductLocation('');
    } catch (err: any) {
      alert(`Could not add Yarn product: ${err.message}`);
    } finally {
      setIsAddingProduct(false);
    }
  };

  // Calculated FOB cost per kg
  const fobCostPerKg = useMemo(() => {
    if (fobLookupResult.fobAmount !== null && selectedQty > 0) {
      return fobLookupResult.fobAmount / selectedQty;
    }
    return null;
  }, [fobLookupResult.fobAmount, selectedQty]);

  // Calculated Freight cost per kg
  const freightCostPerKg = useMemo(() => {
    const paddedRate = (fxRates?.[0]?.effective_rate || 95.43) + 0.50;
    if (freightLookupResult.selectedFreightUsd !== null && selectedQty > 0) {
      return (freightLookupResult.selectedFreightUsd * paddedRate) / selectedQty;
    }
    return null;
  }, [freightLookupResult.selectedFreightUsd, fxRates, selectedQty]);

  // Handle clicking outside product autocomplete dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        productInputRef.current &&
        !productInputRef.current.contains(event.target as Node)
      ) {
        setIsProductDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 1. Fetch Quantity Options
  const loadQuantityOptions = useCallback(async () => {
    const { data } = await api.rpc('get_quantity_options', { p_product_code: productCode });
    if (data && Array.isArray(data)) {
      setQuantityOptions(data);
      const def = data.find((q: any) => q.is_default);
      if (def) setSelectedQty(def.qty_per_fcl);
    }
  }, []);

  // Initial loads
  useEffect(() => {
    loadQuantityOptions();
  }, [loadQuantityOptions]);

  // Run calculate_costing RPC with the fetched Ex-Mill Price, Sheet 2 FOB Amount, and Sheet 3 Freight Rate
  const runCalculateRpc = useCallback(async () => {
    // If daily pricing has expired or is not confirmed for today, DO NOT calculate on previous prices
    if (isPricingLocked) {
      setCalcResults(null);
      return;
    }

    const currentFobAmount = fobLookupResult.fobAmount;
    const currentFreightUsd = freightLookupResult.selectedFreightUsd;
    const currentBaseFreightUsd = freightLookupResult.baseAmountUsd;

    // All calculations MUST stop if freight rate is blank in Google Sheet or FOB/Ex-mill is missing
    if (
      !selectedDestination ||
      currentBaseFreightUsd === null ||
      currentBaseFreightUsd <= 0 ||
      currentFreightUsd === null ||
      currentFreightUsd <= 0 ||
      !currentFobAmount ||
      currentFobAmount <= 0 ||
      !selectedQty ||
      !exMillPrice ||
      exMillPrice <= 0
    ) {
      setCalcResults(null);
      return;
    }

    setIsCalculating(true);
    setErrorMsg(null);

    try {
      const { data, error } = await api.rpc('calculate_costing', {
        p_product_code: productCode,
        p_ex_mill: exMillPrice,
        p_origin: selectedOrigin || 'Gujarat',
        p_destination: selectedDestination,
        p_fob_amount: currentFobAmount,
        p_base_freight_usd: currentBaseFreightUsd,
        p_selected_freight_usd: currentFreightUsd,
        p_freight_surcharge: freightLookupResult.surcharge,
        p_qty: selectedQty,
        p_bci: bciOrg,
        p_commission_type: commissionType,
        p_commission_value: commissionValue,
        p_commission_pct: commissionType === 'PCT' ? commissionValue : (calcResults?.effective_commission_pct ?? 0),
        p_margin_term_code: selectedMarginCode,
      });

      if (error) {
        const errMessage = error.message || String(error);
        if (errMessage.includes('Prices are locked') || errMessage.includes('00:00 AM IST') || errMessage.includes('Admin must confirm')) {
          console.warn('Pricing is locked at 12:00 AM IST. Calculations paused until Admin confirmation.');
          setErrorMsg(null);
          setCalcResults(null);
          return;
        }
        console.warn('calculate_costing warning:', errMessage);
        setErrorMsg(errMessage);
        setCalcResults(null);
      } else {
        setCalcResults(data);
      }
    } catch (err: any) {
      const errMessage = err?.message || String(err);
      if (errMessage.includes('Prices are locked') || errMessage.includes('00:00 AM IST') || errMessage.includes('Admin must confirm')) {
        console.warn('Pricing is locked at 12:00 AM IST. Calculations paused.');
        setErrorMsg(null);
        setCalcResults(null);
        return;
      }
      console.warn('Calculation failed:', err);
      setErrorMsg(errMessage || 'Calculation error');
      setCalcResults(null);
    } finally {
      setIsCalculating(false);
    }
  }, [
    isPricingLocked,
    dailyPricingStatus?.isConfirmedForToday,
    selectedOrigin,
    selectedDestination,
    freightLookupResult.baseAmountUsd,
    freightLookupResult.selectedFreightUsd,
    freightLookupResult.surcharge,
    fobLookupResult.fobAmount,
    selectedQty,
    exMillPrice,
    bciOrg,
    commissionType,
    commissionValue,
    calcResults?.effective_commission_pct,
    selectedMarginCode,
  ]);

  // Instantly clear calculation results whenever prices are locked
  useEffect(() => {
    if (isPricingLocked) {
      setCalcResults(null);
    }
  }, [isPricingLocked]);

  // Auto calculate whenever key inputs, live FX rates, Google Sheet 1 price, Google Sheet 2 FOB, or Google Sheet 3 Freight change
  useEffect(() => {
    if (isPricingLocked || !dailyPricingStatus?.isConfirmedForToday) {
      setCalcResults(null);
      return;
    }

    if (
      selectedDestination &&
      freightLookupResult.baseAmountUsd !== null &&
      freightLookupResult.baseAmountUsd > 0 &&
      freightLookupResult.selectedFreightUsd !== null &&
      freightLookupResult.selectedFreightUsd > 0 &&
      fobLookupResult.fobAmount &&
      fobLookupResult.fobAmount > 0 &&
      selectedQty &&
      exMillPrice > 0
    ) {
      runCalculateRpc();
    } else {
      setCalcResults(null);
    }
  }, [
    dailyPricingStatus?.isConfirmedForToday,
    selectedDestination,
    freightLookupResult.baseAmountUsd,
    freightLookupResult.selectedFreightUsd,
    fobLookupResult.fobAmount,
    selectedQty,
    exMillPrice,
    bciOrg,
    selectedMarginCode,
    fxRates,
    runCalculateRpc,
  ]);

  return (
    <div className="space-y-6">

      {/* ==========================================
          DAILY PRICING CONFIRMATION & 12:00 AM RESET CONTROL BAR
         ========================================== */}
      {(isAdmin || !dailyPricingStatus?.isConfirmedForToday) && (
        <div id="daily-pricing-control-bar" className={`rounded-xl border shadow-sm p-4 transition-all ${
          dailyPricingStatus?.isConfirmedForToday
            ? 'bg-gradient-to-r from-emerald-50/90 via-slate-50 to-emerald-50/80 border-emerald-300 text-emerald-950'
            : 'bg-gradient-to-r from-amber-50 via-rose-50/40 to-amber-50 border-amber-300 text-amber-950 ring-2 ring-amber-400/30'
        }`}>
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            
            {/* Status Label & Explanation */}
            <div className="flex items-start space-x-3.5">
              <div className={`p-2.5 rounded-xl shrink-0 shadow-xs border ${
                dailyPricingStatus?.isConfirmedForToday
                  ? 'bg-emerald-600 text-white border-emerald-700'
                  : 'bg-amber-600 text-white border-amber-700 animate-pulse'
              }`}>
                {dailyPricingStatus?.isConfirmedForToday ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <AlertTriangle className="w-5 h-5" />
                )}
              </div>

              <div>
                <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                  <h3 className="text-sm font-black tracking-wide uppercase font-sans">
                    {dailyPricingStatus?.isConfirmedForToday
                      ? "Today's Daily Pricing is Active & Confirmed"
                      : "12:00 AM Midnight Lock Active (Google Sheet Rates Preserved)"}
                  </h3>
                  <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border ${
                    dailyPricingStatus?.isConfirmedForToday
                      ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      : 'bg-amber-200/90 text-amber-950 border-amber-400 font-mono'
                  }`}>
                    {dailyPricingStatus?.isConfirmedForToday ? 'Active for Today' : '12:00 AM Locked'}
                  </span>
                  {dailyPricingStatus?.todayDate && (
                    <span className="text-[11px] font-mono font-medium text-slate-500">
                      ({dailyPricingStatus.todayDate})
                    </span>
                  )}
                </div>

                <p className="text-xs mt-1 text-slate-700 max-w-3xl leading-relaxed">
                  {dailyPricingStatus?.isConfirmedForToday ? (
                    <span>
                      Rates for <strong>{dailyPricingStatus.todayDate}</strong> were confirmed by <strong>{dailyPricingStatus.lastConfirmedBy || 'Admin'}</strong> at{' '}
                      {dailyPricingStatus.lastConfirmedAt ? new Date(dailyPricingStatus.lastConfirmedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'today'} ({dailyPricingStatus.confirmationType === 'kept_previous' ? 'Kept Google Sheet prices' : 'Updated in Google Sheet'}). All calculations and quotations are enabled.
                    </span>
                  ) : (
                    <span>
                      At <strong>12:00 AM Midnight (IST)</strong>, all 3 Google Sheet prices are locked. <strong>Calculations are disabled for everyone while prices are locked.</strong> Once Admin clicks <strong>"Keep Yesterday's Prices (1-Click)"</strong>, or edits rates in Google Sheet and clicks <strong>"Publish Prices"</strong>, calculations will be unlocked.
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Action Area: If price was edited / confirmed, show confirmation redirect link; otherwise show review/publish action */}
            {dailyPricingStatus?.isConfirmedForToday ? (
              <div className="flex items-center space-x-2.5 flex-wrap self-end lg:self-center shrink-0">
                <a
                  id="redirect-master-sheet-link"
                  href={getSavedGoogleSheetUrls().yarnViewUrl.split('#')[0].split('?')[0]}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border border-emerald-300 hover:border-emerald-400 text-xs font-bold shadow-2xs transition-all cursor-pointer group"
                  title="Open Master Google Sheet containing all sub-sheets (Yarn, FOB, Freight) in a new tab"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 group-hover:scale-110 transition-transform" />
                  <span className="underline decoration-emerald-500/50 hover:decoration-emerald-700">Price was updated for today ↗</span>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        window.open(getSavedGoogleSheetUrls().yarnViewUrl.split('#')[0].split('?')[0], '_blank');
                      }}
                      title="Open Google Sheet to edit prices"
                      className="ml-2 text-emerald-800 hover:text-emerald-950 underline text-[11px] font-semibold cursor-pointer"
                    >
                      (Edit)
                    </button>
                  )}
                </a>
                {isAdmin && onOpenGoogleSheetConfig && (
                  <button
                    type="button"
                    onClick={onOpenGoogleSheetConfig}
                    className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
                    title="Manage dedicated Google Sheets for emp1, emp2, and team"
                  >
                    <Users className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Employee Sheets (emp1, emp2)</span>
                  </button>
                )}
                {isAdmin && onOpenGoogleSheetButtonModal && (
                  <button
                    type="button"
                    onClick={onOpenGoogleSheetButtonModal}
                    className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold shadow-2xs transition-all cursor-pointer"
                    title="Get button or formula for Google Sheet to confirm prices with 1 click"
                  >
                    <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                    <span>Sheet Return Button</span>
                  </button>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-2.5 flex-wrap self-end lg:self-center shrink-0">
                {isAdmin ? (
                  <>
                    <button
                      id="btn-keep-previous-banner"
                      type="button"
                      onClick={handleKeepPreviousPrices}
                      disabled={isConfirmingPrevious}
                      className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-50"
                      title="Keep all Google Sheet rates active for today with 1-click"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-100" />
                      <span>{isConfirmingPrevious ? 'Activating...' : "Keep Yesterday's Prices (1-Click)"}</span>
                    </button>
                    <a
                      id="btn-open-google-sheet-edit-banner"
                      href={getSavedGoogleSheetUrls().yarnViewUrl.split('#')[0].split('?')[0]}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => {
                        startSheetEditing(currentUser?.name || 'Admin').catch((e) => console.error('Failed to start editing:', e));
                      }}
                      className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 text-xs font-bold shadow-2xs transition-all cursor-pointer"
                      title="Open Master Google Sheet to edit prices directly in Google Sheet"
                    >
                      <ExternalLink className="w-4 h-4 text-indigo-700" />
                      <span>Edit (Open Google Sheet) ↗</span>
                    </a>
                    {dailyPricingStatus?.isEditingInSheet && (
                      <button
                        id="btn-sync-publish-google-sheet-banner"
                        type="button"
                        onClick={handleSyncFromSheet}
                        disabled={isSyncingSheet}
                        className="inline-flex items-center space-x-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-50"
                        title="Read the prices you edited in Google Sheet and unlock them for everyone today"
                      >
                        <RefreshCw className={`w-4 h-4 text-indigo-100 ${isSyncingSheet ? 'animate-spin' : ''}`} />
                        <span>{isSyncingSheet ? 'Publishing...' : 'Publish Prices'}</span>
                      </button>
                    )}
                    {onOpenGoogleSheetConfig && (
                      <button
                        type="button"
                        onClick={onOpenGoogleSheetConfig}
                        className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 text-xs font-bold shadow-2xs transition-all cursor-pointer"
                        title="Manage dedicated Google Sheets for emp1, emp2, and team"
                      >
                        <Users className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Employee Sheets (emp1, emp2) 📋</span>
                      </button>
                    )}
                    {onOpenGoogleSheetButtonModal && (
                      <button
                        type="button"
                        onClick={onOpenGoogleSheetButtonModal}
                        className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-lg bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-bold shadow-2xs transition-all cursor-pointer"
                        title="Get button or formula for Google Sheet to confirm prices with 1 click"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Sheet Return Button 📋</span>
                      </button>
                    )}
                  </>
                ) : (
                  <div className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-lg bg-amber-100 text-amber-900 border border-amber-300 text-xs font-bold shadow-2xs">
                    <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                    <span>Prices Locked (00:00 AM Reset) — Calculations Disabled Until Admin Confirms Today's Rates</span>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      )}

      {/* ==========================================
          BUYER & AGENT SELECTION ROW (MANDATORY)
         ========================================== */}
      <div id="buyer-agent-selection-row" className="bg-white rounded-xl border border-indigo-200 shadow-sm relative z-30">
        <div className="bg-slate-900 rounded-t-xl px-5 py-3.5 flex items-center justify-between text-white border-b border-indigo-800">
          <div className="flex items-center space-x-3">
            <div className="bg-indigo-600 p-1.5 rounded shadow-xs">
              <UserCheck className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-sm font-black tracking-wider uppercase font-sans">
                Customer & Agent Selection
              </h2>
            </div>
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          {/* Ownership Filter Scope Banner */}
          {currentUser && (
            <div className="flex flex-wrap items-center justify-between gap-2.5 px-3.5 py-2.5 bg-gradient-to-r from-indigo-50/90 via-slate-50 to-emerald-50/70 border border-indigo-100 rounded-lg text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-700 text-white font-bold text-[10px] shadow-xs">
                  <UserCheck className="w-3 h-3" />
                  <span>Owner: {currentUser.name}</span>
                </span>
                <span className="text-slate-600 text-xs">
                  Showing <strong>{filteredCustomers.length}</strong> customer{filteredCustomers.length === 1 ? '' : 's'} and <strong>{filteredAgents.length}</strong> agent{filteredAgents.length === 1 ? '' : 's'} assigned to your dashboard
                </span>
              </div>

              {/* Ownership Toggle (Strictly only for Admin users) */}
              {isAdmin && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setFilterMyAccountsOnly(!filterMyAccountsOnly)}
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-all font-semibold ${
                      filterMyAccountsOnly
                        ? 'bg-white text-indigo-700 border border-indigo-200 shadow-xs'
                        : 'bg-slate-200/80 text-slate-700 hover:bg-slate-300'
                    }`}
                    title={filterMyAccountsOnly ? "Currently showing only accounts owned by you" : "Showing all organizational accounts"}
                  >
                    <Users className="w-3 h-3 text-indigo-600" />
                    <span>{filterMyAccountsOnly ? 'My Accounts Only' : 'Showing All Accounts'}</span>
                  </button>
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-100/80 px-2 py-0.5 rounded border border-amber-200">
                    Admin
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* 1. CUSTOMER NAME SEARCH (ZOHO ACCOUNTS) */}
            <div className="relative" ref={customerDropdownRef}>
              <label className="block text-[11px] font-black text-slate-600 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span className="flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                  <span>International Buyer / Customer (Accounts Module Only)</span>
                </span>
                {currentUser && effectiveFilterMyAccounts && (
                  <span className="text-[10px] font-medium text-indigo-600 lowercase font-mono">
                    owned by {currentUser.name.split(' ')[0]}
                  </span>
                )}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Search className="w-4 h-4" />
                </div>
                <input
                  id="top-customer-search-input"
                  type="text"
                  value={customerSearch || customerName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setCustomerSearch(val);
                    setCustomerName(val);
                    setShowCustomerDropdown(true);
                  }}
                  onFocus={() => setShowCustomerDropdown(true)}
                  placeholder={currentUser ? `Search customer accounts owned by ${currentUser.name}...` : "Type or search Zoho CRM Customer Accounts..."}
                  className="w-full bg-slate-50 hover:bg-slate-100/70 border border-slate-300 rounded-lg pl-9 pr-8 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all shadow-inner"
                />
                {(customerSearch || customerName) && (
                  <button
                    onClick={() => {
                      setCustomerSearch('');
                      setCustomerName('');
                      setShowCustomerDropdown(false);
                    }}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-rose-500 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Customer Dropdown list */}
              {showCustomerDropdown && (
                <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-2xl ring-1 ring-slate-900/10 max-h-64 overflow-y-auto text-xs">
                  {/* Dropdown sticky header */}
                  <div className="sticky top-0 bg-slate-50/95 backdrop-blur-xs px-3.5 py-2 border-b border-slate-200 flex items-center justify-between text-[11px] font-semibold text-slate-500 z-10">
                    <span>{filteredCustomers.length} {filteredCustomers.length === 1 ? 'Customer Account' : 'Customer Accounts'} (Accounts Module)</span>
                    {effectiveFilterMyAccounts && currentUser && (
                      <span className="text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-100">
                        Assigned to {currentUser.name.split(' ')[0]}
                      </span>
                    )}
                  </div>

                  <div className="p-1 space-y-0.5">
                    {filteredCustomers.length > 0 ? (
                      filteredCustomers.map((acc) => {
                        const isSelected =
                          customerName.toLowerCase() === acc.name.toLowerCase() ||
                          (acc.contact_name && customerName.toLowerCase() === `${acc.name} (${acc.contact_name})`.toLowerCase());
                        return (
                          <button
                            key={acc.id}
                            type="button"
                            onClick={() => {
                              setCustomerName(acc.contact_name ? `${acc.name} (${acc.contact_name})` : acc.name);
                              setCustomerSearch('');
                              setShowCustomerDropdown(false);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex justify-between items-center ${
                              isSelected
                                ? 'bg-indigo-50 font-bold text-indigo-950 ring-1 ring-indigo-200'
                                : 'hover:bg-slate-50 text-slate-800'
                            }`}
                          >
                            <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                              <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                                isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-transparent'
                              }`}>
                                <Check className="w-2.5 h-2.5" />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="font-semibold truncate text-slate-900">{acc.name}</span>
                                {acc.contact_name && (
                                  <span className="text-[11px] text-slate-700 font-medium flex items-center gap-1 mt-0.5">
                                    <span className="text-slate-400 font-normal">Contact:</span>
                                    <span className="text-indigo-800 font-semibold truncate">{acc.contact_name}</span>
                                    {acc.contact_phone && <span className="text-[10px] text-slate-400 font-normal">({acc.contact_phone})</span>}
                                  </span>
                                )}
                                {acc.owner_name && (
                                  <span className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                                    <UserCheck className="w-3 h-3 text-indigo-600 shrink-0 inline" />
                                    <span className="truncate">Owner: <strong>{acc.owner_name}</strong></span>
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <span className="text-[9px] px-2 py-0.5 rounded-full font-bold font-mono border bg-indigo-50 text-indigo-700 border-indigo-200">
                                Account
                              </span>
                              {acc.contact_name && (
                                <span className="text-[9px] text-slate-400 font-medium">
                                  + Contact
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })
                    ) : (
                      <div className="px-4 py-4 text-center text-slate-500">
                        <p className="font-medium text-xs">
                          No customer accounts found owned by {currentUser?.name || 'you'}.
                        </p>
                        {effectiveFilterMyAccounts && isAdmin && (
                          <button
                            type="button"
                            onClick={() => setFilterMyAccountsOnly(false)}
                            className="mt-2 text-[11px] text-indigo-600 font-semibold hover:underline block mx-auto"
                          >
                            View all company accounts ({zohoAccounts.filter(a => a.type === 'Account').length})
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 2. LOCAL AGENT SEARCH (ZOHO VENDORS / AGENTS) */}
            <div className="relative" ref={agentDropdownRef}>
              <label className="block text-[11px] font-black text-slate-600 uppercase tracking-wider mb-1 flex items-center justify-between">
                <span className="flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>Local Agent Name</span>
                </span>
                {currentUser && effectiveFilterMyAccounts && (
                  <span className="text-[10px] font-medium text-emerald-600 lowercase font-mono">
                    owned by {currentUser.name.split(' ')[0]}
                  </span>
                )}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Search className="w-4 h-4" />
                </div>
                <input
                  id="top-agent-search-input"
                  type="text"
                  value={agentSearch || agentName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setAgentSearch(val);
                    setAgentName(val);
                    setShowAgentDropdown(true);
                  }}
                  onFocus={() => setShowAgentDropdown(true)}
                  placeholder={currentUser ? `Search agents owned by ${currentUser.name}...` : "Type or search Zoho CRM Agent/Vendor lists..."}
                  className="w-full bg-slate-50 hover:bg-slate-100/70 border border-slate-300 rounded-lg pl-9 pr-8 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all shadow-inner"
                />
                {(agentSearch || agentName) && (
                  <button
                    onClick={() => {
                      setAgentSearch('');
                      setAgentName('');
                      setShowAgentDropdown(false);
                    }}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-rose-500 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Agent Dropdown list */}
              {showAgentDropdown && (
                <div className="absolute z-50 left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-2xl ring-1 ring-slate-900/10 max-h-64 overflow-y-auto text-xs">
                  {/* Dropdown sticky header */}
                  <div className="sticky top-0 bg-slate-50/95 backdrop-blur-xs px-3.5 py-2 border-b border-slate-200 flex items-center justify-between text-[11px] font-semibold text-slate-500 z-10">
                    <span>{filteredAgents.length} {filteredAgents.length === 1 ? 'Agent' : 'Agents'} Available</span>
                    {effectiveFilterMyAccounts && currentUser && (
                      <span className="text-[10px] text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                        Assigned to {currentUser.name.split(' ')[0]}
                      </span>
                    )}
                  </div>

                  <div className="p-1 space-y-0.5">
                    {filteredAgents.length > 0 ? (
                      filteredAgents.map((acc) => {
                        const isSelected = agentName.toLowerCase() === acc.name.toLowerCase();
                        return (
                          <button
                            key={acc.id}
                            type="button"
                            onClick={() => {
                              setAgentName(acc.name);
                              setAgentSearch('');
                              setShowAgentDropdown(false);
                            }}
                            className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex justify-between items-center ${
                              isSelected
                                ? 'bg-emerald-50 font-bold text-emerald-950 ring-1 ring-emerald-200'
                                : 'hover:bg-slate-50 text-slate-800'
                            }`}
                          >
                            <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                              <div className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 ${
                                isSelected ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-transparent'
                              }`}>
                                <Check className="w-2.5 h-2.5" />
                              </div>
                              <div className="flex flex-col min-w-0">
                                <span className="font-semibold truncate text-slate-900">{acc.name}</span>
                                {acc.owner_name && (
                                  <span className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                                    <UserCheck className="w-3 h-3 text-emerald-600 shrink-0 inline" />
                                    <span className="truncate">Owner: <strong>{acc.owner_name}</strong></span>
                                  </span>
                                )}
                              </div>
                            </div>
                            <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold font-mono shrink-0 border ${
                              acc.type === 'Agent'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                : 'bg-slate-50 text-slate-600 border-slate-200'
                            }`}>
                              {acc.type}
                            </span>
                          </button>
                        );
                      })
                    ) : (
                      <div className="px-4 py-4 text-center text-slate-500">
                        <p className="font-medium text-xs">
                          No agents found owned by {currentUser?.name || 'you'}.
                        </p>
                        {effectiveFilterMyAccounts && isAdmin && (
                          <button
                            type="button"
                            onClick={() => setFilterMyAccountsOnly(false)}
                            className="mt-2 text-[11px] text-emerald-600 font-semibold hover:underline block mx-auto"
                          >
                            View all company agents ({zohoAccounts.filter(a => a.type === 'Agent' || a.type === 'Vendor').length})
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick status block with selected items */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/80 border border-slate-200 rounded-lg p-3.5 text-xs">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Active Customer Selection
              </span>
              {customerName ? (
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-indigo-500"></div>
                  <span className="font-bold text-slate-800">{customerName}</span>
                </div>
              ) : (
                <span className="text-slate-400 italic font-medium">None Selected (Direct Offer)</span>
              )}
            </div>

            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Active Local Agent Selection
              </span>
              {agentName ? (
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                  <span className="font-bold text-slate-800">{agentName}</span>
                </div>
              ) : (
                <span className="text-slate-400 italic font-medium">None Selected (No Agent Commission)</span>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* THREE PANEL GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        {/* ==========================================
            PANEL 1 — FREIGHT
           ========================================== */}
        <div id="panel-freight" className="bg-white rounded-lg border border-slate-300 shadow-sm p-4 sm:p-5 space-y-4">
          <div className="border-b border-slate-200 pb-2 flex flex-wrap sm:flex-nowrap justify-between items-center gap-2">
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-black tracking-wider text-slate-800 uppercase font-sans">
                  PANEL 1 — FREIGHT
                </h2>
              </div>
              <p className="text-xs text-slate-500 font-sans mt-0.5">
                Ocean Freight & Surcharge (+${freightLookupResult.surcharge})
              </p>
            </div>

            <div className="flex items-center space-x-1.5">
              {isAdmin && (
                <a
                  href={GOOGLE_FREIGHT_SHEET_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded text-[11px] font-semibold flex items-center space-x-1 transition-colors shadow-2xs cursor-pointer"
                  title="Open Freight Google Sheet (Sub-Sheet 2 · gid=1549189100) in a new tab"
                >
                  <ExternalLink className="w-3 h-3 text-indigo-600 shrink-0" />
                  <span>Sheet ↗</span>
                </a>
              )}

              <button
                id="btn-refresh-freight-sheet"
                onClick={() => loadGoogleSheetFreightData(true)}
                disabled={isLoadingFreightSheet}
                title="Refresh Freight Rates"
                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors text-xs flex items-center space-x-1"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFreightSheet ? 'animate-spin text-indigo-600' : ''}`} />
              </button>
            </div>
          </div>

          {isAdmin && !dailyPricingStatus?.isConfirmedForToday && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-[11px] p-2 rounded flex items-center justify-between">
              <span className="flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Freight rates expired at 12 AM (Pending Daily Approval)</span>
              </span>
              <button
                type="button"
                onClick={() => onOpenExcelPricing?.('freight')}
                className="text-amber-900 font-bold underline hover:text-amber-700 ml-1 cursor-pointer"
              >
                Verify
              </button>
            </div>
          )}

          {isPricingLocked && (
            <div className="bg-amber-50 border border-amber-300 text-amber-900 text-xs p-2.5 rounded-lg flex items-center space-x-2 font-medium">
              <Lock className="w-4 h-4 text-amber-700 shrink-0" />
              <span>Freight prices locked at 12:00 AM. Unlock via Admin confirmation.</span>
            </div>
          )}

          <div className="space-y-3 text-xs">
            {/* Destination Dropdown */}
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="font-semibold text-slate-700 font-sans flex items-center space-x-1">
                  <Ship className="w-3.5 h-3.5 text-blue-600" />
                   <span>Destination Port</span>
                </label>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setShowAddPortModal(true)}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                    title="Add a new destination port to dropdown"
                  >
                    + Add Port
                  </button>
                )}
              </div>
              <select
                id="select-freight-destination"
                value={selectedDestination}
                onChange={(e) => {
                  if (e.target.value === '__NEW__') {
                    setShowAddPortModal(true);
                  } else {
                    setSelectedDestination(e.target.value);
                  }
                }}
                className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-600"
              >
                {destinations.length === 0 && <option value="">No published routes</option>}
                {destinations.map((dest) => {
                  const rec = freightSheetRecords.find((r) => r.destination.toUpperCase() === dest.toUpperCase());
                  return (
                    <option key={dest} value={dest}>
                      {dest} {isPricingLocked ? '(🔒 Locked)' : (rec && rec.amount !== null ? `(${formatUSD(rec.amount, 0)})` : '')}
                    </option>
                  );
                })}
                {isAdmin && <option value="__NEW__">+ Add / Input New Destination Port...</option>}
              </select>
            </div>
          </div>

          {/* Status Alert if Rate Missing */}
          {selectedDestination && freightLookupResult.status !== 'FOUND' && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-[11px] p-2 rounded flex items-start space-x-1.5">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <span>Freight rate is blank/missing in Google Sheet for <strong>{selectedDestination}</strong>. All further calculations are paused.</span>
              </div>
            </div>
          )}

          {/* Freight Rate Result Box */}
          <div className="bg-slate-50 rounded border border-slate-200 p-3.5 space-y-2 text-xs font-mono tabular-nums">
            <div className="flex justify-between text-slate-600">
              <span className="font-sans flex items-center space-x-1">
                <span>Base rate ({selectedDestination || '—'})</span>
              </span>
              <span className="font-bold text-slate-800">
                {isPricingLocked ? <span className="text-amber-800 font-bold">🔒 Locked (12:00 AM)</span> : (freightLookupResult.baseAmountUsd !== null ? formatUSD(freightLookupResult.baseAmountUsd, 0) : '—')}
              </span>
            </div>

            <div className="flex justify-between text-slate-600">
              <span className="font-sans">Surcharge</span>
              <span className="font-bold text-slate-800">
                {isPricingLocked ? <span className="text-amber-800 font-bold">🔒 Locked</span> : (freightLookupResult.baseAmountUsd !== null ? `+${formatUSD(freightLookupResult.surcharge || 25, 0)}` : '—')}
              </span>
            </div>

            <div className="flex justify-between font-bold text-slate-900 border-t border-slate-300 pt-1.5">
              <span className="font-sans">Selected freight</span>
              <span className="text-indigo-700">
                {isPricingLocked ? (
                  <span className="text-amber-800 font-bold">🔒 Locked (12:00 AM)</span>
                ) : freightLookupResult.selectedFreightUsd !== null ? (
                  `${formatUSD(freightLookupResult.selectedFreightUsd, 0)} per Qty`
                ) : (
                  '—'
                )}
              </span>
            </div>

            <div className="border-t border-slate-200 pt-2 mt-2 space-y-1">
              <div className="flex justify-between items-baseline font-bold text-slate-900">
                <span className="font-sans">Freight Cost</span>
                <span className="text-sm font-extrabold text-slate-900">
                  {isPricingLocked ? (
                    <span className="text-amber-800 font-bold">🔒 Locked (12:00 AM)</span>
                  ) : freightLookupResult.selectedFreightUsd !== null && calcResults?.freight_per_kg != null ? (
                    `₹${formatDecimal4(calcResults.freight_per_kg)} per kg`
                  ) : (
                    freightCostPerKg !== null ? `₹${formatDecimal4(freightCostPerKg)} per kg` : '₹—'
                  )}
                </span>
              </div>
              {isPricingLocked ? (
                <p className="text-[11px] text-amber-700 font-sans text-right italic">
                  Prices locked at 12:00 AM — awaiting Admin confirmation
                </p>
              ) : freightLookupResult.selectedFreightUsd !== null ? (
                <p className="text-[11px] text-slate-500 font-sans text-right">
                  ({formatUSD(freightLookupResult.selectedFreightUsd, 0)} × {calcResults?.padded_rate ? formatDecimal4(calcResults.padded_rate) : formatDecimal4((fxRates?.[0]?.effective_rate || 95.43) + 0.50)}) / {selectedQty ? formatFclAmount(selectedQty) : '21,000'} kg
                </p>
              ) : (
                <p className="text-[11px] text-slate-400 font-sans text-right italic">
                  Rate blank in Google Sheet — calculations paused
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ==========================================
            PANEL 2 — FOB COSTING
           ========================================== */}
        <div id="panel-fob" className="bg-white rounded-lg border border-slate-300 shadow-sm p-4 sm:p-5 space-y-4">
          <div className="border-b border-slate-200 pb-2 flex flex-wrap sm:flex-nowrap justify-between items-center gap-2">
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-black tracking-wider text-slate-800 uppercase font-sans">
                  PANEL 2 — FOB COSTING
                </h2>
              </div>
              <p className="text-xs text-slate-500 font-sans mt-0.5">
                Automatic FOB Lookup via Factory Location
              </p>
            </div>

            <div className="flex items-center space-x-1.5">
              {isAdmin && (
                <a
                  href={GOOGLE_FOB_SHEET_URL}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded text-[11px] font-semibold flex items-center space-x-1 transition-colors shadow-2xs cursor-pointer"
                  title="Open FOB Google Sheet (Sub-Sheet 3 · gid=1401052388) in a new tab"
                >
                  <ExternalLink className="w-3 h-3 text-indigo-600 shrink-0" />
                  <span>Sheet ↗</span>
                </a>
              )}

              <button
                id="btn-refresh-fob-sheet"
                onClick={() => loadGoogleSheetFobData(true)}
                disabled={isLoadingFobSheet}
                title="Refresh FOB Data"
                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors text-xs flex items-center space-x-1"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFobSheet ? 'animate-spin text-indigo-600' : ''}`} />
              </button>
            </div>
          </div>

          {isAdmin && !dailyPricingStatus?.isConfirmedForToday && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-[11px] p-2 rounded flex items-center justify-between">
              <span className="flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>FOB rates expired at 12 AM (Pending Daily Approval)</span>
              </span>
              <button
                type="button"
                onClick={() => onOpenExcelPricing?.('fob')}
                className="text-amber-900 font-bold underline hover:text-amber-700 ml-1 cursor-pointer"
              >
                Verify
              </button>
            </div>
          )}

          {/* Automatic Location Link & FOB Dropdown */}
          <div className="space-y-2.5 text-xs font-sans">
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="font-semibold text-slate-700 flex items-center space-x-1">
                  <MapPin className="w-3.5 h-3.5 text-indigo-600" />
                   <span>FOB Location / Port</span>
                </label>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setShowAddFobModal(true)}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                    title="Add a new FOB location to dropdown"
                  >
                    + Add Location
                  </button>
                )}
              </div>

              {/* FOB Location Dropdown */}
              <div className="mb-2">
                <select
                  id="select-fob-location"
                  value={selectedFobLocation}
                  onChange={(e) => {
                    if (e.target.value === '__NEW__') {
                      setShowAddFobModal(true);
                    } else {
                      setSelectedFobLocation(e.target.value);
                    }
                  }}
                  className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-600 text-xs"
                >
                  <option value="AUTO">
                    Auto-detect ({factoryLocation && factoryLocation !== 'Factory Location not available.' ? factoryLocation : 'Factory Location'})
                  </option>
                  {fobLocations.map((loc) => {
                    const rec = fobSheetRecords.find((r) => r.location.toUpperCase() === loc.toUpperCase());
                    return (
                      <option key={loc} value={loc}>
                        {loc} {isPricingLocked ? '(🔒 Locked)' : (rec && rec.price ? `(₹${formatFclAmount(rec.price)})` : '')}
                      </option>
                    );
                  })}
                  {isAdmin && <option value="__NEW__">+ Add / Input New FOB Location...</option>}
                </select>
              </div>

              {/* Location Status Display */}
              <div className="bg-slate-100 border border-slate-300 rounded p-2.5 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <MapPin className="w-4 h-4 text-indigo-600 shrink-0" />
                    <div>
                      <div className="font-bold text-slate-900 text-sm">
                        {fobLookupResult.matchedLocation || (effectiveFobLocation && effectiveFobLocation !== 'Factory Location not available.' ? effectiveFobLocation : 'Location Pending')}
                      </div>
                      <div className="text-[11px] text-slate-600">
                        {selectedFobLocation !== 'AUTO' ? (
                          <span>Manual FOB: <span className="font-semibold text-indigo-700">{selectedFobLocation}</span> (Factory: {factoryLocation})</span>
                        ) : factoryLocation && factoryLocation !== 'Factory Location not available.' ? (
                          <span>Factory: <span className="font-medium text-slate-800">{factoryLocation}</span></span>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {/* Status Badge */}
                  {fobLookupResult.status === 'FOUND' && (
                    <span className="inline-flex items-center space-x-1 bg-emerald-100 text-emerald-800 text-[10px] font-semibold px-2 py-0.5 rounded">
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span>FOB Synced</span>
                    </span>
                  )}
                  {fobLookupResult.status === 'NOT_FOUND' && (
                    <span className="inline-flex items-center space-x-1 bg-amber-100 text-amber-800 text-[10px] font-semibold px-2 py-0.5 rounded">
                      <AlertTriangle className="w-3 h-3 text-amber-600" />
                      <span>Not Found</span>
                    </span>
                  )}
                  {fobLookupResult.status === 'MISSING_PRICE' && (
                    <span className="inline-flex items-center space-x-1 bg-rose-100 text-rose-800 text-[10px] font-semibold px-2 py-0.5 rounded">
                      <ShieldAlert className="w-3 h-3 text-rose-600" />
                      <span>Price Missing</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Error or Warning message banners if location or price not found */}
            {fobLookupResult.status === 'NOT_FOUND' && (
              <div className="bg-amber-50 border border-amber-300 text-amber-900 text-xs p-2.5 rounded flex items-start space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">FOB Price Not Found</div>
                  <div>{fobLookupResult.message}</div>
                  <div className="text-[11px] text-amber-700 mt-1">
                    Please update Google Sheet with this location's FOB amount.
                  </div>
                </div>
              </div>
            )}

            {fobLookupResult.status === 'MISSING_PRICE' && (
              <div className="bg-rose-50 border border-rose-300 text-rose-900 text-xs p-2.5 rounded flex items-start space-x-2">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">FOB Price Blank</div>
                  <div>{fobLookupResult.message}</div>
                  <div className="text-[11px] text-rose-700 mt-1">
                    Please enter the FOB amount for this location in Google Sheet.
                  </div>
                </div>
              </div>
            )}

            {fobLookupResult.status === 'NO_LOCATION' && (
              <div className="bg-slate-100 border border-slate-200 text-slate-600 text-xs p-2 rounded italic">
                {fobLookupResult.message}
              </div>
            )}

            {fobSheetError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-2 rounded flex items-start space-x-1.5">
                <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span>{fobSheetError}</span>
              </div>
            )}
          </div>

          {isPricingLocked && (
            <div className="bg-amber-50 border border-amber-300 text-amber-900 text-xs p-2.5 rounded-lg flex items-center space-x-2 font-medium">
              <Lock className="w-4 h-4 text-amber-700 shrink-0" />
              <span>FOB transport rates locked at 12:00 AM. Unlock via Admin confirmation.</span>
            </div>
          )}

          {/* FOB Result Display */}
          <div className="bg-slate-50 rounded border border-slate-200 p-3.5 space-y-2 text-xs font-mono tabular-nums">
            <div className="flex justify-between text-slate-600">
              <span className="font-sans">FOB Amount</span>
              <span className="font-bold text-slate-800">
                {isPricingLocked ? (
                  <span className="text-amber-800 font-bold">🔒 Locked (12:00 AM)</span>
                ) : fobLookupResult.fobAmount !== null ? (
                  `₹${formatFclAmount(fobLookupResult.fobAmount)} (per Qty)`
                ) : (
                  '₹— (Unavailable)'
                )}
              </span>
            </div>

            <div className="flex justify-between items-baseline font-bold text-slate-900 border-t border-slate-300 pt-2 mt-2">
              <span className="font-sans">FOB Cost</span>
              <span className="text-sm font-extrabold text-slate-900">
                {isPricingLocked ? (
                  <span className="text-amber-800 font-bold">🔒 Locked (12:00 AM)</span>
                ) : fobCostPerKg !== null ? (
                  `₹${formatDecimal4(fobCostPerKg)} per kg`
                ) : calcResults?.fob_cost_per_kg != null ? (
                  `₹${formatDecimal4(calcResults.fob_cost_per_kg)} per kg`
                ) : (
                  '₹—'
                )}
              </span>
            </div>
            {isPricingLocked ? (
              <p className="text-[11px] text-amber-700 font-sans text-right italic">
                Prices locked at 12:00 AM — awaiting Admin confirmation
              </p>
            ) : (
              <p className="text-[11px] text-slate-500 font-sans text-right">
                {fobLookupResult.fobAmount !== null ? `₹${formatFclAmount(fobLookupResult.fobAmount)}` : '₹0'} / {selectedQty ? formatFclAmount(selectedQty) : '21,000'} kg
              </p>
            )}
          </div>
        </div>

        {/* ==========================================
            PANEL 3 — EX-MILL COSTING (DYNAMIC GOOGLE SHEET 1)
           ========================================== */}
        <div id="panel-ex-mill" className="bg-white rounded-lg border border-slate-300 shadow-sm p-4 sm:p-5 space-y-4 relative">
          <div className="border-b border-slate-200 pb-2 flex flex-wrap sm:flex-nowrap justify-between items-center gap-2">
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-sm font-black tracking-wider text-slate-800 uppercase font-sans">
                  PANEL 3 — EX-MILL COSTING
                </h2>
              </div>
              <p className="text-xs text-slate-500 font-sans mt-0.5">
                Dynamic Ex-Mill Price & Factory Location Lookup
              </p>
            </div>

            <div className="flex items-center space-x-1.5">
              {isAdmin && (
                <a
                  href={getSavedGoogleSheetUrls().yarnViewUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-2 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 rounded text-[11px] font-semibold flex items-center space-x-1 transition-colors shadow-2xs cursor-pointer"
                  title="Open Yarn Ex-Mill Google Sheet in a new tab"
                >
                  <ExternalLink className="w-3 h-3 text-indigo-600 shrink-0" />
                  <span>Sheet ↗</span>
                </a>
              )}

              <button
                id="btn-refresh-sheet"
                onClick={handleRefreshAllSheets}
                disabled={isLoadingSheet || isLoadingFobSheet}
                title="Refresh All Data"
                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors text-xs flex items-center space-x-1"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${(isLoadingSheet || isLoadingFobSheet) ? 'animate-spin text-indigo-600' : ''}`} />
              </button>

              <button
                id="btn-calculate"
                onClick={runCalculateRpc}
                disabled={isPricingLocked || isCalculating || !exMillPrice || exMillPrice <= 0 || !fobLookupResult.fobAmount}
                title={isPricingLocked ? "All 3 Google Sheet prices are locked at 12:00 AM. Admin must click 'Keep Yesterday's Prices' or edit prices in Google Sheet to unlock calculation." : 'Calculate Costing'}
                className={`px-3 py-1 font-sans text-xs font-semibold rounded shadow-sm transition-colors flex items-center space-x-1 ${
                  isPricingLocked
                    ? 'bg-amber-600/90 text-white cursor-not-allowed opacity-90'
                    : 'bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-400 text-white cursor-pointer disabled:cursor-not-allowed'
                }`}
              >
                {isPricingLocked ? (
                  <>
                    <Lock className="w-3.5 h-3.5" />
                    <span>LOCKED (12:00 AM)</span>
                  </>
                ) : (
                  <>
                    <Calculator className={`w-3.5 h-3.5 ${isCalculating ? 'animate-spin' : ''}`} />
                    <span>CALCULATE</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {isPricingLocked && (
            <div className="bg-amber-50 border border-amber-300 text-amber-900 text-xs p-2.5 rounded-lg flex items-center space-x-2 font-medium">
              <Lock className="w-4 h-4 text-amber-700 shrink-0" />
              <span>Ex-Mill yarn prices locked at 12:00 AM. Unlock via Admin confirmation.</span>
            </div>
          )}

          {isAdmin && !dailyPricingStatus?.isConfirmedForToday && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-[11px] p-2 rounded flex items-center justify-between">
              <span className="flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <span>Ex-Mill prices expired at 12 AM (Pending Daily Approval)</span>
              </span>
              <button
                type="button"
                onClick={() => onOpenExcelPricing?.('yarn')}
                className="text-amber-900 font-bold underline hover:text-amber-700 ml-1 cursor-pointer"
              >
                Review & Publish
              </button>
            </div>
          )}

          {/* Sheet Duplicate or Error Warning */}
          {duplicateWarning && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-2 rounded flex items-start space-x-1.5">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>{duplicateWarning}</span>
            </div>
          )}

          {sheetError && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs p-2 rounded flex items-start space-x-1.5">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{sheetError}</span>
            </div>
          )}

          {/* DYNAMIC PRODUCT LOOKUP FORM */}
          <div className="space-y-3 text-xs font-sans">

            {/* 1. UNIFIED SEARCHABLE PRODUCT DROPDOWN */}
            <div className="relative">
              <div className="flex justify-between items-center mb-1">
                <label className="font-semibold text-slate-700">
                  Product Selection & Search
                  <span className="ml-1 text-[10px] text-indigo-600 font-normal">
                    (Type e.g. 20/1 KH, 30/2 kw)
                  </span>
                </label>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => setShowAddProductModal(true)}
                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer"
                    title="Add a new yarn product to dropdown"
                  >
                    + Add Product
                  </button>
                )}
              </div>

              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
                  <Search className="w-3.5 h-3.5" />
                </div>

                <input
                  ref={productInputRef}
                  id="input-product-search"
                  type="text"
                  value={productSearchInput}
                  onChange={(e) => {
                    setProductSearchInput(e.target.value);
                    setIsProductDropdownOpen(true);
                  }}
                  onFocus={() => setIsProductDropdownOpen(true)}
                  onKeyDown={(e) => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setHighlightedIndex((prev) => (prev < filteredProducts.length - 1 ? prev + 1 : 0));
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredProducts.length - 1));
                    } else if (e.key === 'Enter') {
                      e.preventDefault();
                      if (highlightedIndex >= 0 && highlightedIndex < filteredProducts.length) {
                        handleSelectProduct(filteredProducts[highlightedIndex]);
                      } else if (filteredProducts.length > 0) {
                        handleSelectProduct(filteredProducts[0]);
                      }
                    } else if (e.key === 'Escape') {
                      setIsProductDropdownOpen(false);
                    }
                  }}
                  placeholder="Type count or quality (e.g. 20/1, 30/2)..."
                  className="w-full bg-white border border-slate-300 rounded pl-8 pr-16 py-1.5 font-medium text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                />

                <div className="absolute inset-y-0 right-0 pr-1.5 flex items-center space-x-1">
                  {productSearchInput && (
                    <button
                      type="button"
                      onClick={() => {
                        setProductSearchInput('');
                        setSelectedYarnCount('');
                        setSelectedQuality('');
                        setMatchedRecord(null);
                        setExMillPrice(0);
                        setIsProductDropdownOpen(true);
                      }}
                      className="text-slate-400 hover:text-slate-600 p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsProductDropdownOpen(!isProductDropdownOpen)}
                    className="text-slate-400 hover:text-slate-600 p-0.5"
                  >
                    <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Suggestions Dropdown */}
              {isProductDropdownOpen && (
                <div
                  ref={dropdownRef}
                  id="dropdown-product-suggestions"
                  className="absolute z-30 mt-1 w-full bg-white border border-slate-300 rounded shadow-lg max-h-60 overflow-y-auto py-1 text-xs"
                >
                  {filteredProducts.length === 0 ? (
                    <div className="px-3 py-2 text-slate-500 italic">
                      No products matching "{productSearchInput}" found in Google Sheet.
                    </div>
                  ) : (
                    filteredProducts.map((item, idx) => {
                      const isSelected = item.yarnCount === selectedYarnCount && item.quality === selectedQuality;
                      const isHighlighted = idx === highlightedIndex;
                      const hasPrice = item.exMillPrice !== null && item.exMillPrice > 0;

                      return (
                        <div
                          key={`${item.yarnCount}_${item.quality}_${idx}`}
                          onClick={() => handleSelectProduct(item)}
                          onMouseEnter={() => setHighlightedIndex(idx)}
                          className={`px-3 py-2 cursor-pointer flex items-center justify-between transition-colors border-b border-slate-100 last:border-0 ${
                            isHighlighted ? 'bg-indigo-50 text-indigo-900' : isSelected ? 'bg-slate-100 font-semibold text-slate-900' : 'text-slate-700 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex flex-col space-y-0.5">
                            <div className="flex items-center space-x-2">
                              <span className="font-mono font-bold text-slate-900">{item.yarnCount}</span>
                              <span className="font-semibold text-indigo-900">{item.quality}</span>
                            </div>
                            <span className="text-[10px] text-slate-500">
                              {item.category || 'Yarn'} · {item.factoryLocation || 'Location N/A'}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2">
                            {isPricingLocked ? (
                              <span className="font-mono font-bold text-amber-700 text-xs">🔒 Locked</span>
                            ) : isAdmin && (
                              <span className="font-mono font-bold text-emerald-700">
                                {hasPrice ? `₹${formatDecimal4(item.exMillPrice!)}` : 'Price N/A'}
                              </span>
                            )}
                            {isSelected && <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />}
                          </div>
                        </div>
                      );
                    })
                  )}

                  {isAdmin && (
                    <div
                      onClick={() => {
                        setIsProductDropdownOpen(false);
                        setShowAddProductModal(true);
                      }}
                      className="px-3 py-2 bg-slate-50 hover:bg-indigo-50 border-t border-slate-200 text-indigo-600 font-semibold cursor-pointer flex items-center space-x-1.5"
                    >
                      <span>+ Add / Input New Yarn Product...</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2. EX-MILL PRICE (SHOWN TO ADMIN ONLY) & FACTORY LOCATION */}
            <div className={isAdmin ? "grid grid-cols-2 gap-3 pt-1" : "pt-1"}>
              {isAdmin && (
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="font-semibold text-slate-700">
                      Ex-Mill Price (₹/kg)
                    </label>
                  </div>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1.5 text-xs text-slate-400 font-bold">₹</span>
                    <input
                      id="input-ex-mill"
                      type="text"
                      readOnly
                      value={isPricingLocked ? '🔒 Locked (12:00 AM)' : (matchedRecord && exMillPrice > 0 ? formatDecimal4(exMillPrice) : '—')}
                      placeholder="Auto-populated"
                      className="w-full bg-slate-100 border border-slate-300 rounded px-2.5 pl-6 py-1 font-mono font-bold text-slate-900 cursor-not-allowed text-right tabular-nums focus:outline-none select-none"
                      title={isPricingLocked ? "Ex-Mill price locked at 12:00 AM" : "Ex-Mill Purchase Price"}
                    />
                  </div>
                </div>
              )}

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="font-semibold text-slate-700">
                    Factory Location
                  </label>
                </div>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none text-slate-400">
                    <Building2 className="w-3.5 h-3.5" />
                  </div>
                  <input
                    id="input-factory-location"
                    type="text"
                    readOnly
                    value={matchedRecord ? (factoryLocation || 'Factory Location not available.') : '—'}
                    placeholder="From matching row"
                    className="w-full bg-slate-100 border border-slate-300 rounded pl-7 pr-2.5 py-1 font-medium text-slate-800 cursor-not-allowed focus:outline-none select-none truncate"
                  />
                </div>
              </div>
            </div>

            {/* Missing Data Warning */}
            {(!matchedRecord || !matchedRecord.exMillPrice) && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-2 rounded font-sans">
                Ex-Mill Price not available for this selected product.
              </div>
            )}

            {/* 3. OTHER PARAMETERS (QTY, MARGIN, BCI, COMMISSION) */}
            <div className="space-y-3 pt-1.5">
              {/* Row 1: Packing & Terms of payment */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1 truncate text-xs">Packing</label>
                  <select
                    id="select-qty-fcl"
                    value={selectedQty}
                    onChange={(e) => setSelectedQty(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-600 text-xs shadow-xs"
                  >
                    {quantityOptions.map((q) => (
                      <option key={q.id} value={q.qty_per_fcl}>
                        {q.packing_type} ({formatFclAmount(q.qty_per_fcl)} kg)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1 truncate text-xs">Terms of payment</label>
                  <select
                    id="select-margin-term"
                    value={selectedMarginCode}
                    onChange={(e) => setSelectedMarginCode(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 py-1.5 font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-600 text-xs shadow-xs"
                  >
                    {marginTerms.map((m) => (
                      <option key={m.id} value={m.term_code}>
                        {m.term_label} {isAdmin ? `(${m.margin_pct}%)` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2: BCI / Org Premium */}
              <div>
                <label htmlFor="input-bci-org" className="block font-semibold text-slate-700 mb-1 truncate text-xs">
                  BCI / Org Premium (₹/kg)
                </label>
                <div className="relative">
                  <span className="absolute left-2.5 top-1.5 text-xs text-slate-400 font-bold">₹</span>
                  <input
                    id="input-bci-org"
                    type="number"
                    step="0.10"
                    min="0"
                    value={bciOrg === 0 ? '' : bciOrg}
                    placeholder="0.00"
                    onChange={(e) => {
                      const val = e.target.value === '' ? 0 : Number(e.target.value);
                      setBciOrg(isNaN(val) ? 0 : val);
                    }}
                    className="w-full bg-white border border-slate-300 rounded px-2.5 pl-6 py-1.5 font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-600 text-left tabular-nums text-xs shadow-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                  />
                </div>
              </div>

              {/* Row 3: Commission - Dedicated full width for large, clear number visibility */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="input-commission-val" className="font-semibold text-slate-700 text-xs">
                    Commission
                  </label>
                </div>

                <div className="flex items-center rounded-lg border border-slate-300 bg-white shadow-xs focus-within:ring-2 focus-within:ring-indigo-600 focus-within:border-indigo-600 overflow-hidden">
                  <input
                    id="input-commission-val"
                    type="text"
                    inputMode="decimal"
                    value={commissionInputStr}
                    placeholder={commissionType === 'USD_PER_KG' ? "0.01" : "0.00"}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^0-9.]/g, '');
                      const parts = raw.split('.');
                      const sanitized = parts.length > 2 ? `${parts[0]}.${parts.slice(1).join('')}` : raw;
                      setCommissionInputStr(sanitized);
                      if (sanitized === '' || sanitized === '.') {
                        setCommissionValue(0);
                      } else {
                        const parsed = parseFloat(sanitized);
                        setCommissionValue(isNaN(parsed) ? 0 : parsed);
                      }
                    }}
                    onBlur={() => {
                      if (commissionInputStr === '' || commissionInputStr === '.') {
                        setCommissionInputStr('');
                        setCommissionValue(0);
                      }
                    }}
                    className="flex-1 min-w-0 bg-transparent px-3 py-2 font-mono font-bold text-slate-900 focus:outline-none text-left tabular-nums text-sm placeholder:text-slate-300"
                  />
                  {/* Commission Unit Dropdown - Compact & Responsive */}
                  <div className="relative shrink-0 border-l border-slate-200 bg-slate-50">
                    <select
                      id="select-commission-unit"
                      value={commissionType}
                      onChange={(e) => handleCommissionTypeChange(e.target.value as CommissionType)}
                      className="h-full appearance-none bg-transparent pl-2.5 sm:pl-3 pr-7 sm:pr-8 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 focus:outline-none cursor-pointer"
                      title="Select Commission Unit: $/kg or %"
                    >
                      <option value="USD_PER_KG">$/kg</option>
                      <option value="PCT">%</option>
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2 text-slate-400">
                      <ChevronDown className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>

          {/* Breakdown Rows & Quotation Prices */}
          {isPricingLocked ? (
            <div className="bg-amber-50 border border-amber-300 text-amber-950 rounded-xl p-4 text-center text-xs font-semibold space-y-2">
              <div className="inline-flex items-center space-x-1.5 font-black text-amber-900 text-sm">
                <Lock className="w-4 h-4 text-amber-700 shrink-0" />
                <span>ALL 3 GOOGLE SHEET PRICES ARE LOCKED (12:00 AM)</span>
              </div>
              <p className="text-xs text-amber-800 font-normal max-w-md mx-auto">
                No calculations can be performed by employees or admins while prices are locked. Admin must click <strong>"Keep Yesterday's Prices (1-Click)"</strong> or edit prices in Google Sheet to unlock calculations.
              </p>
            </div>
          ) : (
            <div className="bg-slate-50 rounded border border-slate-200 p-3 space-y-1.5 text-xs font-mono tabular-nums">
              {isAdmin && (
                <>
                  <div className="flex justify-between">
                    <span className="font-sans text-slate-700">Ex-Mill Price</span>
                    <span className="font-bold text-slate-900">{exMillPrice > 0 ? formatDecimal4(exMillPrice) : '—'}</span>
                  </div>

                  <div className="flex justify-between text-slate-600">
                    <span className="font-sans">
                      DDB & RoDTEP ({calcResults?.assumptions?.ddb_rodtep_pct ?? 5}%)
                    </span>
                    <span className="text-slate-800">
                      {calcResults?.ddb_rodtep != null ? `-${formatDecimal4(calcResults.ddb_rodtep)}` : (exMillPrice > 0 ? `-${formatDecimal4(exMillPrice * 0.05)}` : '—')}
                    </span>
                  </div>

                  <div className="flex justify-between font-semibold text-slate-800 border-t border-slate-200 pt-1">
                    <span className="font-sans">Net Ex-Mill</span>
                    <span>
                      {calcResults?.net_ex_mill != null ? formatDecimal4(calcResults.net_ex_mill) : (exMillPrice > 0 ? formatDecimal4(exMillPrice * 0.95) : '—')}
                    </span>
                  </div>
                </>
              )}

              <div className="flex justify-between text-slate-600">
                <span className="font-sans">FOB Cost</span>
                <span>{calcResults?.fob_cost_per_kg != null ? formatDecimal4(calcResults.fob_cost_per_kg) : (fobCostPerKg !== null ? formatDecimal4(fobCostPerKg) : '—')}</span>
              </div>

              <div className="flex justify-between text-slate-600">
                <span className="font-sans">Freight</span>
                <span>{calcResults?.freight_per_kg != null ? formatDecimal4(calcResults.freight_per_kg) : '—'}</span>
              </div>

              {isAdmin && (
                <div className="flex justify-between font-bold text-slate-900 border-t border-slate-300 pt-1">
                  <span className="font-sans">Total Cost</span>
                  <span className="text-slate-900">
                    {calcResults?.total_cost != null ? formatDecimal4(calcResults.total_cost) : '—'}
                  </span>
                </div>
              )}

              <div className="flex justify-between text-slate-600">
                <span className="font-sans">BCI / Org</span>
                <span>{bciOrg > 0 ? formatDecimal4(bciOrg) : '0.00'}</span>
              </div>

              <div>
                <div className="flex justify-between items-center text-slate-600">
                  <span className="font-sans flex items-center gap-1.5 min-w-0">
                    <span>Commission</span>
                    <span className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded shrink-0">
                      {commissionType === 'PCT'
                        ? `${commissionValue}%`
                        : `$${commissionValue}/kg`}
                    </span>
                  </span>
                  <span className="font-semibold text-slate-800 shrink-0 font-mono pl-2">
                    {calcResults?.commission_inr != null
                      ? formatDecimal4(calcResults.commission_inr)
                      : (commissionType === 'PCT'
                          ? (calcResults?.total_cost != null ? formatDecimal4(((calcResults.total_cost + bciOrg) * commissionValue) / 100) : '—')
                          : formatDecimal4(commissionValue * (calcResults?.fx?.usd_inr || 86.5))
                        )}
                  </span>
                </div>
              </div>

              {isAdmin && (
                <div className="flex justify-between text-slate-600">
                  <span className="font-sans">
                    margin({calcResults?.assumptions?.margin_pct ?? 3}%)
                  </span>
                  <span>
                    {calcResults?.total_cost != null ? formatDecimal4((calcResults.total_cost * (calcResults?.assumptions?.margin_pct || 3))/100) : '—'}
                  </span>
                </div>
              )}

              <div className="border-t-2 border-slate-300 pt-2 space-y-1.5">
                {!dailyPricingStatus?.isConfirmedForToday ? (
                  <>
                    <div className="bg-amber-50 border border-amber-300 text-amber-900 rounded p-2.5 text-xs flex flex-col space-y-1 shadow-2xs">
                      <div className="flex items-center space-x-1.5 font-bold text-amber-900">
                        <Lock className="w-3.5 h-3.5 text-amber-700 shrink-0" />
                        <span>DAILY PRICING LOCKED (12:00 AM RESET)</span>
                      </div>
                      <p className="text-[11px] text-amber-800 font-sans leading-relaxed">
                        Prices expired at 12:00 AM IST. All price quoting is locked until Admin confirms or updates today's rates.
                      </p>
                    </div>

                    <div className="flex justify-between items-center font-black text-sm bg-slate-100 p-2 rounded border border-slate-200 text-slate-400 select-none">
                      <span className="font-sans uppercase flex items-center space-x-1">
                        <span className="bg-slate-300 text-slate-500 text-[10px] px-1.5 py-0.5 rounded font-mono">USD</span>
                        <span>USD PRICE</span>
                      </span>
                      <span className="text-slate-400 text-base font-extrabold font-mono tabular-nums">
                        $ —
                      </span>
                    </div>

                    <div className="flex justify-between items-center font-bold text-xs bg-slate-100 p-2 rounded border border-slate-200 text-slate-400 select-none">
                      <span className="font-sans uppercase flex items-center space-x-1">
                        <span className="bg-slate-300 text-slate-500 text-[10px] px-1.5 py-0.5 rounded font-mono">EUR</span>
                        <span>EUR PRICE</span>
                      </span>
                      <span className="text-slate-400 text-sm font-extrabold font-mono tabular-nums">
                        € —
                      </span>
                    </div>
                  </>
                ) : !((customerName && customerName.trim()) || (agentName && agentName.trim())) ? (
                  <>
                    <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded p-2.5 text-xs flex flex-col space-y-1">
                      <div className="flex items-center space-x-1.5 font-bold text-amber-800">
                        <Lock className="w-3.5 h-3.5 shrink-0" />
                        <span>PRICING LOCKED</span>
                      </div>
                      <p className="text-[11px] text-amber-700 font-sans leading-relaxed">
                        Select a Buyer or Local Agent at the top to unlock exporting price calculations.
                      </p>
                    </div>

                    <div className="flex justify-between items-center font-black text-sm bg-slate-100 p-2 rounded border border-slate-200 text-slate-400 select-none">
                      <span className="font-sans uppercase flex items-center space-x-1">
                        <span className="bg-slate-300 text-slate-500 text-[10px] px-1.5 py-0.5 rounded font-mono">USD</span>
                        <span>USD PRICE</span>
                      </span>
                      <span className="text-slate-400 text-base font-extrabold font-mono tabular-nums">
                        $ —
                      </span>
                    </div>

                    <div className="flex justify-between items-center font-bold text-xs bg-slate-100 p-2 rounded border border-slate-200 text-slate-400 select-none">
                      <span className="font-sans uppercase flex items-center space-x-1">
                        <span className="bg-slate-300 text-slate-500 text-[10px] px-1.5 py-0.5 rounded font-mono">EUR</span>
                        <span>EUR PRICE</span>
                      </span>
                      <span className="text-slate-400 text-sm font-extrabold font-mono tabular-nums">
                        € —
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between items-center font-black text-sm bg-emerald-50/80 p-2 rounded border border-emerald-200">
                      <span className="font-sans text-emerald-950 uppercase flex items-center space-x-1">
                        <span className="bg-emerald-600 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">USD</span>
                        <span>USD PRICE</span>
                      </span>
                      <span className="text-emerald-700 text-base font-extrabold font-mono tabular-nums">
                        {calcResults?.usd_price != null ? `$ ${formatDecimal4(calcResults.usd_price)} / kg` : '$ —'}
                      </span>
                    </div>

                    <div className="flex justify-between items-center font-bold text-xs bg-blue-50/80 p-2 rounded border border-blue-200 text-slate-800">
                      <span className="font-sans uppercase text-blue-950 flex items-center space-x-1">
                        <span className="bg-blue-600 text-white text-[10px] px-1.5 py-0.5 rounded font-mono">EUR</span>
                        <span>EUR PRICE</span>
                      </span>
                      <span className="text-blue-700 text-sm font-extrabold font-mono tabular-nums">
                        {calcResults?.eur_price != null ? `€ ${formatDecimal4(calcResults.eur_price)} / kg` : '€ —'}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

        </div>

      </div>

      {/* Zoho CRM & Offer Quote Section */}
      <ZohoQuoteSection
        currentYarnCount={selectedYarnCount}
        currentQuality={selectedQuality}
        currentUsdPrice={((customerName && customerName.trim()) || (agentName && agentName.trim())) ? (calcResults?.usd_price ?? null) : null}
        selectedDestination={selectedDestination}
        selectedMarginCode={selectedMarginCode}
        marginTerms={marginTerms}
        selectedPacking={quantityOptions.find(q => q.qty_per_fcl === selectedQty)?.packing_type || 'Pallet Packing'}
        selectedQty={selectedQty}
        commissionType={commissionType}
        commissionValue={commissionValue}
        commissionText={commissionValue > 0 ? (commissionType === 'PCT' ? `${commissionValue}%` : `$${commissionValue}/kg`) : 'Nil'}
        currency="USD"
        customerName={customerName}
        setCustomerName={setCustomerName}
        agentName={agentName}
        setAgentName={setAgentName}
        zohoAccounts={zohoAccounts}
        isZohoConnected={isZohoConnected}
        isLoadingAccounts={isLoadingAccounts}
        fetchZohoAccounts={fetchZohoAccounts}
        zohoError={zohoError}
        currentUser={currentUser}
        dailyPricingConfirmed={Boolean(dailyPricingStatus?.isConfirmedForToday)}
        loginSessionId={loginSessionId}
      />

      {/* Modal: Quick Add Destination Port */}
      {showAddPortModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Ship className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-sm">Add New Destination Port</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddPortModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Destination Port Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Surat, Nhava Sheva, Chittagong..."
                  value={newPortName}
                  onChange={(e) => setNewPortName(e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-slate-900 font-medium focus:ring-1 focus:ring-indigo-600 focus:outline-none"
                  autoFocus
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Freight Rate (USD / 40' HC) <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. 2400"
                  value={newPortAmount}
                  onChange={(e) => setNewPortAmount(e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-slate-900 font-medium focus:ring-1 focus:ring-indigo-600 focus:outline-none font-mono"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddPortModal(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!newPortName.trim() || isAddingPort}
                  onClick={handleAddNewDestination}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-sm disabled:opacity-50 cursor-pointer flex items-center space-x-1.5"
                >
                  {isAddingPort ? <span>Adding...</span> : <span>Add to Dropdown</span>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Quick Add FOB Location */}
      {showAddFobModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <MapPin className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-sm">Add New FOB Location</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddFobModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Location / Port Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Surat, Mundra, Kolhapur..."
                  value={newFobName}
                  onChange={(e) => setNewFobName(e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-slate-900 font-medium focus:ring-1 focus:ring-indigo-600 focus:outline-none"
                  autoFocus
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  FOB Cost (₹ / Qty) <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. 75000"
                  value={newFobPrice}
                  onChange={(e) => setNewFobPrice(e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-slate-900 font-medium focus:ring-1 focus:ring-indigo-600 focus:outline-none font-mono"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddFobModal(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!newFobName.trim() || isAddingFob}
                  onClick={handleAddNewFobLocation}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-sm disabled:opacity-50 cursor-pointer flex items-center space-x-1.5"
                >
                  {isAddingFob ? <span>Adding...</span> : <span>Add to Dropdown</span>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Quick Add Yarn Product */}
      {showAddProductModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full border border-slate-200 overflow-hidden">
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileSpreadsheet className="w-5 h-5 text-indigo-400" />
                <h3 className="font-bold text-sm">Add New Yarn Product</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddProductModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Yarn Count <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. NE 30/1, 32/2"
                    value={newProductCount}
                    onChange={(e) => setNewProductCount(e.target.value)}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-slate-900 font-medium focus:ring-1 focus:ring-indigo-600 focus:outline-none"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Quality <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. KH, KW, CH"
                    value={newProductQuality}
                    onChange={(e) => setNewProductQuality(e.target.value)}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-slate-900 font-medium focus:ring-1 focus:ring-indigo-600 focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Ex-Mill Price (₹ / kg) <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. 295.00"
                  value={newProductPrice}
                  onChange={(e) => setNewProductPrice(e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-slate-900 font-medium focus:ring-1 focus:ring-indigo-600 focus:outline-none font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Factory Location <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Gujrat, Nagpur, Tamil Nadu..."
                  value={newProductLocation}
                  onChange={(e) => setNewProductLocation(e.target.value)}
                  className="w-full border border-slate-300 rounded px-3 py-2 text-slate-900 font-medium focus:ring-1 focus:ring-indigo-600 focus:outline-none"
                />
              </div>
              <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddProductModal(false)}
                  className="px-3 py-1.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!newProductCount.trim() || !newProductQuality.trim() || isAddingProduct}
                  onClick={handleAddNewProduct}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-sm disabled:opacity-50 cursor-pointer flex items-center space-x-1.5"
                >
                  {isAddingProduct ? <span>Adding...</span> : <span>Add to Dropdown</span>}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

