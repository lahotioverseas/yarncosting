import { getAuthJsonHeaders } from './authData';
import {
  YarnProductSheetRecord,
  GoogleSheetFetchResult,
  FobSheetRecord,
  FobSheetFetchResult,
  FobLookupResult,
  FreightSheetRecord,
  FreightSheetFetchResult,
  FreightLookupResult,
} from '../types';
import { DEFAULT_PRICING_SNAPSHOT } from './dailyPricingSnapshot';

export const DEFAULT_MASTER_SHEET_ID = '1wHihQ-COyhDfU8fbzV5Id8oDRrBbiKvjPWvr3bBxzWE';

export const GOOGLE_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1wHihQ-COyhDfU8fbzV5Id8oDRrBbiKvjPWvr3bBxzWE/edit?gid=177573931#gid=177573931';
export const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1wHihQ-COyhDfU8fbzV5Id8oDRrBbiKvjPWvr3bBxzWE/export?format=csv&gid=177573931';

export const GOOGLE_FOB_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1wHihQ-COyhDfU8fbzV5Id8oDRrBbiKvjPWvr3bBxzWE/edit?gid=1401052388#gid=1401052388';
export const GOOGLE_FOB_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1wHihQ-COyhDfU8fbzV5Id8oDRrBbiKvjPWvr3bBxzWE/export?format=csv&gid=1401052388';

export const GOOGLE_FREIGHT_SHEET_URL = 'https://docs.google.com/spreadsheets/d/1wHihQ-COyhDfU8fbzV5Id8oDRrBbiKvjPWvr3bBxzWE/edit?gid=1549189100#gid=1549189100';
export const GOOGLE_FREIGHT_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/1wHihQ-COyhDfU8fbzV5Id8oDRrBbiKvjPWvr3bBxzWE/export?format=csv&gid=1549189100';

export function extractSheetId(rawUrl: string): string {
  if (!rawUrl) return DEFAULT_MASTER_SHEET_ID;
  const match = rawUrl.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  return match && match[1] ? match[1] : DEFAULT_MASTER_SHEET_ID;
}

export function extractGid(rawUrl: string, fallbackGid: string = ''): string {
  if (!rawUrl) return fallbackGid;
  const match = rawUrl.match(/[?&]gid=([0-9]+)/) || rawUrl.match(/#gid=([0-9]+)/);
  if (match && match[1]) {
    return match[1];
  }
  return fallbackGid;
}

/**
 * Convert any standard Google Sheet URL into direct view and export CSV URLs
 */
export function convertGoogleSheetUrlToCsvUrl(
  rawUrl: string,
  defaultGid?: string
): { viewUrl: string; csvUrl: string } {
  if (!rawUrl || typeof rawUrl !== 'string') {
    const sheetId = DEFAULT_MASTER_SHEET_ID;
    const gid = defaultGid || '177573931';
    return {
      viewUrl: `https://docs.google.com/spreadsheets/d/${sheetId}/edit${gid ? '?gid=' + gid + '#gid=' + gid : ''}`,
      csvUrl: `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv${gid ? '&gid=' + gid : ''}`,
    };
  }

  const trimmed = rawUrl.trim();
  const sheetId = extractSheetId(trimmed);
  const gid = extractGid(trimmed, defaultGid || '');

  const viewUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/edit${gid ? '?gid=' + gid + '#gid=' + gid : ''}`;
  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv${gid ? '&gid=' + gid : ''}`;
  return { viewUrl, csvUrl };
}

/**
 * Retrieve saved Google Sheet URLs from client cache or system defaults
 */
export function getSavedGoogleSheetUrls(): {
  yarnViewUrl: string;
  yarnCsvUrl: string;
  fobViewUrl: string;
  fobCsvUrl: string;
  freightViewUrl: string;
  freightCsvUrl: string;
} {
  try {
    const raw = typeof window !== 'undefined' ? localStorage.getItem('lahoti_google_sheet_urls_v1') : null;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed) {
        // If stored URL points to old sheet ID or stale GIDs, clear stale cache and return current defaults
        if (
          !parsed.freightViewUrl ||
          parsed.freightViewUrl.includes('1864133763') ||
          parsed.fobViewUrl?.includes('1600341924') ||
          parsed.yarnViewUrl?.includes('1GUYMsCk6kYNLbhIp5FtR6uXAHOr5UdLzv0OXQQ04PwM')
        ) {
          localStorage.removeItem('lahoti_google_sheet_urls_v1');
          return {
            yarnViewUrl: GOOGLE_SHEET_URL,
            yarnCsvUrl: GOOGLE_SHEET_CSV_URL,
            fobViewUrl: GOOGLE_FOB_SHEET_URL,
            fobCsvUrl: GOOGLE_FOB_SHEET_CSV_URL,
            freightViewUrl: GOOGLE_FREIGHT_SHEET_URL,
            freightCsvUrl: GOOGLE_FREIGHT_SHEET_CSV_URL,
          };
        }

        const yarn = convertGoogleSheetUrlToCsvUrl(parsed.yarnViewUrl || GOOGLE_SHEET_URL, '177573931');
        const fob = convertGoogleSheetUrlToCsvUrl(parsed.fobViewUrl || GOOGLE_FOB_SHEET_URL, '1401052388');
        const freight = convertGoogleSheetUrlToCsvUrl(parsed.freightViewUrl || GOOGLE_FREIGHT_SHEET_URL, '1549189100');

        return {
          yarnViewUrl: yarn.viewUrl,
          yarnCsvUrl: yarn.csvUrl,
          fobViewUrl: fob.viewUrl,
          fobCsvUrl: fob.csvUrl,
          freightViewUrl: freight.viewUrl,
          freightCsvUrl: freight.csvUrl,
        };
      }
    }
  } catch {}

  return {
    yarnViewUrl: GOOGLE_SHEET_URL,
    yarnCsvUrl: GOOGLE_SHEET_CSV_URL,
    fobViewUrl: GOOGLE_FOB_SHEET_URL,
    fobCsvUrl: GOOGLE_FOB_SHEET_CSV_URL,
    freightViewUrl: GOOGLE_FREIGHT_SHEET_URL,
    freightCsvUrl: GOOGLE_FREIGHT_SHEET_CSV_URL,
  };
}

