import { GasCode, GasStatus, GasThreshold, PressureUnit } from '../types/medgas';

export const CONVERSION_FACTORS: Record<PressureUnit, number> = {
  bar: 1,
  psi: 14.50377,
  kPa: 100,
  MPa: 0.1,
};

export function convertPressure(value: number, fromUnit: PressureUnit, toUnit: PressureUnit): number {
  if (fromUnit === toUnit) return value;
  // Convert to bar first
  const inBar = value / CONVERSION_FACTORS[fromUnit];
  // Convert from bar to destination
  return inBar * CONVERSION_FACTORS[toUnit];
}

export function formatPressure(value: number, unit: PressureUnit): string {
  if (unit === 'kPa') {
    return value.toFixed(1);
  } else if (unit === 'psi') {
    return value.toFixed(1);
  } else if (unit === 'MPa') {
    return value.toFixed(3);
  }
  return value.toFixed(2);
}

export const DEFAULT_THRESHOLDS: Record<GasCode, GasThreshold> = {
  O2: {
    nominal: 4.0,
    minCrit: 3.2,
    minWarn: 3.6,
    maxWarn: 4.5,
    maxCrit: 5.0,
    unit: 'bar',
  },
  MA4: {
    nominal: 4.0,
    minCrit: 3.2,
    minWarn: 3.6,
    maxWarn: 4.5,
    maxCrit: 5.0,
    unit: 'bar',
  },
  SA7: {
    nominal: 7.0,
    minCrit: 5.8,
    minWarn: 6.3,
    maxWarn: 7.8,
    maxCrit: 8.5,
    unit: 'bar',
  },
  VAC: {
    nominal: -65.0,
    // Note: Vacuum values are negative; closer to 0 means weaker/failing vacuum!
    // So less negative than -45 kPa is Critical Low (vacuum failure)
    minCrit: -45.0,
    minWarn: -55.0,
    maxWarn: -75.0,
    maxCrit: -85.0,
    unit: 'kPa',
  },
  N2O: {
    nominal: 4.0,
    minCrit: 3.2,
    minWarn: 3.6,
    maxWarn: 4.5,
    maxCrit: 5.0,
    unit: 'bar',
  },
  CO2: {
    nominal: 4.0,
    minCrit: 3.2,
    minWarn: 3.6,
    maxWarn: 4.5,
    maxCrit: 5.0,
    unit: 'bar',
  },
};

export function evaluateGasStatus(value: number, threshold: GasThreshold, code: GasCode): GasStatus {
  if (code === 'VAC') {
    // Vacuum: less negative than minCrit means vacuum is lost (dangerous!)
    // e.g., value = -30 kPa is worse than -45 kPa
    if (value > threshold.minCrit) return 'CRIT_LOW';
    if (value > threshold.minWarn) return 'WARN_LOW';
    if (value < threshold.maxCrit) return 'CRIT_HIGH';
    if (value < threshold.maxWarn) return 'WARN_HIGH';
    return 'NORMAL';
  }

  if (value <= threshold.minCrit) return 'CRIT_LOW';
  if (value <= threshold.minWarn) return 'WARN_LOW';
  if (value >= threshold.maxCrit) return 'CRIT_HIGH';
  if (value >= threshold.maxWarn) return 'WARN_HIGH';
  return 'NORMAL';
}

export function getStatusColor(status: GasStatus): {
  text: string;
  bg: string;
  border: string;
  badge: string;
} {
  switch (status) {
    case 'CRIT_LOW':
    case 'CRIT_HIGH':
      return {
        text: 'text-rose-400',
        bg: 'bg-rose-950/40',
        border: 'border-rose-800/80',
        badge: 'bg-rose-500/20 text-rose-300 border border-rose-500/40',
      };
    case 'WARN_LOW':
    case 'WARN_HIGH':
      return {
        text: 'text-amber-400',
        bg: 'bg-amber-950/40',
        border: 'border-amber-800/80',
        badge: 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
      };
    case 'NORMAL':
    default:
      return {
        text: 'text-emerald-400',
        bg: 'bg-emerald-950/20',
        border: 'border-emerald-800/40',
        badge: 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/30',
      };
  }
}

export function getStatusLabel(status: GasStatus, lang: 'th' | 'en' = 'th'): string {
  if (lang === 'th') {
    switch (status) {
      case 'CRIT_LOW': return 'แรงดันต่ำวิกฤต';
      case 'WARN_LOW': return 'แรงดันต่ำกว่าเกณฑ์';
      case 'WARN_HIGH': return 'แรงดันสูงเกินเกณฑ์';
      case 'CRIT_HIGH': return 'แรงดันสูงวิกฤต';
      case 'NORMAL': return 'ปกติ';
    }
  }
  switch (status) {
    case 'CRIT_LOW': return 'CRITICAL LOW';
    case 'WARN_LOW': return 'WARNING LOW';
    case 'WARN_HIGH': return 'WARNING HIGH';
    case 'CRIT_HIGH': return 'CRITICAL HIGH';
    case 'NORMAL': return 'NORMAL';
  }
}
