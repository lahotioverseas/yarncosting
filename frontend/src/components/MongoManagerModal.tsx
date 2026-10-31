import React, { useState, useEffect, useCallback } from 'react';
import { getAuthJsonHeaders } from '../lib/authData';
import {
  Database,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  X,
  Server,
  Layers,
  ShieldAlert,
  Copy,
  Check,
  ExternalLink,
  Table,
  Zap,
  Info,
  UploadCloud,
  CheckCheck,
  Edit3,
} from 'lucide-react';

interface MongoStatusData {
  connection: {
    connected: boolean;
    dbName: string;
    maskedUri: string;
    clusterHost?: string;
    outboundIp: string;
    serverSelectionTimeout: boolean;
    ipWhitelistError: boolean;
    authError: boolean;
    errorMessage: string | null;
    instruction?: string;
    databases?: string[];
    latencyMs?: number;
  };
  dbName: string;
  expectedTables: Array<{
    name: string;
    description: string;
    indexesCount: number;
  }>;
}

interface MongoInitResult {
  success: boolean;
  dbName: string;
  totalTables: number;
  createdOrVerifiedCount: number;
  tables: Array<{
    name: string;
    description: string;
    exists: boolean;
    documentCount: number;
    indexesCount: number;
    status: 'created' | 'verified' | 'seeded' | 'failed' | 'pending';
    error?: string;
  }>;
}

interface PushDataResult {
  success: boolean;
  dbName: string;
  itemsPushed: Record<string, number>;
  connection: {
    connected: boolean;
    errorMessage?: string | null;
    instruction?: string;
  };
  message: string;
  timestamp: string;
}