/**
 * Save user custom Google Sheet URLs to localStorage and server
 */
export function saveGoogleSheetUrls(urls: {
  yarnUrl?: string;
  fobUrl?: string;
  freightUrl?: string;
}) {
  const current = getSavedGoogleSheetUrls();
  const newYarn = urls.yarnUrl ? convertGoogleSheetUrlToCsvUrl(urls.yarnUrl, '177573931') : { viewUrl: current.yarnViewUrl, csvUrl: current.yarnCsvUrl };
  const newFob = urls.fobUrl ? convertGoogleSheetUrlToCsvUrl(urls.fobUrl, '1401052388') : { viewUrl: current.fobViewUrl, csvUrl: current.fobCsvUrl };
  const newFreight = urls.freightUrl ? convertGoogleSheetUrlToCsvUrl(urls.freightUrl, '1549189100') : { viewUrl: current.freightViewUrl, csvUrl: current.freightCsvUrl };

  const updated = {
    yarnViewUrl: newYarn.viewUrl,
    yarnCsvUrl: newYarn.csvUrl,
    fobViewUrl: newFob.viewUrl,
    fobCsvUrl: newFob.csvUrl,
    freightViewUrl: newFreight.viewUrl,
    freightCsvUrl: newFreight.csvUrl,
  };

  try {
    if (typeof window !== 'undefined') {
      localStorage.setItem('lahoti_google_sheet_urls_v1', JSON.stringify(updated));
    }
  } catch {}

  fetch('/api/google-sheet/config-urls', {
    method: 'POST',
    headers: getAuthJsonHeaders(),
    body: JSON.stringify(updated),
  }).catch(() => {});

  return updated;
}

// In-memory cache for Sheet 1
let cachedResult: GoogleSheetFetchResult | null = null;
let lastFetchedTime = 0;
const CACHE_TTL_MS = 10 * 1000; // 10 seconds for real-time responsiveness with Google Sheets

// In-memory cache for Sheet 2 (FOB)
let cachedFobResult: FobSheetFetchResult | null = null;
let lastFobFetchedTime = 0;

// In-memory cache for Sheet 3 (Freight)
let cachedFreightResult: FreightSheetFetchResult | null = null;
let lastFreightFetchedTime = 0;

/**
 * Invalidate in-memory caches to force live reload
 */
export function invalidateAllSheetCaches() {
  cachedResult = null;
  lastFetchedTime = 0;
  cachedFobResult = null;
  lastFobFetchedTime = 0;
  cachedFreightResult = null;
  lastFreightFetchedTime = 0;
}


/**
 * Standard CSV Parser handling quotes, commas, and multiline cells
 */
export function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let currentField = '';

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentField += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(currentField.trim());
      currentField = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') i++;
      row.push(currentField.trim());
      if (row.some((c) => c !== '')) lines.push(row);
      row = [];
      currentField = '';
    } else {
      currentField += char;
    }
  }

  if (currentField || row.length > 0) {
    row.push(currentField.trim());
    if (row.some((c) => c !== '')) lines.push(row);
  }

  return lines;
}

/**
 * Parse Google Sheet rows into structured records
 */
