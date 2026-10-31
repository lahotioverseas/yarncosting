import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users,
  Mail,
  PhoneCall,
  UserCheck,
  UserX,
  Plus,
  Search,
  Filter,
  RefreshCw,
  Sparkles,
  ArrowUpDown,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  Send,
  MoreVertical,
  ExternalLink,
  ChevronRight,
  MessageSquare,
  Flame,
  Globe,
} from 'lucide-react';
import { Lead, LeadStatus, CampaignTemplate, UserProfile } from '../../types';
import {
  fetchLeadsAndCampaign,
  createLeadApi,
  updateLeadApi,
  deleteLeadApi,
  sendNextEmailApi,
  simulateReplyApi,
  logCallAttemptApi,
  fastForwardTimeApi,
  processDripBatchApi,
  resetDemoLeadsApi,
  saveCampaignTemplatesApi,
} from '../../lib/dripCampaignClient';
import { VisualWorkflowCanvas } from './VisualWorkflowCanvas';
import { LeadDetailModal } from './LeadDetailModal';
import { NewLeadModal } from './NewLeadModal';
import { CampaignTemplatesModal } from './CampaignTemplatesModal';

interface LeadCampaignWorkflowViewProps {
  currentUser: UserProfile | null;
  onOpenCostingSheetForLead?: (yarnCount: string, destinationPort: string) => void;
}

