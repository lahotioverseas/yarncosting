export function formatINR(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '₹0.00';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
}

export function formatUSD(val: number | null | undefined, decimals = 2): string {
  if (val === null || val === undefined || isNaN(val)) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(val);
}

export function formatEUR(val: number | null | undefined, decimals = 2): string {
  if (val === null || val === undefined || isNaN(val)) return '€ —';
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(val);
}

export function formatDecimal4(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '—';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
}

export function formatFclAmount(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '0';
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: 0,
  }).format(val);
}

export function formatCurrencyByCode(val: number | null | undefined, code: string, decimals = 2): string {
  if (code === 'EUR') return formatEUR(val, decimals);
  return formatUSD(val, decimals);
}

export function formatPercent(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '0%';
  return `${val}%`;
}

export function formatWeight(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '0 kg';
  return `${new Intl.NumberFormat('en-US').format(val)} kg`;
}

export function formatDate(isoString: string): string {
  if (!isoString) return '';
  return new Date(isoString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