export function parseGoogleSheetYarnCSV(rawCSV: string): {
  records: YarnProductSheetRecord[];
  uniqueCounts: string[];
  duplicates: Array<{ yarnCount: string; quality: string; count: number; prices: number[]; locations: string[] }>;
} {
  const rows = parseCSV(rawCSV);
  const records: YarnProductSheetRecord[] = [];

  // Check if flat table with standard headers (e.g. Yarn Count, Quality, Ex-Mill Price, Factory Location)
  let flatHeaderIdx = -1;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i].map((c) => c.toLowerCase());
    const hasCount = row.some((c) => c.includes('count') || c.includes('yarn count'));
    const hasQuality = row.some((c) => c.includes('quality'));
    const hasPrice = row.some((c) => c.includes('price') || c.includes('ex mill') || c.includes('ex-mill'));
    if (hasCount && hasQuality && hasPrice) {
      flatHeaderIdx = i;
      break;
    }
  }

  if (flatHeaderIdx !== -1) {
    // Flat columnar format
    const header = rows[flatHeaderIdx].map((c) => c.toLowerCase());
    const countCol = header.findIndex((c) => c.includes('count'));
    const qualCol = header.findIndex((c) => c.includes('quality'));
    const priceCol = header.findIndex((c) => c.includes('price') || c.includes('ex mill') || c.includes('ex-mill'));
    const locCol = header.findIndex((c) => c.includes('factory') || c.includes('location'));

    for (let i = flatHeaderIdx + 1; i < rows.length; i++) {
      const r = rows[i];
      const count = r[countCol]?.replace(/\s+/g, ' ').trim();
      const qual = r[qualCol]?.replace(/\s+/g, ' ').trim();
      const priceStr = r[priceCol]?.replace(/[^0-9.]/g, '');
      const price = priceStr ? parseFloat(priceStr) : null;
      const loc = locCol !== -1 ? r[locCol]?.replace(/\s+/g, ' ').trim() : '';

      if (count && qual) {
        const validPrice = price !== null && !isNaN(price) && price > 0 ? price : null;
        records.push({
          yarnCount: count,
          quality: qual,
          exMillPrice: validPrice,
          factoryLocation: loc || 'Factory Location not available.',
          rawRow: i + 1,
        });
      }
    }
  } else {
    // Sectioned Matrix format (e.g., KNITTING YARNS, WAEVING YARNS, DOUBLE YARNS)
    let currentCategory = 'General';
    let activeQualities: Array<{ qualityName: string; priceCol: number; locCol: number }> = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const firstCell = (row[0] || '').trim();
      const hasFactoryLocInRow = row.some(
        (c) => c.toLowerCase().includes('factory location') || c.toLowerCase().includes('location')
      );

      // Check if section header (e.g. KNITTING YARNS, WAEVING YARNS, DOUBLE YARNS)
      const filledCells = row.filter((c) => c && c.trim() !== '');
      if (
        filledCells.length === 1 &&
        !firstCell.toUpperCase().startsWith('NE') &&
        !firstCell.includes('/') &&
        !hasFactoryLocInRow
      ) {
        currentCategory = filledCells[0].replace(/\s+/g, ' ').trim();
        activeQualities = [];
        continue;
      }

      // Check if row contains Quality headers paired with 'Factory location'
      if (hasFactoryLocInRow) {
        activeQualities = [];
        for (let c = 1; c < row.length; c++) {
          const cell = row[c]?.trim();
          if (cell && !cell.toLowerCase().includes('factory') && !cell.toLowerCase().includes('location')) {
            // Quality Name found
            let locCol = -1;
            if (
              c + 1 < row.length &&
              (row[c + 1].toLowerCase().includes('factory') || row[c + 1].toLowerCase().includes('location'))
            ) {
              locCol = c + 1;
            } else if (c + 1 < row.length) {
              locCol = c + 1;
            }
            activeQualities.push({
              qualityName: cell.replace(/\s+/g, ' ').trim(),
              priceCol: c,
              locCol: locCol,
            });
          }
        }
        continue;
      }

      // Check if data row with a yarn count (e.g., 'NE 16/1', 'NE 32/1', 'NE 20/2', 'NE 90/3', '90/3')
      if (firstCell && activeQualities.length > 0) {
        const isHeaderLike = (
          firstCell.toLowerCase().includes('yarn') ||
          firstCell.toLowerCase().includes('count') ||
          firstCell.toLowerCase().includes('quality') ||
          firstCell.toLowerCase().includes('category')
        ) && !firstCell.includes('/') && !/\d/.test(firstCell);

        if (!isHeaderLike) {
          const normalizedCount = firstCell.replace(/\s+/g, ' ').trim();

          for (const qual of activeQualities) {
            const priceRaw = row[qual.priceCol]?.trim();
            const locRaw = qual.locCol !== -1 ? row[qual.locCol]?.replace(/\s+/g, ' ').trim() : '';

            const cleanPriceStr = priceRaw ? priceRaw.replace(/[^0-9.]/g, '') : '';
            const price = cleanPriceStr ? parseFloat(cleanPriceStr) : null;
            const validPrice = price !== null && !isNaN(price) && price > 0 ? price : null;

            records.push({
              yarnCount: normalizedCount,
              quality: qual.qualityName,
              category: currentCategory,
              exMillPrice: validPrice,
              factoryLocation: locRaw || (validPrice ? 'Factory Location not available.' : 'Factory Location not available.'),
              rawRow: i + 1,
            });
          }
        }
      }
    }
  }

  // Detect duplicates (same yarnCount + quality with multiple differing valid prices)
  const duplicatesMap = new Map<string, { count: number; prices: number[]; locations: string[]; yarnCount: string; quality: string }>();
  for (const r of records) {
    if (r.exMillPrice === null) continue;
    const key = `${r.yarnCount.toUpperCase()}__${r.quality.toUpperCase()}`;
    const existing = duplicatesMap.get(key);
    if (!existing) {
      duplicatesMap.set(key, {
        yarnCount: r.yarnCount,
        quality: r.quality,
        count: 1,
        prices: [r.exMillPrice],
        locations: [r.factoryLocation],
      });
    } else {
      existing.count += 1;
      if (!existing.prices.includes(r.exMillPrice)) existing.prices.push(r.exMillPrice);
      if (!existing.locations.includes(r.factoryLocation)) existing.locations.push(r.factoryLocation);
    }
  }

  const duplicates = Array.from(duplicatesMap.values()).filter((d) => d.count > 1);

  // Extract unique counts preserving natural order
  const uniqueCounts: string[] = [];
  for (const r of records) {
    if (!uniqueCounts.includes(r.yarnCount)) {
      uniqueCounts.push(r.yarnCount);
    }
  }

  return { records, uniqueCounts, duplicates };
}

/**
 * Fallback static snapshot in case Google Sheet is completely unreachable
 */
const FALLBACK_SNAPSHOT_CSV = `KNITTING YARNS,,,,,,,,,KH,Factory location ,CH,Factory location ,CCH,Factory location ,,
NE 16/1 ,270,Gujrat,,,,,,
NE 20/1,275,Gujrat,287,Gujrat,289,Gujrat,,
NE 24/1,285,Gujrat,298,Gujrat,299,Gujrat,,
NE 26/1,288,Gujrat,301,Gujrat,302,Gujrat,,
NE 28/1 ,292,Gujrat,304,Gujrat,305,Gujrat,,
NE 30/1 ,288,Gujrat,302,Gujrat,295,Gujrat,,
NE 32/1 ,301,Gujrat,,,315,Gujrat,,
NE 34/1 ,,,,,321,Gujrat,,
NE 36/1,,,,,327,Gujrat,,
NE 40/1,,,,,350,Gujrat,,
NE 50/1,,,,,400,Tamil Nadu,,,,,,,,,,
WAEVING YARNS,,,,,,,,,KW,Factory location ,KCW,Factory location ,CCW,Factory location ,,
NE 16/1 ,260,Nagpur,261,Nagpur,287,Maharastra,,
NE 20/1,270,Nagpur,273,Nagpur,290,Maharastra,,
NE 32/1 ,294,Guntur,300,Guntur,310,Maharastra,,
NE 34/1 ,,,,,316,Maharastra,,
NE 36/1,,,,,345,Maharastra,,
NE 40/1,,,,,355,Maharastra,,
NE 50/1,,,,,440,Tamil Nadu,,,,,,,,,,
DOUBLE YARNS,,,,,,,,,KW/KH SOFT TWIST,Factory location ,KW HARD TWIST,Factory location ,CH SOFT TWIST,Factory location ,CW HARD TWIST,Factory location 
NE 20/2,285,Nagpur,288,Nagpur,306,Gujrat,310,Maharastra
NE 24/2,295,Nagpur,298,Nagpur,320,Gujrat,323,Maharastra
NE 30/2,312,Nagpur,315,Nagpur,335,Gujrat,338,Maharastra
NE 32/2,315,Nagpur,318,Nagpur,342,Gujrat,343,Maharastra
NE 40/2,,,,,384,Gujrat,391,Maharastra`;

