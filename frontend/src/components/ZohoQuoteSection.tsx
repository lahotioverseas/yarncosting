import React, { useState, useEffect } from 'react';
import { UserCheck, Plus, Trash2, Copy, Check, MessageSquare, Send, Database, RefreshCw, AlertCircle, Sparkles, User, ExternalLink, CheckCircle2, Calendar, Clock } from 'lucide-react';

import { ZohoAccountItem, UserProfile } from '../types';
import { SYSTEM_USERS } from '../lib/authData';

export interface QuoteBasketItem {
  id: string;
  yarnCount: string;
  quality: string;
  yarn_description: string;
  usdPrice: number;
  quantity?: number;
  packing?: string;
  amount?: number;
}

interface ZohoQuoteSectionProps {
  currentYarnCount: string;
  currentQuality: string;
  currentUsdPrice: number | null;
  selectedDestination: string;
  selectedMarginCode: string;
  marginTerms: Array<{ term_code: string; term_label: string }>;
  selectedPacking?: string;
  selectedQty?: number;
  commissionType?: 'PCT' | 'USD_PER_KG';
  commissionValue?: number;
  commissionText?: string;
  currency?: string;
  customerName: string;
  setCustomerName?: (name: string) => void;
  agentName: string;
  setAgentName?: (name: string) => void;
  zohoAccounts: ZohoAccountItem[];
  isZohoConnected: boolean;
  isLoadingAccounts: boolean;
  fetchZohoAccounts: () => void;
  zohoError: string | null;
  currentUser?: UserProfile | null;
  dailyPricingConfirmed?: boolean;
  loginSessionId?: string;
}