interface MongoManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const MongoManagerModal: React.FC<MongoManagerModalProps> = ({ isOpen, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [initLoading, setInitLoading] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [statusData, setStatusData] = useState<MongoStatusData | null>(null);
  const [initResult, setInitResult] = useState<MongoInitResult | null>(null);
  const [pushResult, setPushResult] = useState<PushDataResult | null>(null);
  const [copiedIp, setCopiedIp] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [customUri, setCustomUri] = useState('');
  const [isEditingUri, setIsEditingUri] = useState(false);
  const [activeTab, setActiveTab] = useState<'tables' | 'push' | 'connection' | 'atlas-guide'>('push');

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/mongo/status', { headers: getAuthJsonHeaders() });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = await res.json();
        if (json.success && json.data) {
          setStatusData(json.data);
        }
      }
    } catch (e) {
      console.error('Failed to fetch mongo status:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
    }
  }, [isOpen, fetchStatus]);

  const handleTestConnection = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/mongo/test', {
        method: 'POST',
        headers: getAuthJsonHeaders(),
        body: JSON.stringify({ uri: customUri }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = await res.json();
        if (json.data) {
          setStatusData((prev) => prev ? { ...prev, connection: json.data } : null);
        }
      }
    } catch (e) {
      console.error('Test connection error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveUri = async () => {
    try {
      await fetch('/api/mongo/set-uri', {
        method: 'POST',
        headers: getAuthJsonHeaders(),
        body: JSON.stringify({ uri: customUri }),
      });
      setIsEditingUri(false);
      handleTestConnection();
    } catch (e) {
      console.error('Save URI error:', e);
    }
  };

  const handleInitTables = async () => {
    setInitLoading(true);
    try {
      const res = await fetch('/api/mongo/init', {
        method: 'POST',
        headers: getAuthJsonHeaders(),
        body: JSON.stringify({ uri: customUri }),
      });
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const json = await res.json();
        if (json.data) {
          setInitResult(json.data);
          if (json.data.connection) {
            setStatusData((prev) => prev ? { ...prev, connection: json.data.connection } : null);
          }
        }
      }
    } catch (e) {
      console.error('Init tables error:', e);
    } finally {
      setInitLoading(false);
    }
  };

  const handlePushBrowserData = async () => {
    setPushLoading(true);
    try {
      // 1. Gather all local browser data
      let browserDailyPricing = null;
      let browserSavedQuotes = [];
      let browserGoogleSheetUrls = null;
      let browserZohoAccounts = [];
      let browserUserSession = null;

      try {
        const rawPricing = localStorage.getItem('lahoti_daily_pricing_cache_v1');
        if (rawPricing) browserDailyPricing = JSON.parse(rawPricing);
      } catch {}

      try {
        const rawQuotes = localStorage.getItem('lahoti_saved_quotes_v1');
        if (rawQuotes) browserSavedQuotes = JSON.parse(rawQuotes);
      } catch {}

      try {
        const rawUrls = localStorage.getItem('lahoti_google_sheet_urls_v1');
        if (rawUrls) browserGoogleSheetUrls = JSON.parse(rawUrls);
      } catch {}

      try {
        const rawZoho = localStorage.getItem('lahoti_zoho_accounts_v3');
        if (rawZoho) {
          const parsed = JSON.parse(rawZoho);
          // Cap to top 500 accounts to keep client request lightweight; backend merges with disk cache
          browserZohoAccounts = Array.isArray(parsed) ? parsed.slice(0, 500) : [];
        }
      } catch {}

      try {
        const rawUser = localStorage.getItem('lahoti_user_session_v1');
        if (rawUser) browserUserSession = JSON.parse(rawUser);
      } catch {}

      const payload = {
        dailyPricing: browserDailyPricing,
        savedQuotes: browserSavedQuotes,
        googleSheetUrls: browserGoogleSheetUrls,
        zohoAccounts: browserZohoAccounts,
        userSession: browserUserSession,
      };

      // 2. Call backend push endpoint
      const res = await fetch('/api/mongo/push-all-data', {
        method: 'POST',
        headers: getAuthJsonHeaders(),
        body: JSON.stringify(payload),
      });

      const contentType = res.headers.get('content-type') || '';
      let json: any = null;
      if (contentType.includes('application/json')) {
        json = await res.json();
      } else {
        const text = await res.text();
        throw new Error(`Server returned status ${res.status}: ${text.slice(0, 200)}`);
      }

      if (json.data) {
        setPushResult(json.data);
        if (json.data.connection) {
          setStatusData((prev) => prev ? { ...prev, connection: json.data.connection } : null);
        }
      } else if (!json.success && json.error) {
        setPushResult({
          success: false,
          dbName: statusData?.dbName || 'lahoti_costing_db',
          itemsPushed: {},
          connection: { connected: false, errorMessage: json.error },
          message: json.error,
          timestamp: new Date().toISOString(),
        });
      }
    } catch (e: any) {
      console.error('Push data error:', e);
      setPushResult({
        success: false,
        dbName: statusData?.dbName || 'lahoti_costing_db',
        itemsPushed: {},
        connection: { connected: false, errorMessage: e?.message || 'Push failed' },
        message: e?.message || 'Failed to push data to MongoDB.',
        timestamp: new Date().toISOString(),
      });
    } finally {
      setPushLoading(false);
    }
  };

  const copyToClipboard = (text: string, type: 'ip' | 'cmd') => {
    navigator.clipboard.writeText(text);
    if (type === 'ip') {
      setCopiedIp(true);
      setTimeout(() => setCopiedIp(false), 2000);
    } else {
      setCopiedCmd(true);
      setTimeout(() => setCopiedCmd(false), 2000);
    }
  };

  if (!isOpen) return null;

  const conn = statusData?.connection;
  const isConnected = Boolean(conn?.connected);
  const outboundIp = conn?.outboundIp || '34.34.244.61';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[94vh] flex flex-col overflow-hidden animate-in fade-in duration-200">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h2 className="text-lg font-bold">MongoDB Database & Data Migration</h2>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                  isConnected ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                }`}>
                  {isConnected ? 'Connected' : 'Connection Pending (IP Whitelist)'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5 font-mono">
                Cluster: cluster0.l5gdk5v.mongodb.net | DB: {statusData?.dbName || 'lahoti_costing_db'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Connection String Bar */}
        <div className="px-6 py-2.5 bg-slate-100 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center space-x-2 flex-1 min-w-[280px]">
            <span className="font-semibold text-slate-600 shrink-0">URI:</span>
            {isEditingUri ? (
              <div className="flex items-center space-x-2 flex-1">
                <input
                  type="text"
                  value={customUri}
                  onChange={(e) => setCustomUri(e.target.value)}
                  className="w-full text-xs font-mono bg-white border border-indigo-400 rounded-lg px-2.5 py-1 focus:outline-none"
                />
                <button
                  onClick={handleSaveUri}
                  className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg font-medium cursor-pointer"
                >
                  Save
                </button>
              </div>
            ) : (
              <span className="font-mono text-slate-700 truncate" title={customUri}>
                {conn?.maskedUri || 'mongodb+srv://***:***@cluster0.l5gdk5v.mongodb.net/'}
              </span>
            )}
            {!isEditingUri && (
              <button
                onClick={() => setIsEditingUri(true)}
                className="text-indigo-600 hover:text-indigo-800 p-1 cursor-pointer shrink-0"
                title="Edit connection string"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center space-x-3 text-slate-600">
            <div>
              <span>Outbound IP: </span>
              <button
                onClick={() => copyToClipboard(outboundIp, 'ip')}
                className="inline-flex items-center space-x-1 font-mono font-bold text-indigo-600 hover:text-indigo-800 cursor-pointer ml-1"
                title="Click to copy IP"
              >
                <span>{outboundIp}</span>
                {copiedIp ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3" />}
              </button>
            </div>
            <button
              onClick={handleTestConnection}
              disabled={loading}
              className="inline-flex items-center space-x-1 px-2.5 py-1 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-md font-medium cursor-pointer text-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin text-indigo-600' : ''}`} />
              <span>Test Connection</span>
            </button>
          </div>
        </div>

        {/* IP Whitelist Warning If TLS Alert 80 Occurs */}
        {!isConnected && (
          <div className="mx-6 mt-4 p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 text-xs">
            <div className="flex items-start space-x-3">
              <ShieldAlert className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm text-amber-900">
                    MongoDB Atlas IP Access List Action Required
                  </h4>
                  <a
                    href="https://cloud.mongodb.com"
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center space-x-1 text-indigo-600 hover:underline font-semibold"
                  >
                    <span>Open Atlas Console</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </div>
                <p className="text-amber-800">
                  MongoDB Atlas dropped the connection (<code className="bg-amber-100 px-1 py-0.5 rounded font-mono">SSL Alert 80 / TLS rejection</code>) because this cloud runtime's IP has not yet been added to Atlas Network Access.
                </p>
                <div className="bg-white/90 p-3 rounded-lg border border-amber-200 mt-2 space-y-1.5">
                  <div className="font-semibold text-slate-800">1-Minute Quick Fix in MongoDB Atlas:</div>
                  <ol className="list-decimal list-inside space-y-1 text-slate-700">
                    <li>Log in to <a href="https://cloud.mongodb.com" target="_blank" rel="noreferrer" className="text-indigo-600 underline font-medium">cloud.mongodb.com</a> and select <strong>Cluster0</strong></li>
                    <li>Click <strong>Network Access</strong> in the left sidebar (under Security)</li>
                    <li>Click <strong>Add IP Address</strong></li>
                    <li>Click <strong>Allow Access from Anywhere</strong> (<code className="font-mono font-bold text-indigo-600">0.0.0.0/0</code>) or add IP: <code className="font-mono font-bold text-indigo-600">{outboundIp}</code></li>
                    <li>Click <strong>Confirm</strong>, wait ~1 minute, then click <strong>Push All Browser &amp; Local Data</strong> below</li>
                  </ol>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="px-6 pt-3 border-b border-slate-200 flex space-x-4">
          <button
            onClick={() => setActiveTab('push')}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'push' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <UploadCloud className="w-4 h-4" />
            <span>Push Data to Mongo</span>
          </button>
          <button
            onClick={() => setActiveTab('tables')}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'tables' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Table className="w-4 h-4" />
            <span>All 17 Collections</span>
          </button>
          <button
            onClick={() => setActiveTab('connection')}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'connection' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Server className="w-4 h-4" />
            <span>Connection Diagnostics</span>
          </button>
          <button
            onClick={() => setActiveTab('atlas-guide')}
            className={`pb-2.5 text-xs font-semibold border-b-2 transition-colors cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'atlas-guide' ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Info className="w-4 h-4" />
            <span>CLI Migration</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          
          {/* TAB 1: PUSH DATA */}
          {activeTab === 'push' && (
            <div className="space-y-4">
              <div className="p-5 rounded-2xl bg-gradient-to-r from-indigo-50 to-emerald-50 border border-indigo-100 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <UploadCloud className="w-5 h-5 text-indigo-600" />
                    <h3 className="font-bold text-slate-900 text-sm">
                      Migrate &amp; Push All Browser + Application Data to MongoDB
                    </h3>
                  </div>
                  <p className="text-xs text-slate-600 max-w-xl">
                    Transfers all local browser storage (<code className="font-mono text-indigo-700">daily pricing catalog</code>, <code className="font-mono text-indigo-700">saved quotes</code>, <code className="font-mono text-indigo-700">Zoho CRM accounts</code>, <code className="font-mono text-indigo-700">leads</code>, <code className="font-mono text-indigo-700">FOB &amp; freight sheets</code>) into your MongoDB cluster.
                  </p>
                </div>

                <button
                  onClick={handlePushBrowserData}
                  disabled={pushLoading}
                  className="inline-flex items-center space-x-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all cursor-pointer text-xs shadow-md disabled:opacity-50 shrink-0"
                >
                  <UploadCloud className={`w-4 h-4 ${pushLoading ? 'animate-spin' : ''}`} />
                  <span>{pushLoading ? 'Pushing Data...' : 'Push All Data to Mongo Now'}</span>
                </button>
              </div>

              {/* Push Result Banner */}
              {pushResult && (
                <div className={`p-4 rounded-xl border ${pushResult.success ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-rose-50 border-rose-200 text-rose-900'} space-y-2 text-xs`}>
                  <div className="flex items-center space-x-2">
                    {pushResult.success ? <CheckCheck className="w-5 h-5 text-emerald-600" /> : <AlertTriangle className="w-5 h-5 text-rose-600" />}
                    <span className="font-bold text-sm">
                      {pushResult.success ? 'Migration Succeeded!' : 'Migration Failed'}
                    </span>
                  </div>
                  <p>{pushResult.message}</p>

                  {pushResult.itemsPushed && Object.keys(pushResult.itemsPushed).length > 0 && (
                    <div className="pt-2 border-t border-emerald-200/60 grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {Object.entries(pushResult.itemsPushed).map(([col, count]) => (
                        <div key={col} className="bg-white/80 p-2 rounded-lg border border-emerald-100 font-mono text-[11px]">
                          <span className="text-slate-500 block truncate">{col}</span>
                          <strong className="text-emerald-700 text-xs">{count} item(s)</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Data Sources Overview */}
              <div className="border border-slate-200 rounded-xl p-4 bg-white space-y-3">
                <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                  Datasets Included in Migration:
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="font-bold text-slate-800 block">Daily Pricing Matrix</span>
                    <span className="text-slate-500 text-[11px]">90+ Yarn Counts, 12 FOB rates, 21 Ocean freight ports</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="font-bold text-slate-800 block">Saved Quotes</span>
                    <span className="text-slate-500 text-[11px]">Calculated quotations with inputs, outputs &amp; deals</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="font-bold text-slate-800 block">Zoho CRM Accounts</span>
                    <span className="text-slate-500 text-[11px]">Customer profiles, importers &amp; contact IDs</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="font-bold text-slate-800 block">CRM Drip Leads</span>
                    <span className="text-slate-500 text-[11px]">Lead contacts, country tags &amp; stage statuses</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="font-bold text-slate-800 block">Campaign Templates</span>
                    <span className="text-slate-500 text-[11px]">Automated email &amp; WhatsApp sequence steps</span>
                  </div>
                  <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                    <span className="font-bold text-slate-800 block">System Users &amp; Audit</span>
                    <span className="text-slate-500 text-[11px]">Director, Trader, Logistics roles &amp; activity history</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ALL TABLES */}
          {activeTab === 'tables' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-600">
                <span>All 17 collections ("tables") defined for your MongoDB database:</span>
                <button
                  onClick={handleInitTables}
                  disabled={initLoading}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium cursor-pointer text-xs disabled:opacity-50"
                >
                  <Zap className={`w-3.5 h-3.5 inline mr-1 ${initLoading ? 'animate-spin' : ''}`} />
                  <span>{initLoading ? 'Creating...' : 'Create & Sync Collections'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {(initResult?.tables || statusData?.expectedTables || []).map((t: any) => (
                  <div
                    key={t.name}
                    className="p-3.5 rounded-xl border border-slate-200 bg-white hover:border-slate-300 hover:shadow-xs transition-all space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center space-x-2">
                        <div className="w-7 h-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 font-mono text-xs">
                          <Table className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <span className="font-bold text-xs text-slate-900 font-mono">{t.name}</span>
                          <p className="text-[11px] text-slate-500 leading-tight">{t.description}</p>
                        </div>
                      </div>

                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold shrink-0 ${
                        t.status === 'seeded' || t.status === 'created'
                          ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                          : t.status === 'verified'
                          ? 'bg-blue-100 text-blue-700 border border-blue-200'
                          : isConnected
                          ? 'bg-slate-100 text-slate-600'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {t.status ? t.status.toUpperCase() : isConnected ? 'READY' : 'DEFINED'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px] text-slate-500 font-mono">
                      <span>Indexes: {t.indexesCount || 1}</span>
                      {t.documentCount !== undefined && (
                        <span>Documents: <strong className="text-slate-800">{t.documentCount}</strong></span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: CONNECTION DIAGNOSTICS */}
          {activeTab === 'connection' && (
            <div className="space-y-4 text-xs">
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Connection State:</span>
                  <span className={`font-bold ${isConnected ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {isConnected ? 'ONLINE & ACTIVE' : 'AWAITING IP WHITELIST'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Target Cluster:</span>
                  <span className="text-slate-700 font-bold">cluster0.l5gdk5v.mongodb.net</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Target Database:</span>
                  <span className="text-slate-700 font-bold">{statusData?.dbName || 'lahoti_costing_db'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Server Outbound Public IP:</span>
                  <span className="text-indigo-600 font-bold">{outboundIp}</span>
                </div>
                {conn?.latencyMs !== undefined && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Ping Latency:</span>
                    <span className="text-emerald-600 font-bold">{conn.latencyMs} ms</span>
                  </div>
                )}
                {conn?.databases && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-500">Cluster Databases:</span>
                    <span className="text-slate-800">{conn.databases.join(', ')}</span>
                  </div>
                )}
              </div>

              {conn?.errorMessage && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 space-y-1">
                  <div className="font-semibold text-rose-900">Diagnostic Message:</div>
                  <pre className="font-mono text-[11px] whitespace-pre-wrap">{conn.errorMessage}</pre>
                </div>
              )}
            </div>
          )}

          {/* TAB 4: CLI SCRIPT */}
          {activeTab === 'atlas-guide' && (
            <div className="space-y-3 text-xs text-slate-700">
              <p>You can also check the connection and initialize all tables directly from your terminal or CI/CD:</p>
              <div className="p-3.5 rounded-xl bg-slate-900 text-slate-100 font-mono flex items-center justify-between">
                <span>npm run mongo:init</span>
                <button
                  onClick={() => copyToClipboard('npm run mongo:init', 'cmd')}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] cursor-pointer"
                >
                  {copiedCmd ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <p className="text-slate-500">
                This command connects with the MongoDB driver, verifies permissions, creates collections, applies unique compound indexes, and seeds all initial master data.
              </p>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
          <div className="flex items-center space-x-2 text-xs text-slate-500">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
            <span>Local file fallback store guarantees zero downtime while connecting.</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition-colors cursor-pointer shadow-xs"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