function getLocalCachedDailyPricing(): any | null {
  try {
    const raw = localStorage.getItem('lahoti_daily_pricing_cache_v1');
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {}
  return null;
}

function getDailyPricingQueryParams(): string {
  return '';
}

/**
 * Fetch Yarn products dynamically from Daily Pricing Master with resilient fallback
 */
export async function fetchGoogleSheetYarnProducts(forceRefresh = false): Promise<GoogleSheetFetchResult> {
  const now = Date.now();
  if (!forceRefresh && cachedResult && now - lastFetchedTime < CACHE_TTL_MS) {
    return cachedResult;
  }

  // 1. Primary: Fetch via Backend Daily Pricing Master
  try {
    const queryStr = getDailyPricingQueryParams();
    const queryPart = [forceRefresh ? 'refresh=true' : '', queryStr].filter(Boolean).join('&');
    const res = await fetch(`/api/google-sheet/yarn-products${queryPart ? '?' + queryPart : ''}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.records && data.records.length > 0) {
        cachedResult = data;
        lastFetchedTime = now;
        return data;
      }
    }
  } catch (err) {
    console.warn('Backend proxy fetch failed, trying local cache...', err);
  }

  // 2. Return in-memory cache if available
  if (cachedResult && cachedResult.records && cachedResult.records.length > 0) {
    return cachedResult;
  }

  // 3. Fallback to localStorage Daily Pricing Cache (to preserve user's edited prices!)
  const localCache = getLocalCachedDailyPricing();
  if (localCache && localCache.sheets && localCache.sheets.yarn && Array.isArray(localCache.sheets.yarn.rows) && localCache.sheets.yarn.rows.length > 0) {
    const yarnRows = localCache.sheets.yarn.rows;
    const records: YarnProductSheetRecord[] = yarnRows.map((r: any, idx: number) => ({
      yarnCount: String(r.yarnCount || '').trim(),
      quality: String(r.quality || '').trim(),
      category: String(r.category || 'General').trim(),
      exMillPrice: r.exMillPrice !== null && r.exMillPrice !== undefined && r.exMillPrice !== '' ? Number(r.exMillPrice) : null,
      factoryLocation: String(r.factoryLocation || 'Factory Location not available.').trim(),
      rawRow: idx + 1,
    }));
    const uniqueCounts: string[] = [];
    records.forEach((r) => {
      if (r.yarnCount && !uniqueCounts.includes(r.yarnCount)) {
        uniqueCounts.push(r.yarnCount);
      }
    });
    const result: GoogleSheetFetchResult = {
      records,
      uniqueCounts,
      duplicates: [],
      fetchedAt: new Date().toISOString(),
      sourceUrl: 'In-App Daily Pricing Master (Local Cache)',
      isFallback: false,
      dailyPricingStatus: localCache.status,
    };
    cachedResult = result;
    lastFetchedTime = now;
    return result;
  }

  // 4. Master snapshot fallback (backed by dailyPricingSnapshot.ts)
  const yarnRows = DEFAULT_PRICING_SNAPSHOT.sheets?.yarn?.rows || [];
  const records: YarnProductSheetRecord[] = yarnRows.map((r: any, idx: number) => ({
    yarnCount: String(r.yarnCount || '').trim(),
    quality: String(r.quality || '').trim(),
    category: String(r.category || 'General').trim(),
    exMillPrice: r.exMillPrice !== null && r.exMillPrice !== undefined && r.exMillPrice !== '' ? Number(r.exMillPrice) : null,
    factoryLocation: String(r.factoryLocation || 'Factory Location not available.').trim(),
    rawRow: idx + 1,
  }));
  const uniqueCounts: string[] = [];
  records.forEach((r) => {
    if (r.yarnCount && !uniqueCounts.includes(r.yarnCount)) {
      uniqueCounts.push(r.yarnCount);
    }
  });
  const fallbackResult: GoogleSheetFetchResult = {
    records,
    uniqueCounts,
    duplicates: [],
    fetchedAt: new Date().toISOString(),
    sourceUrl: 'In-App Daily Pricing Master Snapshot',
    isFallback: true,
  };
  cachedResult = fallbackResult;
  lastFetchedTime = now;
  return fallbackResult;
}

export const FALLBACK_FOB_SNAPSHOT_CSV = `Location,Price
Mundra,70000
North,125000
Maharastra,85000
Andhra,95000
TN,75000
Nagpur,125000
Pusad,125000
Biratnagar 15 tons,
Katmandu,
Biratnagar 23 tons,
Biratnagar 23 tons,
keytex,`;

/**
 * Parse Google Sheet 2 (FOB Sheet) CSV into structured records
 */
export function parseGoogleSheetFobCSV(rawCSV: string): {
  records: FobSheetRecord[];
  locations: string[];
} {
  const rows = parseCSV(rawCSV);
  const records: FobSheetRecord[] = [];
  const locations: string[] = [];

  if (rows.length === 0) {
    return { records, locations };
  }

  // Find column indexes
  let locCol = 0;
  let priceCol = 1;
  let startRow = 0;

  // Check if first row is a header
  const firstRowLower = rows[0].map((c) => c.toLowerCase());
  const locHeaderIdx = firstRowLower.findIndex((c) => c.includes('loc') || c.includes('port') || c.includes('city') || c.includes('state'));
  const priceHeaderIdx = firstRowLower.findIndex((c) => c.includes('price') || c.includes('fob') || c.includes('amount') || c.includes('cost') || c.includes('rate'));

  if (locHeaderIdx !== -1) {
    locCol = locHeaderIdx;
    if (priceHeaderIdx !== -1) priceCol = priceHeaderIdx;
    startRow = 1;
  }

  for (let i = startRow; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0) continue;
    const locRaw = r[locCol]?.replace(/\s+/g, ' ').trim();
    if (!locRaw) continue;

    const priceRaw = r[priceCol]?.trim();
    const cleanPriceStr = priceRaw ? priceRaw.replace(/[^0-9.]/g, '') : '';
    const priceNum = cleanPriceStr ? parseFloat(cleanPriceStr) : null;
    const validPrice = priceNum !== null && !isNaN(priceNum) && priceNum > 0 ? priceNum : null;

    records.push({
      location: locRaw,
      price: validPrice,
      rawRow: i + 1,
    });

    if (!locations.includes(locRaw)) {
      locations.push(locRaw);
    }
  }

  return { records, locations };
}

/**
 * Fetch Google Sheet 2 (FOB Sheet) with resilient daily pricing fallback
 */
export async function fetchGoogleSheetFobPrices(forceRefresh = false): Promise<FobSheetFetchResult> {
  const now = Date.now();
  if (!forceRefresh && cachedFobResult && now - lastFobFetchedTime < CACHE_TTL_MS) {
    return cachedFobResult;
  }

  // 1. Primary: Fetch via Backend Proxy endpoint (Daily Pricing Master)
  try {
    const queryStr = getDailyPricingQueryParams();
    const queryPart = [forceRefresh ? 'refresh=true' : '', queryStr].filter(Boolean).join('&');
    const res = await fetch(`/api/google-sheet/fob-prices${queryPart ? '?' + queryPart : ''}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.records && data.records.length > 0) {
        cachedFobResult = data;
        lastFobFetchedTime = now;
        return data;
      }
    }
  } catch (err) {
    console.warn('Backend FOB proxy fetch failed, trying local cache...', err);
  }

  // 2. Return in-memory cache if available
  if (cachedFobResult && cachedFobResult.records && cachedFobResult.records.length > 0) {
    return cachedFobResult;
  }

  // 3. Fallback to localStorage Daily Pricing Cache (to preserve user's edited FOB prices!)
  const localCache = getLocalCachedDailyPricing();
  if (localCache && localCache.sheets && localCache.sheets.fob && Array.isArray(localCache.sheets.fob.rows) && localCache.sheets.fob.rows.length > 0) {
    const fobRows = localCache.sheets.fob.rows;
    const records: FobSheetRecord[] = fobRows.map((r: any, idx: number) => ({
      location: String(r.location || '').trim(),
      price: r.price !== null && r.price !== undefined && r.price !== '' ? Number(r.price) : null,
      notes: r.notes ? String(r.notes).trim() : undefined,
      rawRow: idx + 1,
    }));
    const locations: string[] = [];
    records.forEach((r) => {
      if (r.location && !locations.includes(r.location)) {
        locations.push(r.location);
      }
    });
    const result: FobSheetFetchResult = {
      records,
      locations,
      fetchedAt: new Date().toISOString(),
      sourceUrl: 'In-App Daily Pricing Master (Local Cache)',
      isFallback: false,
    };
    cachedFobResult = result;
    lastFobFetchedTime = now;
    return result;
  }

  // 4. Master snapshot fallback (backed by dailyPricingSnapshot.ts)
  const fobRows = DEFAULT_PRICING_SNAPSHOT.sheets?.fob?.rows || [];
  const records: FobSheetRecord[] = fobRows.map((r: any, idx: number) => ({
    location: String(r.location || '').trim(),
    price: r.price !== null && r.price !== undefined && r.price !== '' ? Number(r.price) : null,
    rawRow: idx + 1,
  }));
  const locations: string[] = [];
  records.forEach((r) => {
    if (r.location && !locations.includes(r.location)) {
      locations.push(r.location);
    }
  });
  const fallbackResult: FobSheetFetchResult = {
    records,
    locations,
    fetchedAt: new Date().toISOString(),
    sourceUrl: 'In-App Daily Pricing Master Snapshot',
    isFallback: true,
  };
  cachedFobResult = fallbackResult;
  lastFobFetchedTime = now;
  return fallbackResult;
}

