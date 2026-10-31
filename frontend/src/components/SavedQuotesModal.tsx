import React, { useState } from 'react';
import { SavedQuote, UserProfile } from '../types';
import { History, Search, Trash2, ArrowRight, Printer, Calendar, User, Globe, DollarSign, Lock } from 'lucide-react';
import { formatCurrencyByCode, formatDate, formatUSD } from '../utils/formatters';

interface SavedQuotesModalProps {
  quotes: SavedQuote[];
  onLoadQuote: (quote: SavedQuote) => void;
  onDeleteQuote: (id: string) => void;
  onPrintQuote: (quote: SavedQuote) => void;
  currentUser?: UserProfile | null;
}

export const SavedQuotesModal: React.FC<SavedQuotesModalProps> = ({
  quotes,
  onLoadQuote,
  onDeleteQuote,
  onPrintQuote,
  currentUser,
}) => {
  const isAdmin = currentUser?.role === 'admin';
  const [searchTerm, setSearchTerm] = useState('');

  const filteredQuotes = quotes.filter((q) => {
    const term = searchTerm.toLowerCase();
    return (
      (q.customer_name && q.customer_name.toLowerCase().includes(term)) ||
      (q.quote_number && q.quote_number.toLowerCase().includes(term)) ||
      (q.yarn_count_name && q.yarn_count_name.toLowerCase().includes(term)) ||
      (q.destination_country && q.destination_country.toLowerCase().includes(term))
    );
  });

  return (
    <div className="bg-slate-50 min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <History className="w-6 h-6 text-indigo-600" />
              <h2 className="text-xl font-bold text-slate-900">Saved Yarn Export Quotes</h2>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Historical Export Cost Sheets saved via server RPC endpoint.
            </p>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              id="search-saved-quotes"
              type="text"
              placeholder="Search by customer, quote #, yarn..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-xl py-2 pl-9 pr-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Quotes List Grid */}
        {filteredQuotes.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-slate-200 text-slate-500">
            No saved quotes found matching your search term.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredQuotes.map((quote) => (
              <div
                key={quote.id}
                className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 hover:border-indigo-300 transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between border-b border-slate-100 pb-3">
                    <div>
                      <span className="text-[11px] font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                        {quote.quote_number}
                      </span>
                      <h3 className="font-bold text-slate-900 text-sm mt-1">
                        {quote.customer_name || 'Valued Customer'}
                      </h3>
                      {quote.destination_country && (
                        <p className="text-xs text-slate-400 flex items-center space-x-1 mt-0.5">
                          <Globe className="w-3 h-3" />
                          <span>{quote.destination_country}</span>
                        </p>
                      )}
                    </div>

                    <button
                      id={`delete-quote-${quote.id}`}
                      onClick={() => onDeleteQuote(quote.id)}
                      title="Delete Quote"
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between text-slate-600">
                      <span>Yarn Count:</span>
                      <span className="font-semibold text-slate-900">{quote.yarn_count_name}</span>
                    </div>

                    <div className="flex items-center justify-between text-slate-600">
                      <span>Container Load:</span>
                      <span className="font-mono text-slate-800">{quote.container_type}</span>
                    </div>

                    <div className="flex items-center justify-between text-slate-600">
                      <span>CIF Price / kg:</span>
                      <span className="font-mono font-bold text-indigo-600">
                        {formatCurrencyByCode(quote.cif_price_usd_per_kg, quote.inputs.currency_code, 4)}
                      </span>
                    </div>

                    {isAdmin && (
                      <div className="flex items-center justify-between text-slate-600">
                        <span>Container Net Profit:</span>
                        <span className="font-mono font-bold text-emerald-600">
                          {formatUSD(quote.total_net_profit_usd, 2)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <span className="text-[10px] text-slate-400 flex items-center space-x-1">
                    <Calendar className="w-3 h-3" />
                    <span>{formatDate(quote.created_at)}</span>
                  </span>

                  <div className="flex items-center space-x-2">
                    <button
                      id={`print-quote-${quote.id}`}
                      onClick={() => onPrintQuote(quote)}
                      title="Print Commercial Sheet"
                      className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </button>

                    <button
                      id={`load-quote-${quote.id}`}
                      onClick={() => onLoadQuote(quote)}
                      className="inline-flex items-center space-x-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-semibold shadow-sm transition-colors"
                    >
                      <span>Load</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
};