export const ZohoQuoteSection: React.FC<ZohoQuoteSectionProps> = ({
  currentYarnCount,
  currentQuality,
  currentUsdPrice,
  selectedDestination,
  selectedMarginCode,
  marginTerms,
  selectedPacking = 'Pallet Packing',
  selectedQty = 21000,
  commissionType = 'PCT',
  commissionValue = 0,
  commissionText,
  currency = 'USD',
  customerName,
  agentName,
  zohoAccounts,
  isZohoConnected,
  isLoadingAccounts,
  fetchZohoAccounts,
  zohoError,
  currentUser,
  dailyPricingConfirmed = false,
  loginSessionId,
}) => {
  // Multi-product Quote Basket
  const [quoteBasket, setQuoteBasket] = useState<QuoteBasketItem[]>([]);

  // Zoho Deal Owner state (defaults to currently logged-in user)
  const [selectedOwnerEmail, setSelectedOwnerEmail] = useState<string>(() => {
    return currentUser?.email || SYSTEM_USERS[0].email;
  });

  // Last Created Deal tracking with rich attributes
  const [lastCreatedDeal, setLastCreatedDeal] = useState<{
    id: string;
    url: string;
    urlCom?: string;
    urlIn?: string;
    owner: string;
    account: string;
    name: string;
    stage?: string;
    time: string;
    amount?: number;
    currency?: string;
    packing?: string;
    commission?: string;
    terms?: string;
    closingDate?: string;
    products?: any[];
    task?: {
      id?: string;
      subject: string;
      due_date?: string;
      owner?: string;
      status?: string;
      priority?: string;
    } | null;
  } | null>(null);

  // Always reset and clear the quote basket and feedback whenever:
  // 1) A different user logs in or is switched to
  // 2) The same user logs in again
  // 3) A new login session is created
  useEffect(() => {
    setQuoteBasket([]);
    setLastCreatedDeal(null);
    setRecordSuccessMessage(null);
    if (currentUser?.email) {
      setSelectedOwnerEmail(currentUser.email);
    }
  }, [currentUser?.id, currentUser?.email, loginSessionId]);

  // Active resolved deal owner
  const activeOwner = SYSTEM_USERS.find(u => u.email.toLowerCase() === selectedOwnerEmail.toLowerCase()) || currentUser;
  
  // Feedback states
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordSuccessMessage, setRecordSuccessMessage] = useState<string | null>(null);

  // Helper to map trade quality short forms to Zoho ERP product terms
  const mapQualityToZohoErp = (qual: string): string => {
    if (!qual) return qual;
    const q = qual.trim().toUpperCase();

    if (q === 'KH') return 'KH - A';
    if (q === 'CH') return 'CH-A';
    if (q === 'CCH' || q === 'CC H') return 'CH-A-CMPT';
    if (q === 'KW') return 'KW - A';
    if (q === 'CW') return 'CW - A';
    if (q === 'CCW' || q === 'CC W') return 'CW - A - CMPT';
    if (q === 'KW/KH SOFT TWIST' || q.includes('SOFT TWIST')) return 'KH - A';
    if (q === 'KW HARD TWIST' || q.includes('HARD TWIST')) return 'KW - A';

    return qual.trim();
  };

  // Helper to format yarn description according to Zoho ERP Product specifications
  const formatYarnDescription = (count: string, qual: string) => {
    let c = count.trim();
    if (!c.toLowerCase().startsWith('ne')) {
      c = `Ne ${c}`;
    }
    const erpQuality = mapQualityToZohoErp(qual);
    return `${c} ${erpQuality}`;
  };

  // Active product inquiry quantity state
  const [activeProductQty, setActiveProductQty] = useState<number>(() => selectedQty || 21000);

  useEffect(() => {
    if (selectedQty && selectedQty > 0) {
      setActiveProductQty(selectedQty);
    }
  }, [selectedQty]);

  // Update item quantity in quote basket
  const handleUpdateItemQuantity = (id: string, newQty: number) => {
    const validQty = Math.max(1, Math.round(newQty || 0));
    setQuoteBasket(prev => prev.map(item => {
      if (item.id === id) {
        const newAmount = Number((item.usdPrice * validQty).toFixed(2));
        return { ...item, quantity: validQty, amount: newAmount };
      }
      return item;
    }));
  };

  // Add active product to basket
  const handleAddCurrentProduct = () => {
    if (!currentUsdPrice || currentUsdPrice <= 0) return;
    const desc = formatYarnDescription(currentYarnCount, currentQuality);
    const packing = selectedPacking || 'Pallet Packing';
    const qty = activeProductQty || selectedQty || 21000;
    const itemAmount = Number((currentUsdPrice * qty).toFixed(2));

    // Prevent duplicate exact count+qual
    const exists = quoteBasket.find(
      item => item.yarnCount.toLowerCase() === currentYarnCount.toLowerCase() &&
              item.quality.toLowerCase() === currentQuality.toLowerCase()
    );

    if (exists) {
      // Update existing item price
      setQuoteBasket(prev => prev.map(item =>
        item.id === exists.id 
          ? { ...item, usdPrice: currentUsdPrice, quantity: qty, packing, amount: itemAmount } 
          : item
      ));
    } else {
      setQuoteBasket(prev => [
        ...prev,
        {
          id: 'item_' + Date.now().toString(36),
          yarnCount: currentYarnCount,
          quality: currentQuality,
          yarn_description: desc,
          usdPrice: currentUsdPrice,
          quantity: qty,
          packing,
          amount: itemAmount,
        }
      ]);
    }
  };

  const handleRemoveProduct = (id: string) => {
    setQuoteBasket(prev => prev.filter(item => item.id !== id));
  };

  // Get human readable Payment Term label
  const matchedMarginTerm = marginTerms.find(m => m.term_code === selectedMarginCode);
  const paymentTermLabel = matchedMarginTerm ? matchedMarginTerm.term_label : 'LC at sight';

  // Format Destination & Payment Term Line (e.g. "CNF Chittagong, Lc 120 days from BL date")
  const formatTermsLine = () => {
    const dest = selectedDestination || 'Chittagong';
    return `CNF ${dest}, ${paymentTermLabel}`;
  };

  const resolvedCommissionStr = commissionText || (commissionValue > 0
    ? (commissionType === 'PCT' ? `${commissionValue}%` : `$${commissionValue}/kg`)
    : 'Nil');

  // Generate Standard Format Text Quote
  const generateFormattedTextQuote = () => {
    if (!dailyPricingConfirmed) {
      return "⚠️ PRICING LOCKED: Today's daily rates have expired at 12:00 AM (00:00 IST). Waiting for Admin to review and activate today's prices before quotation can be issued.";
    }
    if (!customerName?.trim() && !agentName?.trim()) {
      return "⚠️ No price or quotation is generated. Please select a Buyer or Agent at the top first.";
    }
    let text = "We are pleased to offer as below -\n";
    if (customerName?.trim()) {
      text += `Customer: ${customerName.trim()}\n`;
    }
    if (agentName?.trim()) {
      text += `Local Agent: ${agentName.trim()}\n`;
    }
    text += "\nProducts:\n";
    if (quoteBasket.length === 0) {
      const q = activeProductQty || selectedQty || 21000;
      text += `${formatYarnDescription(currentYarnCount, currentQuality)} - USD ${currentUsdPrice ? currentUsdPrice.toFixed(2) : '0.00'} / kg | Qty: ${q.toLocaleString()} kg\n`;
    } else {
      quoteBasket.forEach(item => {
        const q = item.quantity || 21000;
        text += `${item.yarn_description} - USD ${item.usdPrice.toFixed(2)} / kg | Qty: ${q.toLocaleString()} kg\n`;
      });
    }
    text += "\nTerms: " + formatTermsLine();
    if (selectedPacking) {
      text += `\nPacking: ${selectedPacking}`;
    }
    if (resolvedCommissionStr && resolvedCommissionStr !== 'Nil') {
      text += `\nCommission: ${resolvedCommissionStr}`;
    }
    if (activeOwner?.name) {
      text += `\n\nOffered by: ${activeOwner.name} | Lahoti Overseas`;
    }
    return text;
  };

  const formattedQuoteText = generateFormattedTextQuote();

  // Copy to Clipboard
  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(formattedQuoteText);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    } catch (err) {
      console.error('Failed to copy text:', err);
    }
  };

  // Open WhatsApp
  const handleSendWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(formattedQuoteText)}`;
    window.open(url, '_blank');
  };

  // Record Quote & Create Zoho Deal
  const handleRecordQuoteAndCreateDeal = async () => {
    setIsRecording(true);
    setRecordSuccessMessage(null);
    try {
      const packingType = selectedPacking || 'Pallet Packing';
      const defaultQty = selectedQty || 21000;
      const termsLine = formatTermsLine();
      const quoteCurrency = currency || 'USD';
      const commissionStr = resolvedCommissionStr;

      const parseCleanQty = (raw: any): number => {
        const clean = String(raw ?? '').replace(/[^0-9.]/g, '');
        const n = Math.round(parseFloat(clean) || defaultQty);
        return Number.isInteger(n) && n > 0 ? n : defaultQty;
      };

      const itemsToRecord = quoteBasket.length > 0
        ? quoteBasket.map(item => {
            const cleanQty = parseCleanQty(item.quantity);
            const lineAmount = Number((item.usdPrice * cleanQty).toFixed(2));
            return {
              ...item,
              quantity: cleanQty,
              usdPrice: item.usdPrice,
              amount: lineAmount,
            };
          })
        : (currentUsdPrice && currentUsdPrice > 0 ? [{
            id: 'item_active',
            yarnCount: currentYarnCount,
            quality: currentQuality,
            yarn_description: formatYarnDescription(currentYarnCount, currentQuality),
            usdPrice: currentUsdPrice,
            quantity: parseCleanQty(defaultQty),
            amount: Number((currentUsdPrice * parseCleanQty(defaultQty)).toFixed(2)),
          }] : []);

      const totalDealAmount = itemsToRecord.reduce((acc, item) => acc + item.amount, 0);
      const ownerName = activeOwner?.name || currentUser?.name || 'Trader';
      const ownerEmail = activeOwner?.email || currentUser?.email || '';

      const res = await fetch('/api/zoho/create-deal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          account_name: customerName || agentName || 'Valued Customer',
          deal_name: `Yarn Quote - ${customerName || 'Valued Customer'} ${agentName ? `via Agent ${agentName}` : ''} (${itemsToRecord.length} ${itemsToRecord.length === 1 ? 'Item' : 'Items'})`,
          amount: Number(totalDealAmount.toFixed(2)),
          products: itemsToRecord,
          text_quote: formattedQuoteText,
          destination_port: selectedDestination,
          payment_term: paymentTermLabel,
          packing: packingType,
          commission: commissionStr,
          terms: termsLine,
          currency: quoteCurrency,
          agent_name: agentName,
          owner_name: ownerName,
          owner_email: ownerEmail,
        })
      });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('Server returned non-JSON response while creating deal. Please try again.');
      }
      const data = await res.json();
      if (data && data.success) {
        setRecordSuccessMessage(data.message);
        if (data.zoho_deal_id) {
          const dealId = String(data.zoho_deal_id);
          const dealUrl = data.zoho_deal_url || `https://crm.zoho.com/crm/tab/Potentials/${dealId}`;
          const dealUrlCom = data.zoho_deal_url_com || `https://crm.zoho.com/crm/tab/Potentials/${dealId}`;
          const dealUrlIn = data.zoho_deal_url_in || `https://crm.zoho.in/crm/tab/Potentials/${dealId}`;
          const assignedOwner = data.owner_assigned || ownerName;
          const details = data.deal_details;
          const followUpTask = data.follow_up_task || details?.task || null;
          setLastCreatedDeal({
            id: dealId,
            url: dealUrl,
            urlCom: dealUrlCom,
            urlIn: dealUrlIn,
            owner: assignedOwner,
            account: customerName || agentName || 'Valued Customer',
            name: `Yarn Quote - ${customerName || 'Valued Customer'}`,
            stage: details?.stage || 'Quote sent',
            time: new Date().toLocaleTimeString(),
            amount: details?.amount ?? Number(totalDealAmount.toFixed(2)),
            currency: details?.currency || quoteCurrency,
            packing: details?.packing || packingType,
            commission: details?.commission || commissionStr,
            terms: details?.terms || termsLine,
            closingDate: details?.closing_date,
            products: details?.products || itemsToRecord,
            task: followUpTask,
          });
        }
      } else {
        setRecordSuccessMessage(data.error || 'Failed to record quote.');
      }
    } catch (err: any) {
      console.error('Record deal error:', err);
      setRecordSuccessMessage('Error connecting to server.');
    } finally {
      setIsRecording(false);
    }
  };

  // If daily pricing is expired or not updated for today, lock quotation & Zoho deal creation
  if (!dailyPricingConfirmed) {
    return (
      <div id="zoho-quote-section-locked" className="bg-amber-50 border border-amber-300 text-amber-950 rounded-xl p-5 text-center text-xs font-semibold shadow-xs my-6 flex flex-col items-center justify-center space-y-1.5">
        <div className="flex items-center space-x-2 text-amber-900 font-bold text-sm">
          <span>⚠️ Quotations & Zoho CRM Deals Locked</span>
        </div>
        <p className="text-slate-700 max-w-xl">
          Prices are not updated for today. To protect against creating deals with outdated rates, quote generation and deal creation are locked until the Admin reviews and publishes today's prices in the Excel Editor.
        </p>
      </div>
    );
  }

  return (
    <div id="zoho-quote-section" className="bg-white rounded-xl border border-indigo-200 shadow-md overflow-hidden my-6">
      
      {/* Section Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white p-4 sm:px-6 flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-indigo-800">
        <div className="flex items-center space-x-3">
          <div className="bg-indigo-600 p-2 rounded-lg shadow-sm">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-black tracking-wide uppercase font-sans flex items-center gap-2">
              <span>Offer Quote & Zoho CRM Integration</span>
            </h2>
            <p className="text-xs text-indigo-200 mt-0.5">
              Select customer, build multi-product quotes, copy WhatsApp text, and record deals directly to Zoho CRM.
            </p>
          </div>
        </div>

        {/* Zoho Connection Status Badge */}
        <div className="flex items-center space-x-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700/80 text-xs font-mono">
          <Database className={`w-3.5 h-3.5 ${isZohoConnected ? 'text-emerald-400' : 'text-amber-400'}`} />
          <span className={isZohoConnected ? 'text-emerald-300 font-semibold' : 'text-amber-300 font-semibold'}>
            {isZohoConnected ? 'Zoho CRM Connected' : 'Zoho CRM (Demo Mode)'}
          </span>
          <button
            onClick={fetchZohoAccounts}
            disabled={isLoadingAccounts}
            title="Refresh Zoho Accounts & Agents"
            className="ml-1 p-1 hover:bg-slate-700 rounded text-slate-300 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${isLoadingAccounts ? 'animate-spin text-indigo-400' : ''}`} />
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-5">
        
        {/* Zoho Error Alert Banner */}
        {zohoError && (
          <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-xs font-medium flex items-start space-x-2.5 shadow-xs">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold block text-amber-950">Zoho CRM Authentication Issue:</span>
              <span>{zohoError}</span>
              <p className="text-[11px] text-amber-800 italic">
                Note: Check your ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET, and ZOHO_ACCOUNTS_DOMAIN (e.g., accounts.zoho.com or accounts.zoho.in) in your environment settings. Falling back to sample accounts.
              </p>
            </div>
          </div>
        )}

        {/* 1. ACTIVE SELECTION SUMMARY (INHERITED FROM TOP SEARCH) */}
        <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-indigo-100 rounded-md text-indigo-700">
              <UserCheck className="w-4 h-4" />
            </div>
            <div>
              <span className="font-bold text-slate-900 uppercase tracking-wider text-[11px] block font-sans">
                Active Quote Parties
              </span>
              <span className="text-slate-500 text-[11px]">
                Customer & Agent names are automatically inherited from the top search bars.
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 font-mono w-full md:w-auto">
            <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-300 shadow-2xs flex items-center space-x-1.5 grow sm:grow-0">
              <span className="text-slate-500 font-sans text-[11px]">Customer:</span>
              <span className={`font-bold ${customerName?.trim() ? 'text-indigo-950 font-sans' : 'text-slate-400 italic font-sans'}`}>
                {customerName?.trim() || 'None Selected'}
              </span>
            </div>

            <div className="bg-white px-3 py-1.5 rounded-lg border border-slate-300 shadow-2xs flex items-center space-x-1.5 grow sm:grow-0">
              <span className="text-slate-500 font-sans text-[11px]">Local Agent:</span>
              <span className={`font-bold ${agentName?.trim() ? 'text-emerald-900 font-sans' : 'text-slate-400 italic font-sans'}`}>
                {agentName?.trim() || 'None Selected'}
              </span>
            </div>

            <div className="bg-indigo-50/80 border border-indigo-200 px-2.5 py-1 rounded-lg shadow-2xs flex items-center space-x-1.5 grow sm:grow-0">
              <User className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
              <span className="text-indigo-900 font-sans font-semibold text-[11px] whitespace-nowrap">Zoho Deal Owner:</span>
              <select
                id="select-zoho-deal-owner"
                value={selectedOwnerEmail}
                onChange={(e) => setSelectedOwnerEmail(e.target.value)}
                className="text-xs font-bold text-indigo-950 bg-white border border-indigo-300 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-indigo-600 cursor-pointer shadow-2xs font-sans"
                title="Select who owns this deal in Zoho CRM"
              >
                {SYSTEM_USERS.map((user) => (
                  <option key={user.id} value={user.email}>
                    {user.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* 2. MULTI-PRODUCT QUOTE BASKET */}
        <div className="border border-slate-200 rounded-lg p-4 bg-white space-y-3 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5 border-b border-slate-200 pb-3">
            <div>
              <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider font-sans">
                Multi-Product Quote Basket ({quoteBasket.length} {quoteBasket.length === 1 ? 'item' : 'items'})
              </h3>
              <p className="text-[11px] text-slate-500 font-sans mt-0.5">
                Add multiple yarn counts and specify inquiry quantities (in Kgs) to create a combined Zoho CRM Deal.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Active Product Quantity Control */}
              <div className="flex items-center space-x-1.5 bg-indigo-50/90 border border-indigo-200 px-2.5 py-1 rounded-md">
                <span className="text-indigo-900 font-sans font-bold text-[11px]">Inquiry Qty:</span>
                <input
                  type="number"
                  value={activeProductQty}
                  onChange={(e) => setActiveProductQty(Math.max(1, Number(e.target.value) || 0))}
                  className="w-20 px-1.5 py-0.5 bg-white border border-indigo-300 rounded text-xs font-mono font-bold text-indigo-950 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                  placeholder="21000"
                />
                <span className="text-indigo-700 font-sans text-[11px] font-semibold">kg</span>
                <div className="flex items-center space-x-1 pl-1 border-l border-indigo-200">
                  <button
                    type="button"
                    onClick={() => setActiveProductQty(21000)}
                    className={`px-1.5 py-0.5 text-[10px] rounded font-bold cursor-pointer transition-colors ${activeProductQty === 21000 ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-800 hover:bg-indigo-100 border border-indigo-200'}`}
                    title="21,000 kg"
                  >
                    21,000 kg
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveProductQty(42000)}
                    className={`px-1.5 py-0.5 text-[10px] rounded font-bold cursor-pointer transition-colors ${activeProductQty === 42000 ? 'bg-indigo-600 text-white' : 'bg-white text-indigo-800 hover:bg-indigo-100 border border-indigo-200'}`}
                    title="42,000 kg"
                  >
                    42,000 kg
                  </button>
                </div>
              </div>

              {quoteBasket.length > 0 && (
                <button
                  id="btn-clear-quote-basket"
                  type="button"
                  onClick={() => setQuoteBasket([])}
                  className="px-2.5 py-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 rounded-md transition-colors cursor-pointer"
                >
                  Clear
                </button>
              )}
              <button
                id="btn-add-product-to-quote"
                type="button"
                onClick={handleAddCurrentProduct}
                disabled={!currentUsdPrice || currentUsdPrice <= 0}
                className="inline-flex items-center justify-center space-x-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-md font-semibold text-xs shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>+ Add Active Product ({currentYarnCount} {currentQuality})</span>
              </button>
            </div>
          </div>

          {/* Product Basket List */}
          {quoteBasket.length === 0 ? (
            <div className="text-center py-4 bg-slate-50 rounded-lg border border-dashed border-slate-300 text-slate-500 text-xs">
              No items in basket. Set inquiry quantity above and click &quot;+ Add Active Product&quot; to build multi-item quotes.
            </div>
          ) : (
            <div className="space-y-2">
              {quoteBasket.map((item, idx) => {
                const itemQty = item.quantity || 21000;
                const itemTotal = Number(((item.usdPrice || 0) * itemQty).toFixed(2));
                return (
                  <div key={item.id} className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-50 p-2.5 rounded-lg border border-slate-200 gap-2 text-xs font-mono">
                    <div className="flex items-center space-x-2">
                      <span className="w-5 h-5 bg-indigo-100 text-indigo-800 font-bold rounded-full flex items-center justify-center text-[10px] shrink-0">
                        {idx + 1}
                      </span>
                      <span className="font-semibold text-slate-900 font-sans">{item.yarn_description}</span>
                    </div>

                    <div className="flex flex-wrap items-center justify-between sm:justify-end gap-3 shrink-0">
                      {/* Rate */}
                      <span className="font-bold text-slate-700 font-mono">
                        USD ${item.usdPrice.toFixed(2)}/kg
                      </span>

                      {/* Quantity Input Controls */}
                      <div className="flex items-center space-x-1 font-sans">
                        <span className="text-slate-500 text-[11px]">Qty:</span>
                        <input
                          type="number"
                          value={itemQty}
                          onChange={(e) => handleUpdateItemQuantity(item.id, Number(e.target.value))}
                          className="w-22 px-2 py-0.5 bg-white border border-slate-300 rounded text-xs font-mono font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-indigo-600"
                          placeholder="21000"
                        />
                        <span className="text-slate-500 text-[11px]">kg</span>
                      </div>

                      {/* Line Amount Total */}
                      <span className="font-bold text-emerald-700 font-mono text-xs whitespace-nowrap bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        USD ${itemTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>

                      {/* Remove */}
                      <button
                        onClick={() => handleRemoveProduct(item.id)}
                        title="Remove product"
                        className="p-1 text-slate-400 hover:text-red-600 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Offer Terms Summary */}
          <div className="bg-indigo-50/70 p-2.5 rounded-lg border border-indigo-100 flex items-center justify-between text-xs font-sans text-indigo-950 font-medium">
            <span className="font-bold text-indigo-900">Delivery & Payment Terms:</span>
            <span className="font-semibold text-indigo-800 font-mono">{formatTermsLine()}</span>
          </div>
        </div>

        {/* 3. STANDARD FORMATTED TEXT QUOTE (COPY FOR WHATSAPP / EMAIL) */}
        <div className="border border-slate-300 rounded-lg p-4 bg-slate-900 text-slate-100 space-y-3 shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
            <div className="flex items-center space-x-2">
              <MessageSquare className="w-4 h-4 text-emerald-400" />
              <h3 className="text-xs font-bold text-white uppercase tracking-wider font-sans">
                Standard WhatsApp / Email Quote Text Format
              </h3>
            </div>

            <div className="flex items-center space-x-2">
              <button
                id="btn-copy-quote-text"
                type="button"
                onClick={handleCopyText}
                disabled={!dailyPricingConfirmed || (!customerName?.trim() && !agentName?.trim())}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-md font-bold text-xs transition-colors shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-white" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Text</span>
                  </>
                )}
              </button>

              <button
                id="btn-send-whatsapp"
                type="button"
                onClick={handleSendWhatsApp}
                disabled={!dailyPricingConfirmed || (!customerName?.trim() && !agentName?.trim())}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-green-700 hover:bg-green-600 text-white rounded-md font-bold text-xs transition-colors shadow-xs disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Send className="w-3.5 h-3.5" />
                <span>WhatsApp</span>
              </button>
            </div>
          </div>

          {/* Live Quote Preview Box */}
          <pre className="bg-slate-950 p-3.5 rounded-md text-emerald-300 font-mono text-xs leading-relaxed whitespace-pre-wrap select-all border border-slate-800 shadow-inner">
            {formattedQuoteText}
          </pre>
        </div>

        {/* 4. RECORD QUOTE & CREATE ZOHO CRM DEAL */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-500 font-sans">
            Recording quote will create an official Deal/Opportunity in Zoho CRM under <strong className="text-slate-800">{customerName || 'Selected Account'}</strong> with Deal Owner <strong className="text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200">{activeOwner?.name || currentUser?.name || 'Trader'}</strong>.
          </div>

          <button
            id="btn-record-quote-zoho"
            type="button"
            onClick={handleRecordQuoteAndCreateDeal}
            disabled={isRecording || !dailyPricingConfirmed || (!customerName.trim() && !agentName.trim())}
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-800 hover:from-indigo-700 hover:to-indigo-900 text-white rounded-lg font-bold text-xs shadow-md transition-all disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
          >
            <Database className="w-4 h-4 text-indigo-200" />
            <span>
              {isRecording 
                ? 'Creating Deal in Zoho CRM...' 
                : `Record Quote & Create Zoho Deal (Owner: ${activeOwner?.name || currentUser?.name || 'Trader'})`}
            </span>
          </button>
        </div>

        {/* Success / Feedback Toast Banner */}
        {recordSuccessMessage && !lastCreatedDeal && (
          <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-300 text-emerald-900 text-xs font-semibold flex items-center space-x-2 shadow-xs">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{recordSuccessMessage}</span>
          </div>
        )}

        {/* Detailed Last Created Deal Card with Direct Link & View Guidance */}
        {lastCreatedDeal && (
          <div className="p-4 rounded-xl bg-gradient-to-r from-emerald-50 to-teal-50 border-2 border-emerald-400 text-emerald-950 shadow-sm space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start space-x-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-black uppercase tracking-wider text-emerald-900">
                      Deal Recorded in Zoho CRM Successfully!
                    </span>
                    <span className="text-[10px] font-mono text-emerald-700 bg-white px-2 py-0.5 rounded-full border border-emerald-300">
                      {lastCreatedDeal.time}
                    </span>
                  </div>
                  <div className="text-xs text-emerald-900 font-medium mt-1 flex flex-wrap items-center gap-2">
                    <span>
                      Deal ID: <strong className="font-mono bg-white px-1.5 py-0.5 rounded border border-emerald-300">{lastCreatedDeal.id}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Assigned Owner: <strong className="bg-indigo-100 text-indigo-900 px-2 py-0.5 rounded border border-indigo-200">{lastCreatedDeal.owner}</strong>
                    </span>
                    <span>•</span>
                    <span>
                      Account: <strong>{lastCreatedDeal.account}</strong>
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <a
                  id="link-open-zoho-deal-global"
                  href={lastCreatedDeal.urlCom || `https://crm.zoho.com/crm/tab/Potentials/${lastCreatedDeal.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center space-x-1.5 px-3 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg font-bold text-xs shadow transition-all hover:scale-[1.02] active:scale-[0.98]"
                  title="Open in Global Zoho CRM (crm.zoho.com)"
                >
                  <span>Open Deal (crm.zoho.com)</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>

                <a
                  id="link-open-zoho-deal-india"
                  href={lastCreatedDeal.urlIn || `https://crm.zoho.in/crm/tab/Potentials/${lastCreatedDeal.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center space-x-1.5 px-3 py-2 bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 rounded-lg font-bold text-xs shadow-2xs transition-all hover:scale-[1.02] active:scale-[0.98]"
                  title="Open in India Zoho CRM (crm.zoho.in)"
                >
                  <span>Open (crm.zoho.in)</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

            {/* Key Deal Parameters Confirmed in Zoho Deal */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-2 bg-white/95 p-3 rounded-lg border border-emerald-200 text-xs shadow-2xs font-sans">
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Stage</span>
                <span className="font-bold text-blue-800 font-sans bg-blue-50 px-2 py-0.5 rounded border border-blue-200 inline-block w-fit text-[11px] truncate" title={lastCreatedDeal.stage || 'Quote sent'}>
                  {lastCreatedDeal.stage || 'Quote sent'}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Total Price</span>
                <span className="text-sm font-black text-emerald-700 font-mono">
                  {lastCreatedDeal.currency || 'USD'} {Number(lastCreatedDeal.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Currency</span>
                <span className="font-bold text-slate-900 font-mono">{lastCreatedDeal.currency || 'USD'}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Packing</span>
                <span className="font-semibold text-slate-900 truncate" title={lastCreatedDeal.packing}>{lastCreatedDeal.packing || 'Pallet Packing'}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Commission</span>
                <span className="font-semibold text-slate-900">{lastCreatedDeal.commission || 'Nil'}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Terms</span>
                <span className="font-semibold text-slate-900 truncate" title={lastCreatedDeal.terms}>{lastCreatedDeal.terms || '—'}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Closing Date</span>
                <span className="font-bold text-indigo-900 font-mono bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 inline-block w-fit">
                  {lastCreatedDeal.closingDate || 'Next Day'}
                </span>
              </div>
            </div>

            {/* Follow-up Feedback Task for Sales Person */}
            <div className="bg-gradient-to-r from-blue-50/90 to-indigo-50/90 p-3 rounded-lg border border-blue-200 text-xs shadow-2xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                <div className="flex items-start sm:items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-bold text-blue-950 text-xs">Sales Follow-Up Task Created</span>
                      <span className="px-1.5 py-0.2 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded border border-emerald-300">
                        Zoho CRM Task
                      </span>
                      <span className="px-1.5 py-0.2 bg-amber-100 text-amber-900 text-[10px] font-bold rounded border border-amber-300">
                        High Priority
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-700 mt-0.5">
                      <strong>Subject:</strong> {lastCreatedDeal.task?.subject || `Follow up for quote feedback - ${lastCreatedDeal.account}`}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:items-end text-xs text-slate-600 bg-white/70 sm:bg-transparent p-2 sm:p-0 rounded border border-blue-100 sm:border-0">
                  <div className="text-[11px]">
                    Sales Person: <strong className="text-slate-900 font-semibold">{lastCreatedDeal.task?.owner || lastCreatedDeal.owner}</strong>
                  </div>
                  <div className="text-[11px] flex items-center space-x-1">
                    <Clock className="w-3 h-3 text-blue-600 shrink-0 inline" />
                    <span>Due: <strong className="text-blue-900 font-mono font-bold">{lastCreatedDeal.task?.due_date || lastCreatedDeal.closingDate}</strong></span>
                    <span className="text-[10px] text-slate-500">(Next day feedback)</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Products Added in Deal Line Items */}
            {lastCreatedDeal.products && lastCreatedDeal.products.length > 0 && (
              <div className="bg-white/95 rounded-lg border border-emerald-200 overflow-hidden shadow-2xs">
                <div className="bg-emerald-100/70 px-3 py-1.5 text-[11px] font-bold text-emerald-950 uppercase tracking-wider flex items-center justify-between">
                  <span>Products Added in Zoho Deal ({lastCreatedDeal.products.length})</span>
                  <span className="text-slate-600 font-mono text-[10px]">Unit: kg</span>
                </div>
                <div className="divide-y divide-slate-100 text-xs">
                  {lastCreatedDeal.products.map((prod: any, pIdx: number) => (
                    <div key={pIdx} className="px-3 py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                      <div className="flex items-center space-x-2">
                        <span className="w-4 h-4 bg-emerald-200 text-emerald-900 font-bold rounded-full flex items-center justify-center text-[10px]">
                          {pIdx + 1}
                        </span>
                        <span className="font-bold text-slate-900 font-sans">{prod.name || prod.yarn_description || prod.yarnCount}</span>
                      </div>
                      <div className="flex items-center space-x-3 text-xs font-mono ml-6 sm:ml-0">
                        <span className="text-slate-600">
                          Price: <strong className="text-emerald-800">{lastCreatedDeal.currency || 'USD'} {Number(prod.price || prod.usdPrice || 0).toFixed(2)} / kg</strong>
                        </span>
                        <span>•</span>
                        <span className="text-slate-600">
                          Qty: <strong>{Number(prod.quantity || 21000).toLocaleString()} kg</strong>
                        </span>
                        <span>•</span>
                        <span className="text-slate-900 font-bold">
                          Amount: {lastCreatedDeal.currency || 'USD'} {Number(prod.amount || ((prod.price || prod.usdPrice || 0) * (prod.quantity || 21000))).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Why deal may not appear under default homepage */}
            <div className="bg-white/90 p-3 rounded-lg border border-emerald-200 text-xs text-slate-700 space-y-1.5 shadow-2xs">
              <div className="flex items-center space-x-1.5 font-bold text-slate-900 text-[11px] uppercase tracking-wide">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>Zoho CRM Quick Reference:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-600 leading-relaxed pl-1">
                <li>
                  <strong>Data Center:</strong> If your browser is on <strong className="text-slate-900 font-mono">crm.zoho.in</strong>, click <strong>"Open Deal (crm.zoho.com)"</strong> above to jump directly to this deal in your active global account.
                </li>
                <li>
                  <strong>Owner Filter:</strong> In Zoho CRM Deals tab, switch filter from <em>"My Deals"</em> to <em>"All Deals"</em> to view deals assigned to <strong className="text-indigo-900 font-semibold">{lastCreatedDeal.owner}</strong>.
                </li>
              </ul>
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