/**
 * Standard Geographical / Trade Synonyms for Factory Location -> FOB Location
 */
const LOCATION_SYNONYMS: Record<string, string[]> = {
  'MUNDRA': ['GUJRAT', 'GUJARAT', 'MUNDRA', 'KANDLA', 'PIPAVAV', 'MUNDRA PORT'],
  'GUJRAT': ['MUNDRA', 'GUJRAT', 'GUJARAT', 'KANDLA', 'PIPAVAV'],
  'GUJARAT': ['MUNDRA', 'GUJRAT', 'GUJARAT', 'KANDLA', 'PIPAVAV'],
  'TN': ['TAMIL NADU', 'TAMILNADU', 'TN', 'COIMBATORE', 'TUTICORIN', 'CHENNAI'],
  'TAMIL NADU': ['TN', 'TAMIL NADU', 'TAMILNADU', 'COIMBATORE', 'TUTICORIN', 'CHENNAI'],
  'ANDHRA': ['GUNTUR', 'ANDHRA', 'ANDHRA PRADESH', 'AP', 'HYDERABAD', 'VIJAYAWADA'],
  'GUNTUR': ['ANDHRA', 'GUNTUR', 'ANDHRA PRADESH', 'AP'],
  'MAHARASTRA': ['MAHARASHTRA', 'MAHARASTRA', 'MUMBAI', 'NHAVA SHEVA', 'JNPT', 'SOLAPUR', 'ICHALKARANJI'],
  'MAHARASHTRA': ['MAHARASTRA', 'MAHARASHTRA', 'MUMBAI', 'NHAVA SHEVA', 'JNPT', 'SOLAPUR', 'ICHALKARANJI'],
  'NAGPUR': ['NAGPUR', 'NAGPUR RURAL', 'BUTIBORI'],
  'PUSAD': ['PUSAD', 'YAVATMAL'],
  'NORTH': ['NORTH', 'NORTH INDIA', 'PUNJAB', 'HARYANA', 'LUDHIANA'],
};

/**
 * Find matching FOB record and amount from Sheet 2 using Factory Location from Sheet 1
 */
