import React from 'react';
import {
  Mail,
  Clock,
  PhoneCall,
  UserX,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  FastForward,
  Play,
  RotateCcw,
  Sliders,
  FileSpreadsheet,
} from 'lucide-react';
import { Lead } from '../../types';

interface VisualWorkflowCanvasProps {
  leads: Lead[];
  activeFilter: string;
  onSelectFilter: (filter: string) => void;
  onFastForward: () => void;
  onRunBatch: () => void;
  onResetDemo: () => void;
  onOpenTemplates: () => void;
  isProcessing: boolean;
  virtualDays: number;
}

export const VisualWorkflowCanvas: React.FC<VisualWorkflowCanvasProps> = ({
  leads,
  activeFilter,
  onSelectFilter,
  onFastForward,
  onRunBatch,
  onResetDemo,
  onOpenTemplates,
  isProcessing,
  virtualDays,
}) => {
  // Compute stage counts
  const countStep1 = leads.filter((l) => l.status === 'mail_1_sent' || l.status === 'new_lead').length;
  const countStep2 = leads.filter((l) => l.status === 'mail_2_sent').length;
  const countStep3 = leads.filter((l) => l.status === 'mail_3_sent').length;
  const countCallPending = leads.filter(
    (l) => l.status === 'call_pending_1' || l.status === 'call_pending_2'
  ).length;
  const countNotReachable = leads.filter((l) => l.status === 'not_reachable').length;
  const countReplied = leads.filter(
    (l) => l.status === 'info_received' || l.status === 'call_connected'
  ).length;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl text-white mb-6">
      {/* Header bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-2.5">
            <span className="p-2 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-xl">
              <Sparkles className="w-5 h-5 text-indigo-400" />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2">
                <span>Lahoti Lead Nurturing & Info Collection Workflow</span>
                <span className="text-xs bg-emerald-950 text-emerald-300 border border-emerald-700/60 px-2 py-0.5 rounded-full font-medium">
                  Active Automation
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                4-Stage Drip Sequence • Auto-extracts 6 CRM fields on reply • Enforces 2-call limit for Not Reachable status
              </p>
            </div>
          </div>
        </div>

        {/* Workflow Simulation & Control Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          {virtualDays > 0 && (
            <div className="bg-amber-950/80 text-amber-300 border border-amber-600/60 text-xs px-2.5 py-1.5 rounded-lg flex items-center space-x-1.5 font-mono">
              <Clock className="w-3.5 h-3.5" />
              <span>Simulated +{virtualDays} Days</span>
            </div>
          )}

          <button
            onClick={onFastForward}
            disabled={isProcessing}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50"
            title="Fast forward virtual time by 4 days to test the follow-up triggers"
          >
            <FastForward className="w-3.5 h-3.5" />
            <span>Fast-Forward +4 Days</span>
          </button>

          <button
            onClick={onRunBatch}
            disabled={isProcessing}
            className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition-all cursor-pointer disabled:opacity-50"
            title="Run automation check immediately"
          >
            <Play className={`w-3.5 h-3.5 ${isProcessing ? 'animate-spin' : ''}`} />
            <span>Run Drip Batch</span>
          </button>

          <button
            onClick={onOpenTemplates}
            className="inline-flex items-center space-x-1.5 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium transition-all cursor-pointer"
            title="View or edit the 3 email templates"
          >
            <Sliders className="w-3.5 h-3.5 text-indigo-400" />
            <span>Templates</span>
          </button>

          <button
            onClick={onResetDemo}
            disabled={isProcessing}
            className="inline-flex items-center space-x-1 px-2.5 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-700/80 rounded-lg text-xs transition-all cursor-pointer"
            title="Reset leads to demo dataset"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Demo</span>
          </button>
        </div>
      </div>

      {/* Visual Step Canvas */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3.5 pt-5">
        
        {/* STEP 1 NODE */}
        <div
          onClick={() => onSelectFilter('mail_1')}
          className={`relative rounded-xl p-4 transition-all cursor-pointer border ${
            activeFilter === 'mail_1'
              ? 'bg-slate-800/95 border-indigo-500 shadow-lg shadow-indigo-950/40 ring-1 ring-indigo-500'
              : 'bg-slate-800/50 hover:bg-slate-800/80 border-slate-700/80 hover:border-slate-600'
          }`}
        >
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-mono tracking-wider uppercase font-semibold text-indigo-400 bg-indigo-950/80 border border-indigo-800 px-2 py-0.5 rounded">
              Stage 1 • Trigger
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-700 text-white font-mono">
              {countStep1} leads
            </span>
          </div>
          <div className="flex items-start space-x-2.5">
            <div className="p-2 bg-indigo-500/20 text-indigo-300 rounded-lg shrink-0 mt-0.5">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-100">1st Mail: Info Collection</h3>
              <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                Triggered immediately on New Lead. Asks for 6 key CRM sourcing fields.
              </p>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-700/60 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1 text-slate-300">
              <Clock className="w-3 h-3 text-amber-400" /> Wait 4 Days
            </span>
            <span className="text-indigo-400 flex items-center gap-1 font-medium">
              If No Reply <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* STEP 2 NODE */}
        <div
          onClick={() => onSelectFilter('mail_2')}
          className={`relative rounded-xl p-4 transition-all cursor-pointer border ${
            activeFilter === 'mail_2'
              ? 'bg-slate-800/95 border-indigo-500 shadow-lg shadow-indigo-950/40 ring-1 ring-indigo-500'
              : 'bg-slate-800/50 hover:bg-slate-800/80 border-slate-700/80 hover:border-slate-600'
          }`}
        >
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-mono tracking-wider uppercase font-semibold text-blue-400 bg-blue-950/80 border border-blue-800 px-2 py-0.5 rounded">
              Stage 2 • 4-Day Follow-up
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-700 text-white font-mono">
              {countStep2} leads
            </span>
          </div>
          <div className="flex items-start space-x-2.5">
            <div className="p-2 bg-blue-500/20 text-blue-300 rounded-lg shrink-0 mt-0.5">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-100">2nd Mail: Value & CNF Spot</h3>
              <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                Highlights 25+ yrs experience, competitive yarn counts & prompt container quotes.
              </p>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-700/60 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1 text-slate-300">
              <Clock className="w-3 h-3 text-amber-400" /> Wait 4 Days
            </span>
            <span className="text-blue-400 flex items-center gap-1 font-medium">
              If No Reply <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* STEP 3 NODE */}
        <div
          onClick={() => onSelectFilter('mail_3')}
          className={`relative rounded-xl p-4 transition-all cursor-pointer border ${
            activeFilter === 'mail_3'
              ? 'bg-slate-800/95 border-indigo-500 shadow-lg shadow-indigo-950/40 ring-1 ring-indigo-500'
              : 'bg-slate-800/50 hover:bg-slate-800/80 border-slate-700/80 hover:border-slate-600'
          }`}
        >
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-mono tracking-wider uppercase font-semibold text-purple-400 bg-purple-950/80 border border-purple-800 px-2 py-0.5 rounded">
              Stage 3 • Final Email
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-700 text-white font-mono">
              {countStep3} leads
            </span>
          </div>
          <div className="flex items-start space-x-2.5">
            <div className="p-2 bg-purple-500/20 text-purple-300 rounded-lg shrink-0 mt-0.5">
              <Mail className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-100">3rd Mail: Direct Mill Supply</h3>
              <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                Streamlining yarn supply chain across 40+ countries & 5-min intro call proposal.
              </p>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-700/60 flex items-center justify-between text-[11px] text-slate-400">
            <span className="flex items-center gap-1 text-slate-300">
              <Clock className="w-3 h-3 text-amber-400" /> Wait 4 Days
            </span>
            <span className="text-purple-400 flex items-center gap-1 font-medium">
              Assign Call <ArrowRight className="w-3 h-3" />
            </span>
          </div>
        </div>

        {/* STEP 4 NODE: SALES CALL & 2-ATTEMPT LIMIT */}
        <div
          onClick={() => onSelectFilter('calling')}
          className={`relative rounded-xl p-4 transition-all cursor-pointer border ${
            activeFilter === 'calling'
              ? 'bg-slate-800/95 border-amber-500 shadow-lg shadow-amber-950/40 ring-1 ring-amber-500'
              : 'bg-slate-800/50 hover:bg-slate-800/80 border-slate-700/80 hover:border-slate-600'
          }`}
        >
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-mono tracking-wider uppercase font-semibold text-amber-400 bg-amber-950/80 border border-amber-800 px-2 py-0.5 rounded">
              Stage 4 • Phone Outreach
            </span>
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-700 text-white font-mono">
              {countCallPending} leads
            </span>
          </div>
          <div className="flex items-start space-x-2.5">
            <div className="p-2 bg-amber-500/20 text-amber-300 rounded-lg shrink-0 mt-0.5">
              <PhoneCall className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-slate-100">Sales Calling (Max 2 Attempts)</h3>
              <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                Sales rep calls prospect. If in 2 times cannot connect, lead automatically becomes Not Reachable.
              </p>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-slate-700/60 flex items-center justify-between text-[11px]">
            <span className="text-rose-400 font-semibold flex items-center gap-1">
              <UserX className="w-3 h-3" /> 2 Failed = Not Reachable ({countNotReachable})
            </span>
            <span className="text-slate-400">Rule Enforced</span>
          </div>
        </div>

      </div>

      {/* Bottom Sub-flow: Reply Intercept & CRM Auto-Population */}
      <div className="mt-4 pt-3.5 border-t border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs bg-slate-950/40 p-3 rounded-xl border border-slate-800/60">
        <div className="flex items-center space-x-2.5">
          <div className="p-1.5 bg-emerald-500/20 text-emerald-400 rounded-lg">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <span className="font-semibold text-emerald-300">
              ⚡ Inbound Reply Auto-Extraction Branch ({countReplied} Leads Replied & Updated):
            </span>
            <span className="text-slate-400 ml-1.5">
              When a lead replies to Mail 1, 2, or 3, AI/NLP extracts Contact Person, Direct Email, Phone/WhatsApp, Counts, Qty & Destination Port directly into CRM and halts further emails.
            </span>
          </div>
        </div>
        <button
          onClick={() => onSelectFilter('info_received')}
          className="self-start md:self-auto px-3 py-1 bg-emerald-900/60 hover:bg-emerald-800 text-emerald-200 border border-emerald-700/60 rounded-lg text-xs font-medium transition-colors cursor-pointer shrink-0"
        >
          View Replied Leads ({countReplied})
        </button>
      </div>

    </div>
  );
};