export const LeadCampaignWorkflowView: React.FC<LeadCampaignWorkflowViewProps> = ({
  currentUser,
  onOpenCostingSheetForLead,
}) => {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [templates, setTemplates] = useState<CampaignTemplate[]>([]);
  const [virtualDays, setVirtualDays] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);

  // Search and Filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [countryFilter, setCountryFilter] = useState<string>('all');

  // Modals state
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isNewLeadModalOpen, setIsNewLeadModalOpen] = useState(false);
  const [isTemplatesModalOpen, setIsTemplatesModalOpen] = useState(false);

  const showToast = useCallback((message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setNotification({ message, type });
    setTimeout(() => {
      setNotification((prev) => (prev?.message === message ? null : prev));
    }, 4000);
  }, []);

  // Load leads from server API
  const loadLeads = useCallback(async () => {
    try {
      const data = await fetchLeadsAndCampaign();
      setLeads(data.leads || []);
      setTemplates(data.templates || []);
      setVirtualDays(data.virtualOffsetDays || 0);
    } catch (err: any) {
      console.warn('Could not load leads from API:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  // Handle Create Lead
  const handleCreateLead = async (payload: any) => {
    try {
      const res = await createLeadApi(payload);
      if (res.success && res.lead) {
        setLeads((prev) => [res.lead, ...prev]);
        showToast(`Enrolled "${res.lead.companyName}" and dispatched 1st Mail!`);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to create lead', 'error');
      throw err;
    }
  };

  // Handle Update Lead
  const handleUpdateLead = async (leadId: string, updates: Partial<Lead>) => {
    try {
      const res = await updateLeadApi(leadId, updates);
      if (res.success && res.lead) {
        setLeads((prev) => prev.map((l) => (l.id === leadId ? res.lead : l)));
        setSelectedLead(res.lead);
        showToast('Lead records updated successfully.');
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to update lead', 'error');
      throw err;
    }
  };

  // Handle Delete Lead
  const handleDeleteLead = async (leadId: string) => {
    if (!confirm('Are you sure you want to delete this lead?')) return;
    try {
      await deleteLeadApi(leadId);
      setLeads((prev) => prev.filter((l) => l.id !== leadId));
      if (selectedLead?.id === leadId) {
        setIsDetailModalOpen(false);
        setSelectedLead(null);
      }
      showToast('Lead deleted.');
    } catch (err: any) {
      showToast(err.message || 'Failed to delete lead', 'error');
    }
  };

  // Handle Send Next Drip Email Step
  const handleSendNextEmail = async (leadId: string) => {
    try {
      const res = await sendNextEmailApi(leadId, currentUser?.name || 'Rajesh Lahoti');
      if (res.success && res.lead) {
        setLeads((prev) => prev.map((l) => (l.id === leadId ? res.lead : l)));
        setSelectedLead(res.lead);
        showToast(`Dispatched next email step to ${res.lead.companyName}!`);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to send next email', 'error');
    }
  };

  // Handle Simulate Inbound Reply
  const handleSimulateReply = async (leadId: string, replyText: string) => {
    try {
      const res = await simulateReplyApi(leadId, replyText, currentUser?.name || 'Rajesh Lahoti');
      if (res.success && res.lead) {
        setLeads((prev) => prev.map((l) => (l.id === leadId ? res.lead : l)));
        setSelectedLead(res.lead);
        showToast(`Auto-extracted CRM fields from reply! Status: Information Received.`);
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to parse reply', 'error');
    }
  };

  // Handle Log Call Attempt
  const handleLogCall = async (leadId: string, payload: any) => {
    try {
      const res = await logCallAttemptApi(leadId, payload);
      if (res.success && res.lead) {
        setLeads((prev) => prev.map((l) => (l.id === leadId ? res.lead : l)));
        setSelectedLead(res.lead);
        if (res.lead.status === 'not_reachable') {
          showToast(`Rule Enforced: Lead marked NOT REACHABLE after 2 unsuccessful phone calls.`, 'info');
        } else if (res.lead.status === 'call_connected') {
          showToast(`Call Connected! Sourcing discussion recorded.`, 'success');
        } else {
          showToast(`Call attempt 1 logged. 1 more attempt remaining before Not Reachable.`);
        }
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to log call', 'error');
    }
  };

  // Fast forward virtual time by 4 days
  const handleFastForward = async () => {
    setIsProcessing(true);
    try {
      const res = await fastForwardTimeApi(4);
      if (res.success) {
        setLeads(res.leads || []);
        setVirtualDays(res.virtualOffsetDays || 0);
        showToast(
          `Fast-forwarded 4 days! ${res.emailsSent} follow-up emails sent, ${res.callsAssigned} call tasks assigned.`,
          'success'
        );
      }
    } catch (err: any) {
      showToast(err.message || 'Fast forward failed', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Run Batch Drip Processor
  const handleRunBatch = async () => {
    setIsProcessing(true);
    try {
      const res = await processDripBatchApi();
      if (res.success) {
        setLeads(res.leads || []);
        showToast(
          `Automation check complete: ${res.emailsSent} emails sent, ${res.callsAssigned} call tasks assigned.`
        );
      }
    } catch (err: any) {
      showToast(err.message || 'Batch run failed', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Reset Demo Leads
  const handleResetDemo = async () => {
    if (!confirm('Reset all leads to standard demo dataset?')) return;
    setIsProcessing(true);
    try {
      const res = await resetDemoLeadsApi();
      if (res.success) {
        await loadLeads();
        showToast('Reset to demo dataset successfully.');
      }
    } catch (err: any) {
      showToast(err.message || 'Reset failed', 'error');
    } finally {
      setIsProcessing(false);
    }
  };

  // Save Templates
  const handleSaveTemplates = async (newTemplates: CampaignTemplate[]) => {
    try {
      await saveCampaignTemplatesApi(newTemplates);
      setTemplates(newTemplates);
      showToast('Campaign templates updated.');
    } catch (err: any) {
      showToast(err.message || 'Failed to save templates', 'error');
    }
  };

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      // Search filter
      const q = searchQuery.toLowerCase().trim();
      if (q) {
        const matchesQuery =
          lead.companyName?.toLowerCase().includes(q) ||
          lead.leadName?.toLowerCase().includes(q) ||
          lead.initialEmail?.toLowerCase().includes(q) ||
          lead.crmFields.directEmailId?.toLowerCase().includes(q) ||
          lead.crmFields.yarnCountsFabricItems?.toLowerCase().includes(q) ||
          lead.crmFields.destinationPortCnf?.toLowerCase().includes(q) ||
          lead.country?.toLowerCase().includes(q);
        if (!matchesQuery) return false;
      }

      // Country filter
      if (countryFilter !== 'all' && lead.country !== countryFilter) {
        return false;
      }

      // Stage / Status filter
      if (activeFilter === 'all') return true;
      if (activeFilter === 'mail_1') return lead.status === 'mail_1_sent' || lead.status === 'new_lead';
      if (activeFilter === 'mail_2') return lead.status === 'mail_2_sent';
      if (activeFilter === 'mail_3') return lead.status === 'mail_3_sent';
      if (activeFilter === 'calling')
        return lead.status === 'call_pending_1' || lead.status === 'call_pending_2';
      if (activeFilter === 'info_received')
        return lead.status === 'info_received' || lead.status === 'call_connected';
      if (activeFilter === 'not_reachable') return lead.status === 'not_reachable';

      return true;
    });
  }, [leads, searchQuery, countryFilter, activeFilter]);

  // Unique countries for dropdown
  const uniqueCountries = useMemo(() => {
    const set = new Set(leads.map((l) => l.country).filter(Boolean));
    return Array.from(set);
  }, [leads]);

  // Status badge formatter helper
  const renderStatusBadge = (status: LeadStatus) => {
    switch (status) {
      case 'new_lead':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-950 text-indigo-300 border border-indigo-700">
            New Lead
          </span>
        );
      case 'mail_1_sent':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-950 text-blue-300 border border-blue-700">
            1st Mail Sent
          </span>
        );
      case 'mail_2_sent':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-950 text-sky-300 border border-sky-700">
            2nd Mail Sent (4-Day)
          </span>
        );
      case 'mail_3_sent':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-purple-950 text-purple-300 border border-purple-700">
            3rd Mail Sent
          </span>
        );
      case 'info_received':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-600 flex items-center gap-1 w-max">
            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
            <span>Info Received</span>
          </span>
        );
      case 'call_pending_1':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-950 text-amber-300 border border-amber-600 animate-pulse">
            Call Pending (Att. 1)
          </span>
        );
      case 'call_pending_2':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-950 text-amber-300 border border-amber-600 animate-pulse">
            Call Pending (Att. 2)
          </span>
        );
      case 'call_connected':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-600">
            Call Connected
          </span>
        );
      case 'not_reachable':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-rose-950 text-rose-300 border border-rose-700 flex items-center gap-1 w-max">
            <UserX className="w-3 h-3 text-rose-400" />
            <span>Not Reachable</span>
          </span>
        );
      case 'quote_sent':
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-indigo-950 text-indigo-300 border border-indigo-700">
            Spot Quote Sent
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded-full text-[11px] bg-slate-800 text-slate-300 border border-slate-700">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      
      {/* Toast Notification */}
      {notification && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-semibold shadow-xl flex items-center justify-between transition-all ${
            notification.type === 'error'
              ? 'bg-rose-950/95 border-rose-700 text-rose-200'
              : notification.type === 'info'
              ? 'bg-amber-950/95 border-amber-700 text-amber-200'
              : 'bg-emerald-950/95 border-emerald-600 text-emerald-200'
          }`}
        >
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-white" />
            <span>{notification.message}</span>
          </div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-white cursor-pointer ml-3"
          >
            ✕
          </button>
        </div>
      )}

      {/* KPI METRICS OVERVIEW CARDS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-md">
          <span className="text-[11px] text-slate-400 font-medium">Total Leads</span>
          <div className="text-xl font-bold text-white mt-1">{leads.length}</div>
          <span className="text-[10px] text-indigo-400 mt-0.5 block">Global Textile Mills</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-md">
          <span className="text-[11px] text-slate-400 font-medium">Emails Dispatched</span>
          <div className="text-xl font-bold text-sky-400 mt-1">
            {leads.reduce((acc, l) => acc + l.emailLogs.length, 0)}
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Drip 1, 2, & 3 Sequence</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-md">
          <span className="text-[11px] text-slate-400 font-medium">Replied & Auto-Parsed</span>
          <div className="text-xl font-bold text-emerald-400 mt-1">
            {leads.filter((l) => l.status === 'info_received' || l.status === 'call_connected').length}
          </div>
          <span className="text-[10px] text-emerald-400 mt-0.5 block">
            {leads.length > 0
              ? `${Math.round(
                  (leads.filter((l) => l.status === 'info_received' || l.status === 'call_connected').length /
                    leads.length) *
                    100
                )}% Response Rate`
              : '0%'}
          </span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-md">
          <span className="text-[11px] text-slate-400 font-medium">Active Drip Leads</span>
          <div className="text-xl font-bold text-indigo-400 mt-1">
            {leads.filter((l) => l.isDripActive).length}
          </div>
          <span className="text-[10px] text-slate-400 mt-0.5 block">Automated 4-day timers</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-md">
          <span className="text-[11px] text-slate-400 font-medium">Calling Pending</span>
          <div className="text-xl font-bold text-amber-400 mt-1">
            {leads.filter((l) => l.status === 'call_pending_1' || l.status === 'call_pending_2').length}
          </div>
          <span className="text-[10px] text-amber-400 mt-0.5 block">Step 4 Outreach</span>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 shadow-md">
          <span className="text-[11px] text-slate-400 font-medium">Not Reachable</span>
          <div className="text-xl font-bold text-rose-400 mt-1">
            {leads.filter((l) => l.status === 'not_reachable').length}
          </div>
          <span className="text-[10px] text-rose-400 mt-0.5 block">2 Failed Calls Logged</span>
        </div>

      </div>

      {/* VISUAL WORKFLOW CANVAS & SCHEDULER CONTROLLER */}
      <VisualWorkflowCanvas
        leads={leads}
        activeFilter={activeFilter}
        onSelectFilter={setActiveFilter}
        onFastForward={handleFastForward}
        onRunBatch={handleRunBatch}
        onResetDemo={handleResetDemo}
        onOpenTemplates={() => setIsTemplatesModalOpen(true)}
        isProcessing={isProcessing}
        virtualDays={virtualDays}
      />

      {/* LEADS CRM TABLE SECTION */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden text-slate-100">
        
        {/* Table Toolbar */}
        <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-slate-950/40">
          
          {/* Search Input */}
          <div className="flex flex-1 items-center space-x-3 max-w-md">
            <div className="relative w-full">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by company, contact, count, port, or email..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-2 text-xs text-white placeholder:text-slate-500 focus:outline-hidden focus:border-indigo-500"
              />
            </div>

            {/* Country filter */}
            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-slate-300 focus:outline-hidden focus:border-indigo-500"
            >
              <option value="all">All Countries</option>
              {uniqueCountries.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2.5 self-end md:self-auto">
            <button
              onClick={() => {
                loadLeads();
                showToast('Refreshed leads data.');
              }}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition-colors cursor-pointer"
              title="Refresh lead list"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            <button
              onClick={() => setIsNewLeadModalOpen(true)}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Enroll New Lead</span>
            </button>
          </div>
        </div>

        {/* Filter Pills Tab Bar */}
        <div className="flex items-center space-x-1 px-4 py-2.5 border-b border-slate-800/80 bg-slate-950/20 overflow-x-auto text-xs">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeFilter === 'all'
                ? 'bg-indigo-600 text-white font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            All Leads ({leads.length})
          </button>
          <button
            onClick={() => setActiveFilter('mail_1')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeFilter === 'mail_1'
                ? 'bg-indigo-600 text-white font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            1st Mail Sent ({leads.filter((l) => l.status === 'mail_1_sent' || l.status === 'new_lead').length})
          </button>
          <button
            onClick={() => setActiveFilter('mail_2')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeFilter === 'mail_2'
                ? 'bg-indigo-600 text-white font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            2nd Mail Sent ({leads.filter((l) => l.status === 'mail_2_sent').length})
          </button>
          <button
            onClick={() => setActiveFilter('mail_3')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeFilter === 'mail_3'
                ? 'bg-indigo-600 text-white font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            3rd Mail Sent ({leads.filter((l) => l.status === 'mail_3_sent').length})
          </button>
          <button
            onClick={() => setActiveFilter('calling')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeFilter === 'calling'
                ? 'bg-indigo-600 text-white font-bold'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
            }`}
          >
            Calls Pending ({leads.filter((l) => l.status === 'call_pending_1' || l.status === 'call_pending_2').length})
          </button>
          <button
            onClick={() => setActiveFilter('info_received')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeFilter === 'info_received'
                ? 'bg-emerald-600 text-white font-bold'
                : 'text-emerald-400 hover:text-emerald-300 hover:bg-slate-800'
            }`}
          >
            ✓ Info Received ({leads.filter((l) => l.status === 'info_received' || l.status === 'call_connected').length})
          </button>
          <button
            onClick={() => setActiveFilter('not_reachable')}
            className={`px-3 py-1.5 rounded-lg font-medium transition-colors cursor-pointer whitespace-nowrap ${
              activeFilter === 'not_reachable'
                ? 'bg-rose-700 text-white font-bold'
                : 'text-rose-400 hover:text-rose-300 hover:bg-slate-800'
            }`}
          >
            ✕ Not Reachable ({leads.filter((l) => l.status === 'not_reachable').length})
          </button>
        </div>

        {/* TABLE */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-950/60 text-slate-400 font-semibold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">Company & Lead Name</th>
                <th className="py-3 px-3">Country & Market</th>
                <th className="py-3 px-3">Sourcing Specs (Auto-CRM)</th>
                <th className="py-3 px-3">Current Status</th>
                <th className="py-3 px-3 text-center">Drip Step</th>
                <th className="py-3 px-3 text-center">Calls Logged</th>
                <th className="py-3 px-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-slate-400">
                    No leads found matching current filter or search criteria.
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => (
                  <tr
                    key={lead.id}
                    className="hover:bg-slate-800/40 transition-colors group cursor-pointer"
                    onClick={() => {
                      setSelectedLead(lead);
                      setIsDetailModalOpen(true);
                    }}
                  >
                    {/* Company & Lead Name */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-100 text-xs flex items-center gap-1.5 group-hover:text-indigo-300 transition-colors">
                        <span>{lead.companyName}</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                        <span>{lead.leadName}</span>
                        <span>•</span>
                        <span className="text-slate-500 font-mono">
                          {lead.crmFields.directEmailId || lead.initialEmail}
                        </span>
                      </div>
                    </td>

                    {/* Country & Destination Port */}
                    <td className="py-3.5 px-3">
                      <div className="text-slate-200 font-medium">{lead.country}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        {lead.crmFields.destinationPortCnf ? (
                          <span className="text-indigo-400 font-semibold">
                            ⚓ {lead.crmFields.destinationPortCnf}
                          </span>
                        ) : (
                          <span className="text-slate-500 italic">Port unassigned</span>
                        )}
                      </div>
                    </td>

                    {/* Sourcing Specs (CRM Fields) */}
                    <td className="py-3.5 px-3 max-w-xs">
                      {lead.crmFields.yarnCountsFabricItems ? (
                        <div>
                          <div className="text-emerald-400 font-semibold truncate" title={lead.crmFields.yarnCountsFabricItems}>
                            {lead.crmFields.yarnCountsFabricItems}
                          </div>
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            {lead.crmFields.approximateQuantityPerMonth || 'Qty pending'}
                          </div>
                        </div>
                      ) : (
                        <div className="text-slate-500 italic text-[11px]">
                          Pending reply / form fill
                        </div>
                      )}
                    </td>

                    {/* Current Status */}
                    <td className="py-3.5 px-3">
                      {renderStatusBadge(lead.status)}
                      {lead.isDripActive && lead.nextActionDueAt && (
                        <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5 text-amber-400" />
                          <span>Next: {new Date(lead.nextActionDueAt).toLocaleDateString()}</span>
                        </div>
                      )}
                    </td>

                    {/* Drip Step */}
                    <td className="py-3.5 px-3 text-center">
                      <div className="inline-flex items-center space-x-1">
                        {[1, 2, 3].map((step) => {
                          const isSent = lead.emailLogs.some((e) => e.step === step);
                          return (
                            <span
                              key={step}
                              className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center ${
                                isSent
                                  ? 'bg-indigo-600 text-white'
                                  : 'bg-slate-800 text-slate-500'
                              }`}
                              title={`Mail Step ${step} ${isSent ? 'Sent' : 'Pending'}`}
                            >
                              {step}
                            </span>
                          );
                        })}
                      </div>
                    </td>

                    {/* Calls Logged */}
                    <td className="py-3.5 px-3 text-center">
                      <div className="inline-flex items-center space-x-1">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                            lead.status === 'not_reachable'
                              ? 'bg-rose-950 text-rose-300 border border-rose-800'
                              : lead.callAttempts.length > 0
                              ? 'bg-amber-950 text-amber-300 border border-amber-800'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {lead.callAttempts.length}/2
                        </span>
                      </div>
                    </td>

                    {/* Quick Action Buttons */}
                    <td
                      className="py-3.5 px-3 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end space-x-1.5">
                        
                        {/* Spot Quote Quick Bridge */}
                        {lead.crmFields.yarnCountsFabricItems && lead.crmFields.destinationPortCnf && onOpenCostingSheetForLead && (
                          <button
                            onClick={() => onOpenCostingSheetForLead(lead.crmFields.yarnCountsFabricItems, lead.crmFields.destinationPortCnf)}
                            className="p-1.5 bg-indigo-950 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/60 rounded-lg text-xs transition-colors cursor-pointer"
                            title="Generate Spot CNF Quote in Costing Sheet"
                          >
                            <FileSpreadsheet className="w-3.5 h-3.5" />
                          </button>
                        )}

                        <button
                          onClick={() => {
                            setSelectedLead(lead);
                            setIsDetailModalOpen(true);
                          }}
                          className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
                        >
                          View CRM
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* LEAD DETAIL & CRM PROFILE MODAL */}
      <LeadDetailModal
        lead={selectedLead}
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedLead(null);
        }}
        onUpdateLead={handleUpdateLead}
        onSendNextEmail={handleSendNextEmail}
        onSimulateReply={handleSimulateReply}
        onLogCall={handleLogCall}
        onCreateCostingQuote={
          onOpenCostingSheetForLead
            ? (counts, port) => {
                setIsDetailModalOpen(false);
                onOpenCostingSheetForLead(counts, port);
              }
            : undefined
        }
      />

      {/* NEW LEAD ENROLLMENT MODAL */}
      <NewLeadModal
        isOpen={isNewLeadModalOpen}
        onClose={() => setIsNewLeadModalOpen(false)}
        onCreateLead={handleCreateLead}
      />

      {/* CAMPAIGN TEMPLATES MODAL */}
      <CampaignTemplatesModal
        isOpen={isTemplatesModalOpen}
        onClose={() => setIsTemplatesModalOpen(false)}
        templates={templates}
        onSaveTemplates={handleSaveTemplates}
      />

    </div>
  );
};