export function findFobForFactoryLocation(
  factoryLocation: string | null | undefined,
  fobRecords: FobSheetRecord[]
): FobLookupResult {
  if (!factoryLocation || factoryLocation === 'Factory Location not available.' || factoryLocation.trim() === '') {
    return {
      record: null,
      status: 'NO_LOCATION',
      matchedLocation: null,
      fobAmount: null,
      message: 'Select a Yarn Count and Quality to determine Factory Location.',
    };
  }

  const clean = factoryLocation.replace(/\s+/g, ' ').trim();
  const upper = clean.toUpperCase();

  // 1. Direct exact normalized match (case-insensitive, trimmed)
  const directMatch = fobRecords.find(
    (r) => r.location.replace(/\s+/g, ' ').trim().toUpperCase() === upper
  );

  if (directMatch) {
    if (directMatch.price === null || isNaN(directMatch.price) || directMatch.price <= 0) {
      return {
        record: directMatch,
        status: 'MISSING_PRICE',
        matchedLocation: directMatch.location,
        fobAmount: null,
        message: `FOB price is not available for ${directMatch.location}.`,
      };
    }
    return {
      record: directMatch,
      status: 'FOUND',
      matchedLocation: directMatch.location,
      fobAmount: directMatch.price,
      message: null,
    };
  }

  // 2. Standard geographic / trade synonym match
  const synonyms = LOCATION_SYNONYMS[upper] || [];
  for (const syn of synonyms) {
    const synMatch = fobRecords.find(
      (r) => r.location.replace(/\s+/g, ' ').trim().toUpperCase() === syn
    );
    if (synMatch) {
      if (synMatch.price === null || isNaN(synMatch.price) || synMatch.price <= 0) {
        return {
          record: synMatch,
          status: 'MISSING_PRICE',
          matchedLocation: synMatch.location,
          fobAmount: null,
          message: `FOB price is not available for ${synMatch.location}.`,
        };
      }
      return {
        record: synMatch,
        status: 'FOUND',
        matchedLocation: synMatch.location,
        fobAmount: synMatch.price,
        message: null,
      };
    }
  }

  // 3. Not found in Sheet 2
  return {
    record: null,
    status: 'NOT_FOUND',
    matchedLocation: null,
    fobAmount: null,
    message: `FOB price not found for factory location: ${clean}`,
  };
}

/**
 * Autocomplete search for yarn count strings
 */
export function searchYarnCounts(query: string, availableCounts: string[]): string[] {
  const q = query.trim().toUpperCase();
  if (!q) return availableCounts;
  
  // Filter matching counts
  return availableCounts.filter((count) => {
    const cleanCount = count.toUpperCase();
    return cleanCount.includes(q) || cleanCount.replace(/\s+/g, '').includes(q.replace(/\s+/g, ''));
  });
}

/**
 * Get all available Qualities for a given Yarn Count from loaded records
 */
export function getQualitiesForCount(yarnCount: string, records: YarnProductSheetRecord[]): YarnProductSheetRecord[] {
  if (!yarnCount) return [];
  const normalizedTarget = yarnCount.trim().toUpperCase();
  
  const matching = records.filter(
    (r) => r.yarnCount.trim().toUpperCase() === normalizedTarget
  );

  // Return unique qualities (in case of multiple rows)
  const seenQualities = new Set<string>();
  const uniqueQualities: YarnProductSheetRecord[] = [];
  
  for (const r of matching) {
    const qKey = r.quality.trim().toUpperCase();
    if (!seenQualities.has(qKey)) {
      seenQualities.add(qKey);
      uniqueQualities.push(r);
    }
  }

  return uniqueQualities;
}

/**
 * Find exact matching row for Yarn Count + Quality from the SAME row
 */
export function findMatchingRow(
  yarnCount: string,
  quality: string,
  records: YarnProductSheetRecord[]
): YarnProductSheetRecord | null {
  if (!yarnCount || !quality) return null;
  const countNorm = yarnCount.trim().toUpperCase();
  const qualNorm = quality.trim().toUpperCase();

  const match = records.find(
    (r) => r.yarnCount.trim().toUpperCase() === countNorm && r.quality.trim().toUpperCase() === qualNorm
  );

  return match || null;
}

export const FALLBACK_FREIGHT_SNAPSHOT_CSV = `FREIGHT,
Destination Port,AMOUNT
AI Sokhna,3600
Buenaventura,
Callao,
Casablanca,
Cat Lai,
Chittagong,
Colombo,
EL DEKHILA /Ale,
Gdynia,
Hamburg,
Istanbul,
Lazaro Cardenas,
Lexious,
Port Louis,
Psair Gudang,
Puerto quetzal,
Qingdao/SH,
Tunis,
Wuhu,`;

/**
 * Parse Google Sheet 3 (Freight Rates Sheet) CSV into structured records
 */
export function parseGoogleSheetFreightCSV(rawCSV: string): {
  records: FreightSheetRecord[];
  destinations: string[];
} {
  const rows = parseCSV(rawCSV);
  const records: FreightSheetRecord[] = [];
  const destinations: string[] = [];

  if (rows.length === 0) {
    return { records, destinations };
  }

  let destCol = 0;
  let amountCol = 1;
  let startRow = 0;

  // Find header row containing "Destination", "Port", "POD" and "Amount", "Price", "Rate", "Freight", "Cost", "USD"
  for (let i = 0; i < Math.min(rows.length, 6); i++) {
    const rowLower = rows[i].map((c) => c.toLowerCase().trim());
    const destIdx = rowLower.findIndex((c) =>
      c.includes('destination') || c.includes('port') || c.includes('dest') || c.includes('pod') || c.includes('discharge')
    );
    const amtIdx = rowLower.findIndex((c) =>
      c.includes('amount') || c.includes('rate') || c.includes('price') || c.includes('cost') || c.includes('freight') || c.includes('usd') || c.includes('fcl')
    );

    if (destIdx !== -1) {
      destCol = destIdx;
      if (amtIdx !== -1 && amtIdx !== destIdx) {
        amountCol = amtIdx;
      } else {
        amountCol = destIdx + 1;
      }
      startRow = i + 1;
      break;
    }
  }

  for (let i = startRow; i < rows.length; i++) {
    const r = rows[i];
    if (!r || r.length === 0) continue;

    const destRaw = r[destCol]?.replace(/\s+/g, ' ').trim();
    if (!destRaw) continue;

    const destLower = destRaw.toLowerCase();
    // Skip non-data header labels
    if (
      destLower === 'destination port' ||
      destLower === 'destination' ||
      destLower === 'port' ||
      destLower === 'freight' ||
      destLower === 'ocean freight' ||
      destLower === 'port of discharge'
    ) {
      continue;
    }

    const amountRaw = r[amountCol]?.trim();
    const cleanAmountStr = amountRaw ? amountRaw.replace(/[^0-9.]/g, '') : '';
    const amountNum = cleanAmountStr ? parseFloat(cleanAmountStr) : null;
    const validAmount = amountNum !== null && !isNaN(amountNum) && amountNum > 0 ? amountNum : null;

    records.push({
      destination: destRaw,
      amount: validAmount,
      rawRow: i + 1,
    });

    if (!destinations.some((d) => d.trim().toUpperCase() === destRaw.toUpperCase())) {
      destinations.push(destRaw);
    }
  }

  return { records, destinations };
}

