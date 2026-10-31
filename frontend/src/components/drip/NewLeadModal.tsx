import React, { useState } from 'react';
import { X, UserPlus, Building2, User, Mail, Phone, Globe, Send, Check } from 'lucide-react';

interface NewLeadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateLead: (payload: {
    companyName: string;
    leadName: string;
    email: string;
    phone?: string;
    country?: string;
    notes?: string;
    assignedTo?: string;
    sendEmail1Immediately?: boolean;
  }) => Promise<void>;
}

export const NewLeadModal: React.FC<NewLeadModalProps> = ({
  isOpen,
  onClose,
  onCreateLead,
}) => {
  if (!isOpen) return null;

  const [companyName, setCompanyName] = useState('');
  const [leadName, setLeadName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('Bangladesh');
  const [notes, setNotes] = useState('');
  const [assignedTo, setAssignedTo] = useState('Rohit Sharma (Exports)');
  const [sendImmediately, setSendImmediately] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !leadName.trim() || !email.trim()) {
      setError('Company Name, Lead Name, and Email are required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onCreateLead({
        companyName: companyName.trim(),
        leadName: leadName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        country: country.trim(),
        notes: notes.trim(),
        assignedTo,
        sendEmail1Immediately: sendImmediately,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to create lead');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full shadow-2xl overflow-hidden text-slate-100">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/60">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 rounded-xl">
              <UserPlus className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Enroll New Lead in Drip Campaign</h3>
              <p className="text-xs text-slate-400">Triggers automated information collection sequence</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 bg-rose-950/60 border border-rose-800 text-rose-300 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="text-slate-300 font-medium block mb-1">
              Company Name <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <Building2 className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                required
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="e.g. Beximco Textiles Ltd"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-white placeholder:text-slate-600 focus:outline-hidden focus:border-indigo-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-slate-300 font-medium block mb-1">
                Lead / Contact Name <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  required
                  value={leadName}
                  onChange={(e) => setLeadName(e.target.value)}
                  placeholder="e.g. Tariq Rahman"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-white placeholder:text-slate-600 focus:outline-hidden focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-300 font-medium block mb-1">
                Direct Email ID <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g. t.rahman@beximco.com"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-white placeholder:text-slate-600 focus:outline-hidden focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-slate-300 font-medium block mb-1">Phone / WhatsApp</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. +880 1712-345678"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-white placeholder:text-slate-600 focus:outline-hidden focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="text-slate-300 font-medium block mb-1">Country / Market</label>
              <div className="relative">
                <Globe className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="e.g. Bangladesh, Vietnam, Turkey, Egypt"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-3 py-2 text-white placeholder:text-slate-600 focus:outline-hidden focus:border-indigo-500"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="text-slate-300 font-medium block mb-1">Assigned Sales Rep</label>
            <select
              value={assignedTo}
              onChange={(e) => setAssignedTo(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white focus:outline-hidden focus:border-indigo-500"
            >
              <option value="Rohit Sharma (Exports)">Rohit Sharma (Exports Representative)</option>
              <option value="Vikram Mehta (VP Sales)">Vikram Mehta (VP International Sales)</option>
              <option value="Amitabh Lahoti (Director)">Amitabh Lahoti (Director)</option>
              <option value="Pooja Kulkarni (Account Manager)">Pooja Kulkarni (Account Manager)</option>
            </select>
          </div>

          <div>
            <label className="text-slate-300 font-medium block mb-1">Notes / Lead Source</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Met at Dhaka Apparel Expo, interested in 30s combed compact yarns..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-2.5 text-white placeholder:text-slate-600 focus:outline-hidden focus:border-indigo-500"
            />
          </div>

          {/* Trigger 1st Mail Checkbox */}
          <div className="bg-indigo-950/40 border border-indigo-800/60 rounded-xl p-3 flex items-start space-x-2.5">
            <input
              type="checkbox"
              id="sendImmediately"
              checked={sendImmediately}
              onChange={(e) => setSendImmediately(e.target.checked)}
              className="rounded mt-0.5 text-indigo-600 bg-slate-900 border-slate-700 cursor-pointer"
            />
            <label htmlFor="sendImmediately" className="text-xs text-indigo-200 cursor-pointer">
              <span className="font-bold text-white block">
                Send 1st Information Collection Email Immediately
              </span>
              <span>
                Dispatches the introductory email with the 6-field questionnaire and schedules the 4-day follow-up.
              </span>
            </label>
          </div>

          {/* Footer Buttons */}
          <div className="flex items-center justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-slate-400 hover:text-white rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center space-x-1.5 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-xl shadow-lg transition-all cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Enrolling...' : 'Enroll & Launch Sequence'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
