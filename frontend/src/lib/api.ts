import {
  handleGetProducts,
  handleGetFreightOrigins,
  handleGetFreightDestinations,
  handleGetFreightRate,
  handleGetFobLocations,
  handleGetQuantityOptions,
  handleGetMarginTerms,
  handleGetExchangeRates,
  handleCalculateCosting,
  handleSaveCosting,
  handleReplayCosting,
} from './rpcHandlers';
import { calculateCottonYarnCostingPLpgSQL } from './plpgsqlEngine';

// Isomorphic local fallback for RPC operations if backend returns non-JSON or during connection transitions
function executeLocalRpcFallback<T = any>(functionName: string, params: Record<string, any>): { data: T | null; error: any } {
  try {
    if (functionName === 'calculate_costing') {
      try {
        const rawCache = localStorage.getItem('lahoti_daily_pricing_cache_v1');
        if (rawCache) {
          const parsed = JSON.parse(rawCache);
          if (parsed?.status && parsed.status.isConfirmedForToday === false) {
            return {
              data: null,
              error: new Error('Prices are locked at 00:00 AM IST. Admin must confirm today\'s prices or keep yesterday\'s prices before calculations can be run.')
            };
          }
        }
      } catch {}
      const result = handleCalculateCosting(params);
      return { data: result as T, error: null };
    }
    if (functionName === 'calculate_cotton_yarn_costing') {
      const payload = params.p_input || params;
      const result = calculateCottonYarnCostingPLpgSQL(payload);
      return { data: result as T, error: null };
    }
    if (functionName === 'get_quantity_options') {
      return { data: handleGetQuantityOptions(params.p_product_code) as T, error: null };
    }
    if (functionName === 'get_margin_terms') {
      return { data: handleGetMarginTerms(params.p_product_code) as T, error: null };
    }
    if (functionName === 'get_freight_origins') {
      return { data: handleGetFreightOrigins(params.p_product_code) as T, error: null };
    }
    if (functionName === 'get_freight_destinations') {
      return { data: handleGetFreightDestinations(params.p_product_code, params.p_origin) as T, error: null };
    }
    if (functionName === 'get_freight_rate') {
      return { data: handleGetFreightRate(params.p_product_code, params.p_origin, params.p_destination) as T, error: null };
    }
    if (functionName === 'get_fob_locations') {
      return { data: handleGetFobLocations(params.p_product_code) as T, error: null };
    }
    if (functionName === 'get_products') {
      return { data: handleGetProducts() as T, error: null };
    }
    if (functionName === 'get_exchange_rates') {
      return { data: handleGetExchangeRates(params.p_date) as T, error: null };
    }
    if (functionName === 'save_costing') {
      return { data: handleSaveCosting(params.p_inputs, params.p_outputs) as T, error: null };
    }
    if (functionName === 'replay_costing') {
      return { data: handleReplayCosting(params.p_reference_no) as T, error: null };
    }
  } catch (err: any) {
    console.warn(`Local RPC fallback error for ${functionName}:`, err);
    return { data: null, error: err };
  }

  return { data: null, error: new Error(`No local RPC handler available for ${functionName}`) };
}

// RPC client for the FastAPI backend (/api/rpc/<name>), returns { data, error }
export async function callRpc<T = any>(functionName: string, params: Record<string, any> = {}): Promise<{ data: T | null; error: any }> {
  // Primary: Server RPC Proxy Endpoint
  try {
    const response = await fetch(`/api/rpc/${functionName}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    const rawText = await response.text();

    // Check if response is non-JSON or HTML (e.g. from Vite SPA fallback or server reload)
    if (!rawText || rawText.trim().startsWith('<')) {
      // Gracefully recover using local isomorphic RPC engine
      const localResult = executeLocalRpcFallback<T>(functionName, params);
      if (!localResult.error) {
        return localResult;
      }
      return {
        data: null,
        error: new Error(`RPC call ${functionName} returned non-JSON response (HTTP ${response.status})`),
      };
    }

    let json: any;
    try {
      json = JSON.parse(rawText);
    } catch (e) {
      const localResult = executeLocalRpcFallback<T>(functionName, params);
      if (!localResult.error) {
        return localResult;
      }
      return { data: null, error: new Error(`Invalid JSON response from ${functionName}`) };
    }

    if (json.error) {
      return { data: null, error: new Error(typeof json.error === 'string' ? json.error : JSON.stringify(json.error)) };
    }

    return { data: (json.data !== undefined ? json.data : json) as T, error: null };
  } catch (err: any) {
    // If network or server error occurs, attempt seamless local RPC execution
    const localResult = executeLocalRpcFallback<T>(functionName, params);
    if (!localResult.error) {
      return localResult;
    }
    return { data: null, error: err };
  }
}

export const api = {
  rpc: callRpc,
};