/**
 * Fetch Google Sheet 3 (Freight Rates Sheet) with resilient daily pricing fallback
 */
export async function fetchGoogleSheetFreightRates(forceRefresh = false): Promise<FreightSheetFetchResult> {
  const now = Date.now();
  if (!forceRefresh && cachedFreightResult && now - lastFreightFetchedTime < CACHE_TTL_MS) {
    return cachedFreightResult;
  }

  // 1. Primary: Fetch via Backend Proxy endpoint (Daily Pricing Master)
  try {
    const queryStr = getDailyPricingQueryParams();
    const queryPart = [forceRefresh ? 'refresh=true' : '', queryStr].filter(Boolean).join('&');
    const res = await fetch(`/api/google-sheet/freight-rates${queryPart ? '?' + queryPart : ''}`);
    if (res.ok) {
      const data = await res.json();
      if (data && data.records && data.records.length > 0) {
        cachedFreightResult = data;
        lastFreightFetchedTime = now;
        return data;
      }
    }
  } catch (err) {
    console.warn('Backend Freight proxy fetch failed, trying local cache...', err);
  }

  // 2. Return in-memory cache if available
  if (cachedFreightResult && cachedFreightResult.records && cachedFreightResult.records.length > 0) {
    return cachedFreightResult;
  }

  // 3. Fallback to localStorage Daily Pricing Cache (to preserve user's edited freight rates!)
  const localCache = getLocalCachedDailyPricing();
  if (localCache && localCache.sheets && localCache.sheets.freight && Array.isArray(localCache.sheets.freight.rows) && localCache.sheets.freight.rows.length > 0) {
    const freightRows = localCache.sheets.freight.rows;
    const records: FreightSheetRecord[] = freightRows.map((r: any, idx: number) => ({
      destination: String(r.destination || '').trim(),
      amount: r.amount !== null && r.amount !== undefined && r.amount !== '' ? Number(r.amount) : null,
      rawRow: idx + 1,
    }));
    const destinations: string[] = [];
    records.forEach((r) => {
      if (r.destination && !destinations.includes(r.destination)) {
        destinations.push(r.destination);
      }
    });
    const result: FreightSheetFetchResult = {
      records,
      destinations,
      fetchedAt: new Date().toISOString(),
      sourceUrl: 'In-App Daily Pricing Master (Local Cache)',
      isFallback: false,
    };
    cachedFreightResult = result;
    lastFreightFetchedTime = now;
    return result;
  }

  // 4. Master snapshot fallback (backed by dailyPricingSnapshot.ts)
  const freightRows = DEFAULT_PRICING_SNAPSHOT.sheets?.freight?.rows || [];
  const records: FreightSheetRecord[] = freightRows.map((r: any, idx: number) => ({
    destination: String(r.destination || '').trim(),
    amount: r.amount !== null && r.amount !== undefined && r.amount !== '' ? Number(r.amount) : null,
    rawRow: idx + 1,
  }));
  const destinations: string[] = [];
  records.forEach((r) => {
    if (r.destination && !destinations.includes(r.destination)) {
      destinations.push(r.destination);
    }
  });
  const fallbackResult: FreightSheetFetchResult = {
    records,
    destinations,
    fetchedAt: new Date().toISOString(),
    sourceUrl: 'In-App Daily Pricing Master Snapshot',
    isFallback: true,
  };
  cachedFreightResult = fallbackResult;
  lastFreightFetchedTime = now;
  return fallbackResult;
}

/**
 * Standard Port / Destination Synonyms for Freight lookups
 */
const DESTINATION_SYNONYMS: Record<string, string[]> = {
  'AI SOKHNA': ['AL SOKHNA', 'AI SOKHNA', 'SOKHNA', 'AIN SOKHNA', 'EL SOKHNA'],
  'AL SOKHNA': ['AI SOKHNA', 'AL SOKHNA', 'SOKHNA', 'AIN SOKHNA', 'EL SOKHNA'],
  'CAT LAI': ['CAT LAI', 'CAT LAI, VIETNAM', 'HO CHI MINH', 'HO CHI MINH CITY', 'VIETNAM'],
  'EL DEKHILA /ALE': ['EL DEKHILA /ALE', 'EL DEKHILA', 'ALEXANDRIA', 'EL DEKHEILA', 'ALE'],
  'QINGDAO/SH': ['QINGDAO/SH', 'QINGDAO', 'SHANGHAI', 'QINGDAO / SHANGHAI'],
  'PSAIR GUDANG': ['PSAIR GUDANG', 'PASIR GUDANG', 'PASIR GUDANG, MALAYSIA'],
  'PASIR GUDANG': ['PSAIR GUDANG', 'PASIR GUDANG', 'PASIR GUDANG, MALAYSIA'],
  'PUERTO QUETZAL': ['PUERTO QUETZAL', 'GUATEMALA', 'QUETZAL'],
  'LEXIOUS': ['LEXIOUS', 'LEIXOES', 'LEIXÕES'],
  'GDYNIA': ['GDYNIA', 'POLAND'],
  'HAMBURG': ['HAMBURG', 'GERMANY'],
  'ISTANBUL': ['ISTANBUL', 'TURKEY'],
  'BUENAVENTURA': ['BUENAVENTURA', 'COLOMBIA'],
  'CALLAO': ['CALLAO', 'PERU', 'LIMA'],
  'CASABLANCA': ['CASABLANCA', 'MOROCCO'],
  'CHITTAGONG': ['CHITTAGONG', 'BANGLADESH', 'CHATTOGRAM'],
  'COLOMBO': ['COLOMBO', 'SRI LANKA'],
  'LAZARO CARDENAS': ['LAZARO CARDENAS', 'MEXICO', 'LAZARO'],
  'PORT LOUIS': ['PORT LOUIS', 'MAURITIUS'],
  'TUNIS': ['TUNIS', 'TUNISIA'],
  'WUHU': ['WUHU', 'CHINA'],
};

