import React, { useState } from 'react';
import { X, Sliders, Mail, Clock, Save, Check } from 'lucide-react';
import { CampaignTemplate } from '../../types';

interface CampaignTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  templates: CampaignTemplate[];
  onSaveTemplates: (templates: CampaignTemplate[]) => Promise<void>;
}

export const CampaignTemplatesModal: React.FC<CampaignTemplatesModalProps> = ({
  isOpen,
  onClose,
  templates,
  onSaveTemplates,
}) => {
  if (!isOpen) return null;

  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);
  const [templateList, setTemplateList] = useState<CampaignTemplate[]>(JSON.parse(JSON.stringify(templates)));
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const currentTemplate = templateList.find((t) => t.step === activeStep) || templateList[0];

  const handleUpdateCurrent = (field: keyof CampaignTemplate, value: any) => {
    setTemplateList((prev) =>
      prev.map((t) => (t.step === activeStep ? { ...t, [field]: value } : t))
    );
  };

  const handleSaveAll = async () => {
    setIsSaving(true);
    try {
      await onSaveTemplates(templateList);
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-3xl w-full shadow-2xl overflow-hidden text-slate-100 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-xl">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Drip Campaign Email Sequence Templates</h3>
              <p className="text-xs text-slate-400">Personalize templates with dynamic placeholders like [Company Name], [Lead Name]</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Selector Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/40 px-6 space-x-2 text-xs font-semibold">
          {[1, 2, 3].map((step) => (
            <button
              key={step}
              onClick={() => setActiveStep(step as any)}
              className={`px-4 py-3 border-b-2 transition-all cursor-pointer flex items-center gap-1.5 ${
                activeStep === step
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>{step === 1 ? '1st Mail (Info Collection)' : step === 2 ? '2nd Mail (4-Day Follow-up)' : '3rd Mail (Supply Chain)'}</span>
            </button>
          ))}
        </div>

        {/* Template Editor Form */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1 text-xs">
          
          {/* Trigger Condition Banner */}
          <div className="p-3 bg-slate-950/60 border border-slate-800 rounded-xl flex items-center justify-between">
            <div className="flex items-center space-x-2 text-slate-300">
              <Clock className="w-4 h-4 text-amber-400" />
              <span>
                <b>Trigger Rule:</b> {currentTemplate.triggerCondition}
              </span>
            </div>
            <span className="text-indigo-400 font-mono font-bold bg-indigo-950/80 px-2.5 py-0.5 rounded border border-indigo-800">
              Step #{currentTemplate.step}
            </span>
          </div>

          {/* Subject Field */}
          <div>
            <label className="text-slate-300 font-medium block mb-1">Email Subject Line:</label>
            <input
              type="text"
              value={currentTemplate.subject}
              onChange={(e) => handleUpdateCurrent('subject', e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          {/* Merge Tags Guide */}
          <div className="bg-slate-950/40 p-2.5 rounded-lg border border-slate-800 text-[11px] text-slate-400">
            <span className="font-semibold text-slate-300 mr-1.5">Supported Variables:</span>
            <code className="text-indigo-300 bg-indigo-950/80 px-1.5 py-0.5 rounded mr-1">[Company Name]</code>
            <code className="text-indigo-300 bg-indigo-950/80 px-1.5 py-0.5 rounded mr-1">[Lead Name]</code>
            <code className="text-indigo-300 bg-indigo-950/80 px-1.5 py-0.5 rounded mr-1">[Prospect Name]</code>
            <code className="text-indigo-300 bg-indigo-950/80 px-1.5 py-0.5 rounded mr-1">[Sender Name]</code>
          </div>

          {/* Body Textarea */}
          <div>
            <label className="text-slate-300 font-medium block mb-1">Email Body Template:</label>
            <textarea
              rows={12}
              value={currentTemplate.bodyTemplate}
              onChange={(e) => handleUpdateCurrent('bodyTemplate', e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 font-mono text-xs text-white leading-relaxed focus:outline-hidden focus:border-indigo-500"
            />
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs">
          <div>
            {savedSuccess && (
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <Check className="w-4 h-4" /> Templates saved successfully!
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
            >
              Close
            </button>
            <button
              onClick={handleSaveAll}
              disabled={isSaving}
              className="inline-flex items-center space-x-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg transition-all cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isSaving ? 'Saving...' : 'Save Templates'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
