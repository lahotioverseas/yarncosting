import React, { useState } from 'react';
import {
  X,
  Building2,
  User,
  Mail,
  Phone,
  Globe,
  Calendar,
  Send,
  MessageSquare,
  PhoneCall,
  CheckCircle,
  AlertTriangle,
  FileSpreadsheet,
  Clock,
  History,
  Sparkles,
  ArrowRight,
  UserX,
  Edit3,
  Save,
  Check,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Lead, LeadStatus, CallAttempt, CrmFields } from '../../types';
import { SAMPLE_REPLY_SCENARIOS, parseInboundEmailReply } from '../../lib/dripCampaignService';

interface LeadDetailModalProps {
  lead: Lead | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateLead: (leadId: string, updates: Partial<Lead>) => Promise<void>;
  onSendNextEmail: (leadId: string) => Promise<void>;
  onSimulateReply: (leadId: string, replyText: string) => Promise<void>;
  onLogCall: (
    leadId: string,
    payload: {
      callerName: string;
      outcome: 'no_answer' | 'switched_off' | 'busy' | 'wrong_number' | 'connected' | 'call_back_requested';
      notes: string;
    }
  ) => Promise<void>;
  onCreateCostingQuote?: (yarnCount: string, destinationPort: string) => void;
}

export const LeadDetailModal: React.FC<LeadDetailModalProps> = ({
  lead,
  isOpen,
  onClose,
  onUpdateLead,
  onSendNextEmail,
  onSimulateReply,
  onLogCall,
  onCreateCostingQuote,
}) => {
  if (!isOpen || !lead) return null;

  const [activeTab, setActiveTab] = useState<'profile' | 'emails' | 'simulator' | 'calling' | 'history'>('profile');

  // CRM Editable fields state
  const [isEditingCrm, setIsEditingCrm] = useState(false);
  const [crmForm, setCrmForm] = useState<CrmFields>({ ...lead.crmFields });

  // Simulator state
  const [selectedScenarioIndex, setSelectedScenarioIndex] = useState<number>(0);
  const [customReplyText, setCustomReplyText] = useState<string>(SAMPLE_REPLY_SCENARIOS[0].text);
  const [isParsingReply, setIsParsingReply] = useState(false);
  const [parsePreview, setParsePreview] = useState<any>(null);

  // Call Logger state
  const [callerName, setCallerName] = useState<string>('Rohit Sharma');
  const [callOutcome, setCallOutcome] = useState<
    'no_answer' | 'switched_off' | 'busy' | 'wrong_number' | 'connected' | 'call_back_requested'
  >('no_answer');
  const [callNotes, setCallNotes] = useState<string>('');
  const [isLoggingCall, setIsLoggingCall] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  // Status badge config
  const getStatusBadge = (status: LeadStatus) => {
    switch (status) {
      case 'new_lead':
        return { label: 'New Lead (Pending 1st Mail)', bg: 'bg-indigo-950 text-indigo-300 border-indigo-700' };
      case 'mail_1_sent':
        return { label: '1st Mail Sent (Awaiting Reply)', bg: 'bg-blue-950 text-blue-300 border-blue-700' };
      case 'mail_2_sent':
        return { label: '2nd Mail Sent (Follow-up)', bg: 'bg-sky-950 text-sky-300 border-sky-700' };
      case 'mail_3_sent':
        return { label: '3rd Mail Sent (Supply Chain)', bg: 'bg-purple-950 text-purple-300 border-purple-700' };
      case 'info_received':
        return { label: 'Information Received (Replied)', bg: 'bg-emerald-950 text-emerald-300 border-emerald-600' };
      case 'call_pending_1':
        return { label: 'Call Pending (Attempt 1)', bg: 'bg-amber-950 text-amber-300 border-amber-600 animate-pulse' };
      case 'call_pending_2':
        return { label: 'Call Pending (Attempt 2)', bg: 'bg-amber-950 text-amber-300 border-amber-600 animate-pulse' };
      case 'call_connected':
        return { label: 'Call Connected / Sourcing Discussed', bg: 'bg-emerald-950 text-emerald-300 border-emerald-600' };
      case 'not_reachable':
        return { label: 'Not Reachable (2 Failed Calls)', bg: 'bg-rose-950 text-rose-300 border-rose-700 font-bold' };
      case 'quote_sent':
        return { label: 'Spot Quote Sent', bg: 'bg-indigo-950 text-indigo-300 border-indigo-700' };
      case 'converted':
        return { label: 'Converted / Customer', bg: 'bg-emerald-900 text-emerald-200 border-emerald-500' };
      default:
        return { label: status, bg: 'bg-slate-800 text-slate-300 border-slate-700' };
    }
  };

  const statusBadge = getStatusBadge(lead.status);

  const handleSaveCrm = async () => {
    try {
      await onUpdateLead(lead.id, { crmFields: crmForm });
      setIsEditingCrm(false);
    } catch (err) {
      console.error('Failed to update lead fields:', err);
    }
  };

  const handleSelectScenario = (index: number) => {
    setSelectedScenarioIndex(index);
    const text = SAMPLE_REPLY_SCENARIOS[index].text;
    setCustomReplyText(text);
    const parsed = parseInboundEmailReply(text);
    setParsePreview(parsed);
  };

  const handleReplyTextChange = (text: string) => {
    setCustomReplyText(text);
    const parsed = parseInboundEmailReply(text);
    setParsePreview(parsed);
  };

  const handleExecuteSimulatedReply = async () => {
    if (!customReplyText.trim()) return;
    setIsParsingReply(true);
    try {
      await onSimulateReply(lead.id, customReplyText);
      setActiveTab('profile');
    } finally {
      setIsParsingReply(false);
    }
  };

  const handleExecuteLogCall = async () => {
    setIsLoggingCall(true);
    try {
      await onLogCall(lead.id, {
        callerName,
        outcome: callOutcome,
        notes: callNotes,
      });
      setCallNotes('');
      setActiveTab('calling');
    } finally {
      setIsLoggingCall(false);
    }
  };

  const handleSendNextStep = async () => {
    setIsSendingEmail(true);
    try {
      await onSendNextEmail(lead.id);
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl overflow-hidden text-slate-100">
        
        {/* MODAL HEADER */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/60 flex items-start justify-between">
          <div className="flex items-start space-x-3.5">
            <div className="p-2.5 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-xl shrink-0 mt-0.5">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-bold text-white tracking-tight">
                  {lead.companyName}
                </h2>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusBadge.bg}`}>
                  {statusBadge.label}
                </span>
                <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                  {lead.country}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 mt-1">
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  <span>Lead Contact: {lead.leadName}</span>
                </span>
                <span className="flex items-center gap-1">
                  <Mail className="w-3.5 h-3.5 text-slate-500" />
                  <span>{lead.crmFields.directEmailId || lead.initialEmail}</span>
                </span>
                <span className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 text-slate-500" />
                  <span>{lead.crmFields.phoneWhatsApp || lead.initialPhone || 'No Phone'}</span>
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL NAVIGATION TABS */}
        <div className="flex items-center space-x-1 px-6 border-b border-slate-800 bg-slate-950/30 overflow-x-auto text-xs font-medium">
          <button
            onClick={() => setActiveTab('profile')}
            className={`px-4 py-3 border-b-2 font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'profile'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Building2 className="w-3.5 h-3.5" />
            <span>CRM Sourcing Profile</span>
          </button>

          <button
            onClick={() => setActiveTab('emails')}
            className={`px-4 py-3 border-b-2 font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'emails'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span>Drip Emails ({lead.emailLogs.length})</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('simulator');
              if (!parsePreview) {
                setParsePreview(parseInboundEmailReply(customReplyText));
              }
            }}
            className={`px-4 py-3 border-b-2 font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'simulator'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-emerald-400/80 hover:text-emerald-300'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>Simulate Reply & Auto-Parse</span>
          </button>

          <button
            onClick={() => setActiveTab('calling')}
            className={`px-4 py-3 border-b-2 font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'calling'
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <PhoneCall className="w-3.5 h-3.5 text-amber-400" />
            <span>Sales Calls ({lead.callAttempts.length}/2 Attempts)</span>
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-3 border-b-2 font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'history'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Audit History ({lead.history.length})</span>
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* TAB 1: CRM PROFILE */}
          {activeTab === 'profile' && (
            <div className="space-y-6">
              
              {/* Highlight Banner if Information Received */}
              {lead.status === 'info_received' && (
                <div className="bg-emerald-950/70 border border-emerald-700/80 rounded-xl p-4 flex items-start space-x-3">
                  <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <h4 className="font-bold text-emerald-300 text-sm">
                      Information Received & CRM Fields Auto-Populated!
                    </h4>
                    <p className="text-emerald-200/90 mt-1">
                      The prospect replied to the drip outreach. The 6 key textile procurement fields below were extracted and populated automatically into your CRM records.
                    </p>
                  </div>
                </div>
              )}

              {/* Status & Next Step Alert */}
              {lead.status === 'not_reachable' && (
                <div className="bg-rose-950/70 border border-rose-700/80 rounded-xl p-4 flex items-start space-x-3">
                  <UserX className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                  <div className="text-xs">
                    <h4 className="font-bold text-rose-300 text-sm">
                      Lead Marked as Not Reachable
                    </h4>
                    <p className="text-rose-200/90 mt-1">
                      Rule Enforced: The prospect did not respond to 3 drip emails and 2 consecutive sales phone calls failed. The lead has been archived as unreachable.
                    </p>
                  </div>
                </div>
              )}

              {/* CRM Sourcing Fields Grid */}
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800">
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>Sourcing & CRM Details Form</span>
                      <span className="text-[11px] text-slate-400 font-normal">
                        (Auto-populated from replies or manually editable)
                      </span>
                    </h3>
                  </div>

                  {!isEditingCrm ? (
                    <button
                      onClick={() => {
                        setCrmForm({ ...lead.crmFields });
                        setIsEditingCrm(true);
                      }}
                      className="inline-flex items-center space-x-1 px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-lg border border-slate-700 transition-colors cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Edit Fields</span>
                    </button>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setIsEditingCrm(false)}
                        className="px-2.5 py-1 text-slate-400 hover:text-white text-xs rounded transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveCrm}
                        className="inline-flex items-center space-x-1 px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                      >
                        <Save className="w-3 h-3" />
                        <span>Save CRM</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  
                  {/* Field 1: Contact Person Responsible Name */}
                  <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                    <label className="text-slate-400 font-medium block mb-1">
                      1. Contact Person Responsible Name
                    </label>
                    {isEditingCrm ? (
                      <input
                        type="text"
                        value={crmForm.contactPersonResponsible || ''}
                        onChange={(e) => setCrmForm({ ...crmForm, contactPersonResponsible: e.target.value })}
                        placeholder="e.g. Engr. Faisal Kabir"
                        className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white focus:outline-hidden focus:border-indigo-500"
                      />
                    ) : (
                      <p className={`font-medium ${crmForm.contactPersonResponsible ? 'text-slate-100 font-semibold' : 'text-slate-500 italic'}`}>
                        {crmForm.contactPersonResponsible || 'Not provided yet'}
                      </p>
                    )}
                  </div>

                  {/* Field 2: Direct Email ID */}
                  <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                    <label className="text-slate-400 font-medium block mb-1">
                      2. Direct Email ID
                    </label>
                    {isEditingCrm ? (
                      <input
                        type="email"
                        value={crmForm.directEmailId || ''}
                        onChange={(e) => setCrmForm({ ...crmForm, directEmailId: e.target.value })}
                        placeholder="e.g. f.kabir@apexknits-bd.com"
                        className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white focus:outline-hidden focus:border-indigo-500"
                      />
                    ) : (
                      <p className={`font-medium ${crmForm.directEmailId ? 'text-slate-100 font-semibold' : 'text-slate-500 italic'}`}>
                        {crmForm.directEmailId || lead.initialEmail || 'Not provided yet'}
                      </p>
                    )}
                  </div>

                  {/* Field 3: Phone No / WhatsApp */}
                  <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                    <label className="text-slate-400 font-medium block mb-1">
                      3. Phone No / WhatsApp
                    </label>
                    {isEditingCrm ? (
                      <input
                        type="text"
                        value={crmForm.phoneWhatsApp || ''}
                        onChange={(e) => setCrmForm({ ...crmForm, phoneWhatsApp: e.target.value })}
                        placeholder="e.g. +880 1713-992810"
                        className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white focus:outline-hidden focus:border-indigo-500"
                      />
                    ) : (
                      <p className={`font-medium ${crmForm.phoneWhatsApp ? 'text-slate-100 font-semibold' : 'text-slate-500 italic'}`}>
                        {crmForm.phoneWhatsApp || lead.initialPhone || 'Not provided yet'}
                      </p>
                    )}
                  </div>

                  {/* Field 4: Yarn Counts / Fabric Items you buy */}
                  <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                    <label className="text-slate-400 font-medium block mb-1">
                      4. Yarn Counts / Fabric Items you buy
                    </label>
                    {isEditingCrm ? (
                      <input
                        type="text"
                        value={crmForm.yarnCountsFabricItems || ''}
                        onChange={(e) => setCrmForm({ ...crmForm, yarnCountsFabricItems: e.target.value })}
                        placeholder="e.g. 30s Combed Compact Weaving, 20s Carded"
                        className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white focus:outline-hidden focus:border-indigo-500"
                      />
                    ) : (
                      <p className={`font-medium ${crmForm.yarnCountsFabricItems ? 'text-emerald-400 font-semibold' : 'text-slate-500 italic'}`}>
                        {crmForm.yarnCountsFabricItems || 'Not provided yet'}
                      </p>
                    )}
                  </div>

                  {/* Field 5: Approximate Quantity (per month) */}
                  <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                    <label className="text-slate-400 font-medium block mb-1">
                      5. Approximate Quantity (per month)
                    </label>
                    {isEditingCrm ? (
                      <input
                        type="text"
                        value={crmForm.approximateQuantityPerMonth || ''}
                        onChange={(e) => setCrmForm({ ...crmForm, approximateQuantityPerMonth: e.target.value })}
                        placeholder="e.g. 2 x 40FT HC (50 MT)"
                        className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white focus:outline-hidden focus:border-indigo-500"
                      />
                    ) : (
                      <p className={`font-medium ${crmForm.approximateQuantityPerMonth ? 'text-slate-100 font-semibold' : 'text-slate-500 italic'}`}>
                        {crmForm.approximateQuantityPerMonth || 'Not provided yet'}
                      </p>
                    )}
                  </div>

                  {/* Field 6: Required Destination Port (CNF) */}
                  <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800">
                    <label className="text-slate-400 font-medium block mb-1">
                      6. Required Destination Port (CNF)
                    </label>
                    {isEditingCrm ? (
                      <input
                        type="text"
                        value={crmForm.destinationPortCnf || ''}
                        onChange={(e) => setCrmForm({ ...crmForm, destinationPortCnf: e.target.value })}
                        placeholder="e.g. Chittagong Port (CNF)"
                        className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1.5 text-white focus:outline-hidden focus:border-indigo-500"
                      />
                    ) : (
                      <p className={`font-medium ${crmForm.destinationPortCnf ? 'text-indigo-400 font-semibold' : 'text-slate-500 italic'}`}>
                        {crmForm.destinationPortCnf || 'Not provided yet'}
                      </p>
                    )}
                  </div>

                </div>

                {/* Sourcing Referral / Alternate Contact notes */}
                {crmForm.sourcingReferralContact && (
                  <div className="mt-4 p-3 bg-amber-950/50 border border-amber-800/60 rounded-lg text-xs">
                    <span className="font-semibold text-amber-300 block mb-1">
                      Alternate Sourcing Contact / Referral Note:
                    </span>
                    <p className="text-amber-200/90">{crmForm.sourcingReferralContact}</p>
                  </div>
                )}
              </div>

              {/* Action Buttons: Spot Quote Bridge */}
              {crmForm.yarnCountsFabricItems && crmForm.destinationPortCnf && onCreateCostingQuote && (
                <div className="bg-indigo-950/60 border border-indigo-700/70 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h4 className="font-bold text-indigo-300 text-sm flex items-center gap-1.5">
                      <FileSpreadsheet className="w-4 h-4 text-indigo-400" />
                      Ready to Generate CNF / FOB Spot Quotation
                    </h4>
                    <p className="text-xs text-indigo-200/80 mt-0.5">
                      Counts: <b>{crmForm.yarnCountsFabricItems}</b> | Port: <b>{crmForm.destinationPortCnf}</b>
                    </p>
                  </div>
                  <button
                    onClick={() => onCreateCostingQuote(crmForm.yarnCountsFabricItems, crmForm.destinationPortCnf)}
                    className="inline-flex items-center space-x-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer shrink-0"
                  >
                    <span>Open Costing Sheet with Pre-fill</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}

            </div>
          )}

          {/* TAB 2: DRIP EMAILS TIMELINE */}
          {activeTab === 'emails' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                <h3 className="text-sm font-bold text-white">
                  Drip Sequence Dispatches ({lead.emailLogs.length} emails sent)
                </h3>
                {lead.isDripActive && lead.status !== 'mail_3_sent' && (
                  <button
                    onClick={handleSendNextStep}
                    disabled={isSendingEmail}
                    className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Send Next Email Step Now</span>
                  </button>
                )}
              </div>

              {lead.emailLogs.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs">
                  No emails have been sent to this lead yet.
                </div>
              ) : (
                lead.emailLogs.map((log, index) => (
                  <div key={log.id || index} className="bg-slate-950/60 border border-slate-800 rounded-xl p-4 text-xs space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 font-bold border border-indigo-800">
                          Mail #{log.step}
                        </span>
                        <span className="font-bold text-slate-100">{log.subject}</span>
                      </div>
                      <div className="flex items-center space-x-3 text-slate-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {new Date(log.sentAt).toLocaleString()}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full font-semibold ${
                          log.status === 'replied'
                            ? 'bg-emerald-950 text-emerald-300 border border-emerald-700'
                            : 'bg-slate-800 text-slate-300'
                        }`}>
                          {log.status === 'replied' ? '✓ Replied' : 'Sent'}
                        </span>
                      </div>
                    </div>

                    <div className="text-slate-400 space-y-0.5">
                      <div><span className="text-slate-500">From:</span> {log.sender}</div>
                      <div><span className="text-slate-500">To:</span> {log.recipient}</div>
                    </div>

                    <div className="bg-slate-900/90 p-3 rounded-lg border border-slate-800/90 font-mono text-[11px] text-slate-300 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                      {log.body}
                    </div>

                    {/* Show Inbound Reply if present */}
                    {log.replyText && (
                      <div className="mt-3 p-3 bg-emerald-950/40 border border-emerald-800/80 rounded-lg text-xs space-y-2">
                        <div className="flex items-center justify-between text-emerald-300 font-semibold">
                          <span className="flex items-center gap-1.5">
                            <MessageSquare className="w-3.5 h-3.5" />
                            Inbound Reply Received ({log.repliedAt ? new Date(log.repliedAt).toLocaleString() : 'Recent'})
                          </span>
                          <span className="text-[11px] bg-emerald-900 px-2 py-0.5 rounded text-emerald-200">
                            Auto-Parsed
                          </span>
                        </div>
                        <div className="font-mono text-[11px] text-emerald-200/90 whitespace-pre-wrap bg-slate-950/60 p-2.5 rounded border border-emerald-900/60">
                          {log.replyText}
                        </div>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {/* TAB 3: INBOUND REPLY SIMULATOR & AUTO-PARSER */}
          {activeTab === 'simulator' && (
            <div className="space-y-5">
              <div className="bg-indigo-950/40 border border-indigo-800/60 rounded-xl p-4 text-xs">
                <h4 className="font-bold text-indigo-300 text-sm flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  Inbound Reply AI & Regex Auto-Extractor Testbed
                </h4>
                <p className="text-indigo-200/90 mt-1">
                  Test how the system parses incoming emails from textile buyers. Select a sample scenario or type any custom response. The 6 CRM fields will be extracted in real-time and saved directly into the lead record!
                </p>
              </div>

              {/* Sample Scenarios Bar */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-2">
                  Select Realistic Buyer Scenario:
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {SAMPLE_REPLY_SCENARIOS.map((sc, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSelectScenario(idx)}
                      className={`p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                        selectedScenarioIndex === idx
                          ? 'bg-indigo-950/80 border-indigo-500 text-white shadow-md'
                          : 'bg-slate-950/60 hover:bg-slate-800 border-slate-800 text-slate-300'
                      }`}
                    >
                      <div className="font-bold">{sc.title}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5">{sc.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Reply Textarea */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Email Reply Body (Editable):
                </label>
                <textarea
                  rows={6}
                  value={customReplyText}
                  onChange={(e) => handleReplyTextChange(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 font-mono text-xs text-white focus:outline-hidden focus:border-indigo-500"
                  placeholder="Paste or write customer reply here..."
                />
              </div>

              {/* Live Auto-Parse Preview */}
              {parsePreview && (
                <div className="bg-slate-950/80 border border-emerald-800/80 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5">
                      <CheckCircle className="w-4 h-4" />
                      Live Extracted CRM Fields Preview ({parsePreview.extractedCount}/6 Fields Detected)
                    </span>
                    <span className="text-xs bg-emerald-950 border border-emerald-700 text-emerald-300 px-2 py-0.5 rounded-full font-mono">
                      {parsePreview.confidenceScore}% Confidence
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="bg-slate-900 p-2 rounded border border-slate-800">
                      <span className="text-slate-400 text-[11px]">Contact Person:</span>
                      <p className="font-semibold text-white">
                        {parsePreview.extractedFields.contactPersonResponsible || '—'}
                      </p>
                    </div>
                    <div className="bg-slate-900 p-2 rounded border border-slate-800">
                      <span className="text-slate-400 text-[11px]">Direct Email:</span>
                      <p className="font-semibold text-white">
                        {parsePreview.extractedFields.directEmailId || '—'}
                      </p>
                    </div>
                    <div className="bg-slate-900 p-2 rounded border border-slate-800">
                      <span className="text-slate-400 text-[11px]">Phone / WhatsApp:</span>
                      <p className="font-semibold text-white">
                        {parsePreview.extractedFields.phoneWhatsApp || '—'}
                      </p>
                    </div>
                    <div className="bg-slate-900 p-2 rounded border border-slate-800">
                      <span className="text-slate-400 text-[11px]">Yarn Counts / Items:</span>
                      <p className="font-semibold text-emerald-400">
                        {parsePreview.extractedFields.yarnCountsFabricItems || '—'}
                      </p>
                    </div>
                    <div className="bg-slate-900 p-2 rounded border border-slate-800">
                      <span className="text-slate-400 text-[11px]">Approx Monthly Qty:</span>
                      <p className="font-semibold text-white">
                        {parsePreview.extractedFields.approximateQuantityPerMonth || '—'}
                      </p>
                    </div>
                    <div className="bg-slate-900 p-2 rounded border border-slate-800">
                      <span className="text-slate-400 text-[11px]">Destination Port (CNF):</span>
                      <p className="font-semibold text-indigo-400">
                        {parsePreview.extractedFields.destinationPortCnf || '—'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Execute Button */}
              <div className="flex justify-end">
                <button
                  onClick={handleExecuteSimulatedReply}
                  disabled={isParsingReply || !customReplyText.trim()}
                  className="inline-flex items-center space-x-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold shadow-lg transition-all cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Simulate Incoming Reply & Auto-Populate CRM</span>
                </button>
              </div>
            </div>
          )}

          {/* TAB 4: SALES CALLS & 2-ATTEMPT RULE */}
          {activeTab === 'calling' && (
            <div className="space-y-5">
              
              {/* Rule Card */}
              <div className="bg-amber-950/50 border border-amber-800/80 rounded-xl p-4 text-xs">
                <h4 className="font-bold text-amber-300 text-sm flex items-center gap-1.5">
                  <PhoneCall className="w-4 h-4 text-amber-400" />
                  Sales Call Follow-up & 2-Attempt Rule
                </h4>
                <p className="text-amber-200/90 mt-1">
                  <b>Workflow Rule:</b> If a lead reaches Step 4 without replying, a sales representative calls them. If in <b>2 attempts</b> they cannot connect on the phone, the system automatically transitions the status to <b>Not Reachable</b> and halts further outreach.
                </p>
              </div>

              {/* Call Attempts Logged */}
              <div>
                <h4 className="text-xs font-bold text-slate-300 mb-2">
                  Call Attempts Logged ({lead.callAttempts.length}/2):
                </h4>

                {lead.callAttempts.length === 0 ? (
                  <div className="p-4 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-400 text-xs text-center">
                    No phone call attempts logged yet. Record Call Attempt 1 below.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {lead.callAttempts.map((call, idx) => (
                      <div
                        key={call.id || idx}
                        className={`p-3 rounded-xl border text-xs flex items-start justify-between ${
                          call.outcome === 'connected'
                            ? 'bg-emerald-950/50 border-emerald-700 text-emerald-200'
                            : 'bg-slate-950/70 border-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="font-bold text-white">
                              Attempt #{call.attemptNumber || idx + 1}
                            </span>
                            <span className={`px-2 py-0.5 rounded font-semibold ${
                              call.outcome === 'connected'
                                ? 'bg-emerald-900 text-emerald-200'
                                : 'bg-rose-950 text-rose-300 border border-rose-800'
                            }`}>
                              {call.outcome === 'connected' ? 'Connected ✓' : `Failed: ${call.outcome}`}
                            </span>
                            <span className="text-slate-400 text-[11px]">
                              by {call.callerName}
                            </span>
                          </div>
                          <p className="text-slate-400 text-[11px]">
                            {new Date(call.attemptedAt).toLocaleString()}
                          </p>
                          {call.notes && (
                            <p className="text-slate-200 bg-slate-900/80 p-2 rounded border border-slate-800 mt-1">
                              Notes: {call.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Log New Call Form */}
              {lead.status !== 'not_reachable' && lead.callAttempts.length < 2 && (
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 space-y-3 text-xs">
                  <h4 className="font-bold text-white flex items-center justify-between">
                    <span>Record Call Attempt #{lead.callAttempts.length + 1}</span>
                    <span className="text-slate-400 font-normal">
                      Target Phone: <b>{lead.crmFields.phoneWhatsApp || lead.initialPhone || 'No Phone Specified'}</b>
                    </span>
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-400 block mb-1">Sales Representative:</label>
                      <input
                        type="text"
                        value={callerName}
                        onChange={(e) => setCallerName(e.target.value)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                      />
                    </div>

                    <div>
                      <label className="text-slate-400 block mb-1">Call Outcome:</label>
                      <select
                        value={callOutcome}
                        onChange={(e) => setCallOutcome(e.target.value as any)}
                        className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                      >
                        <option value="no_answer">No Answer / Ringing Out</option>
                        <option value="switched_off">Switched Off / Unreachable</option>
                        <option value="busy">Line Busy</option>
                        <option value="wrong_number">Invalid / Wrong Number</option>
                        <option value="call_back_requested">Call Back Requested</option>
                        <option value="connected">Connected & Sourcing Discussed</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-400 block mb-1">Call Notes:</label>
                    <textarea
                      rows={2}
                      value={callNotes}
                      onChange={(e) => setCallNotes(e.target.value)}
                      placeholder="e.g. Rang 5 times, prospect was in meeting, will try again tomorrow..."
                      className="w-full bg-slate-900 border border-slate-700 rounded px-2.5 py-1.5 text-white"
                    />
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      onClick={handleExecuteLogCall}
                      disabled={isLoggingCall}
                      className="inline-flex items-center space-x-1.5 px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
                    >
                      <PhoneCall className="w-3.5 h-3.5" />
                      <span>
                        Save Call Attempt #{lead.callAttempts.length + 1}
                        {lead.callAttempts.length === 1 && callOutcome !== 'connected'
                          ? ' (Will trigger Not Reachable)'
                          : ''}
                      </span>
                    </button>
                  </div>
                </div>
              )}

            </div>
          )}

          {/* TAB 5: AUDIT HISTORY */}
          {activeTab === 'history' && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-white mb-2">
                Lead Audit Trail & Automation Log
              </h3>
              <div className="space-y-2">
                {lead.history.map((hist, idx) => (
                  <div key={hist.id || idx} className="bg-slate-950/60 border border-slate-800 rounded-xl p-3 text-xs flex items-start space-x-3">
                    <div className="p-1.5 bg-indigo-950 text-indigo-400 rounded-lg shrink-0 mt-0.5">
                      <History className="w-3.5 h-3.5" />
                    </div>
                    <div className="flex-1 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-100">{hist.action}</span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          {new Date(hist.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-slate-300">{hist.details}</p>
                      <p className="text-[11px] text-slate-500">Actor: {hist.actor}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* MODAL FOOTER */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs">
          <div className="text-slate-400">
            Assigned: <span className="text-slate-200 font-medium">{lead.assignedTo}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-xl transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