/**
 * Find matching Freight record and rate for a selected Destination Port
 */
export function findFreightForDestination(
  destination: string | null | undefined,
  freightRecords: FreightSheetRecord[],
  surcharge = 25
): FreightLookupResult {
  if (!destination || destination.trim() === '') {
    return {
      record: null,
      status: 'NO_DESTINATION',
      matchedDestination: null,
      baseAmountUsd: null,
      surcharge,
      selectedFreightUsd: null,
      message: 'Select a Destination Port to retrieve ocean freight rate.',
    };
  }

  const clean = destination.replace(/\s+/g, ' ').trim();
  const upper = clean.toUpperCase();

  // 1. Direct exact match (case-insensitive)
  const directMatch = freightRecords.find(
    (r) => r.destination.replace(/\s+/g, ' ').trim().toUpperCase() === upper
  );

  if (directMatch) {
    if (directMatch.amount === null || isNaN(directMatch.amount) || directMatch.amount <= 0) {
      return {
        record: directMatch,
        status: 'MISSING_PRICE',
        matchedDestination: directMatch.destination,
        baseAmountUsd: null,
        surcharge,
        selectedFreightUsd: null,
        message: `Freight rate is not specified in Google Sheet for ${directMatch.destination}.`,
      };
    }
    return {
      record: directMatch,
      status: 'FOUND',
      matchedDestination: directMatch.destination,
      baseAmountUsd: directMatch.amount,
      surcharge,
      selectedFreightUsd: directMatch.amount + surcharge,
      message: null,
    };
  }

  // 2. Destination Synonyms lookup
  const synonyms = DESTINATION_SYNONYMS[upper] || [];
  for (const syn of synonyms) {
    const synMatch = freightRecords.find(
      (r) => r.destination.replace(/\s+/g, ' ').trim().toUpperCase() === syn
    );
    if (synMatch) {
      if (synMatch.amount === null || isNaN(synMatch.amount) || synMatch.amount <= 0) {
        return {
          record: synMatch,
          status: 'MISSING_PRICE',
          matchedDestination: synMatch.destination,
          baseAmountUsd: null,
          surcharge,
          selectedFreightUsd: null,
          message: `Freight rate is not specified in Google Sheet for ${synMatch.destination}.`,
        };
      }
      return {
        record: synMatch,
        status: 'FOUND',
        matchedDestination: synMatch.destination,
        baseAmountUsd: synMatch.amount,
        surcharge,
        selectedFreightUsd: synMatch.amount + surcharge,
        message: null,
      };
    }
  }

  // 3. Substring matching (e.g. "Sokhna" matches "AI Sokhna")
  const partialMatch = freightRecords.find((r) => {
    const rUpper = r.destination.replace(/\s+/g, ' ').trim().toUpperCase();
    return rUpper.includes(upper) || upper.includes(rUpper);
  });

  if (partialMatch) {
    if (partialMatch.amount === null || isNaN(partialMatch.amount) || partialMatch.amount <= 0) {
      return {
        record: partialMatch,
        status: 'MISSING_PRICE',
        matchedDestination: partialMatch.destination,
        baseAmountUsd: null,
        surcharge,
        selectedFreightUsd: null,
        message: `Freight rate is not specified in Google Sheet for ${partialMatch.destination}.`,
      };
    }
    return {
      record: partialMatch,
      status: 'FOUND',
      matchedDestination: partialMatch.destination,
      baseAmountUsd: partialMatch.amount,
      surcharge,
      selectedFreightUsd: partialMatch.amount + surcharge,
      message: null,
    };
  }

  // 4. Not found in Freight Sheet
  return {
    record: null,
    status: 'NOT_FOUND',
    matchedDestination: null,
    baseAmountUsd: null,
    surcharge,
    selectedFreightUsd: null,
    message: `Destination port '${clean}' not found in Freight Google Sheet.`,
  };
}

/**
 * Add a new destination port to the live dataset & server store
 */
export async function addNewDestinationPort(destination: string, amount?: number): Promise<FreightSheetFetchResult> {
  const clean = destination.trim();
  invalidateAllSheetCaches();
  const res = await fetch('/api/google-sheet/add-destination', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ destination: clean, amount }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to add destination port');
  }
  return fetchGoogleSheetFreightRates(true);
}

/**
 * Add a new FOB location to the live dataset & server store
 */
export async function addNewFobLocation(location: string, price?: number): Promise<FobSheetFetchResult> {
  const clean = location.trim();
  invalidateAllSheetCaches();
  const res = await fetch('/api/google-sheet/add-fob-location', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ location: clean, price }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to add FOB location');
  }
  return fetchGoogleSheetFobPrices(true);
}

/**
 * Add a new Yarn Product to the live dataset & server store
 */
export async function addNewYarnProduct(
  yarnCount: string,
  quality: string,
  exMillPrice?: number,
  factoryLocation?: string,
  category?: string
): Promise<GoogleSheetFetchResult> {
  invalidateAllSheetCaches();
  const res = await fetch('/api/google-sheet/add-yarn-product', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      yarnCount: yarnCount.trim(),
      quality: quality.trim(),
      exMillPrice,
      factoryLocation: factoryLocation?.trim(),
      category: category?.trim(),
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to add Yarn product');
  }
  return fetchGoogleSheetYarnProducts(true);
}

