import { AlarmEvent, ConnectionConfig, GasChannel, GasCode, GasThreshold, HistoricalReading, NtfyConfig, PressureUnit, RelayItem } from '../types/medgas';
import { DEFAULT_GAS_CHANNELS } from '../utils/defaults';
import { DEFAULT_THRESHOLDS } from '../utils/units';
import { DEFAULT_NTFY_CONFIG } from './ntfy';

const STORAGE_KEYS = {
  THRESHOLDS: 'medgas_thresholds_v3',
  CONNECTION: 'medgas_connection_v3',
  NTFY: 'medgas_ntfy_v3',
  HISTORY: 'medgas_history_v3',
  ALARMS: 'medgas_alarms_v3',
  ACTIVE_UNIT: 'medgas_unit_v3',
};

export function loadStoredThresholds(): Record<GasCode, GasThreshold> {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.THRESHOLDS);
    if (raw) {
      return { ...DEFAULT_THRESHOLDS, ...JSON.parse(raw) };
    }
  } catch (e) {
    console.error('Failed to load thresholds', e);
  }
  return DEFAULT_THRESHOLDS;
}

export function saveStoredThresholds(thresholds: Record<GasCode, GasThreshold>) {
  try {
    localStorage.setItem(STORAGE_KEYS.THRESHOLDS, JSON.stringify(thresholds));
  } catch (e) {
    console.error('Failed to save thresholds', e);
  }
}

export function loadStoredConnection(): ConnectionConfig {
  const def: ConnectionConfig = {
    mode: 'SIMULATOR', // Default to interactive simulator so users can test immediately!
    targetUrl: 'http://192.168.4.1', // Default ESP32-C3 AP address
    pollIntervalMs: 2500,
    timeoutMs: 4000,
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CONNECTION);
    if (raw) return { ...def, ...JSON.parse(raw) };
  } catch (e) {}
  return def;
}

export function saveStoredConnection(config: ConnectionConfig) {
  try {
    localStorage.setItem(STORAGE_KEYS.CONNECTION, JSON.stringify(config));
  } catch (e) {}
}

export function loadStoredNtfy(): NtfyConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.NTFY);
    if (raw) return { ...DEFAULT_NTFY_CONFIG, ...JSON.parse(raw) };
  } catch (e) {}
  return DEFAULT_NTFY_CONFIG;
}

export function saveStoredNtfy(config: NtfyConfig) {
  try {
    localStorage.setItem(STORAGE_KEYS.NTFY, JSON.stringify(config));
  } catch (e) {}
}

export function loadStoredHistory(): HistoricalReading[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.HISTORY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [];
}

export function saveStoredHistory(history: HistoricalReading[]) {
  try {
    // Limit to latest 1500 records to prevent LocalStorage quota overflow
    const trimmed = history.slice(-1500);
    localStorage.setItem(STORAGE_KEYS.HISTORY, JSON.stringify(trimmed));
  } catch (e) {}
}

export function loadStoredAlarms(): AlarmEvent[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.ALARMS);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [];
}

export function saveStoredAlarms(alarms: AlarmEvent[]) {
  try {
    const trimmed = alarms.slice(-200);
    localStorage.setItem(STORAGE_KEYS.ALARMS, JSON.stringify(trimmed));
  } catch (e) {}
}

export function loadActiveUnit(): PressureUnit {
  try {
    const unit = localStorage.getItem(STORAGE_KEYS.ACTIVE_UNIT) as PressureUnit;
    if (['bar', 'psi', 'kPa', 'MPa'].includes(unit)) return unit;
  } catch (e) {}
  return 'bar';
}

export function saveActiveUnit(unit: PressureUnit) {
  try {
    localStorage.setItem(STORAGE_KEYS.ACTIVE_UNIT, unit);
  } catch (e) {}
}

// Generate CSV string with UTF-8 BOM
export function generateMedicalGasCsv(
  history: HistoricalReading[],
  gases: GasChannel[],
  relays: RelayItem[],
  options?: {
    startDate?: number;
    endDate?: number;
    gasFilter?: GasCode | 'ALL';
    stationName?: string;
  }
): string {
  const stationName = options?.stationName || 'Hospital Medgas Master v3.1 (ESP32-C3)';
  const nowStr = new Date().toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });

  // Filter history
  let filtered = [...history];
  if (options?.startDate) {
    filtered = filtered.filter(h => h.timestamp >= options.startDate!);
  }
  if (options?.endDate) {
    filtered = filtered.filter(h => h.timestamp <= options.endDate!);
  }
  if (options?.gasFilter && options.gasFilter !== 'ALL') {
    filtered = filtered.filter(h => h.gasCode === options.gasFilter);
  }

  // Calculate statistics per gas
  const gasStats: Record<string, { count: number; sum: number; min: number; max: number }> = {};
  filtered.forEach(item => {
    if (!gasStats[item.gasCode]) {
      gasStats[item.gasCode] = { count: 0, sum: 0, min: item.value, max: item.value };
    }
    const stat = gasStats[item.gasCode];
    stat.count++;
    stat.sum += item.value;
    stat.min = Math.min(stat.min, item.value);
    stat.max = Math.max(stat.max, item.value);
  });

  const lines: string[] = [];

  // Metadata Header
  lines.push(`"MEDGAS MASTER v3.1 - MEDICAL GAS MONITORING REPORT"`);
  lines.push(`"Station Name / สถานีตรวจวัด","${stationName}"`);
  lines.push(`"Report Generated At / วันที่ออกรายงาน","${nowStr}"`);
  lines.push(`"Standard Compliance / มาตรฐาน","ISO 7396-1 / HTM 02-01 / กองแบบแผน สธ."`);
  lines.push(`"Total Logged Records / จำนวนบันทึกทั้งหมด",${filtered.length}`);
  lines.push(``);

  // Gas Statistics Summary Table
  lines.push(`"--- SUMMARY STATISTICS / สรุปภาพรวมสถิติ ---"`);
  lines.push(`"Gas Code","Gas Name (EN)","Gas Name (TH)","Data Points","Average Value","Min Measured","Max Measured","Unit","Status Spec"`);
  DEFAULT_GAS_CHANNELS.forEach(gas => {
    const s = gasStats[gas.code];
    if (s && s.count > 0) {
      const avg = (s.sum / s.count).toFixed(2);
      lines.push(
        `"${gas.code}","${gas.nameEn}","${gas.nameTh}",${s.count},${avg},${s.min.toFixed(2)},${s.max.toFixed(2)},"${gas.unit}","Nominal ${gas.threshold.nominal} ${gas.unit}"`
      );
    }
  });
  lines.push(``);

  // Relay Configuration
  lines.push(`"--- RELAY BANK MAPPING / ตารางคอนฟิกควบคุมรีเลย์ (Y1-Y6) ---"`);
  lines.push(`"Relay ID","GPIO Pin","Name","Function (TH)","Current State"`);
  relays.forEach(r => {
    lines.push(`"${r.name}","GPIO${r.pin}","${r.labelEn}","${r.labelTh}","${r.state ? 'ON' : 'OFF'}"`);
  });
  lines.push(``);

  // Detailed Log Records Table
  lines.push(`"--- DETAILED TELEMETRY LOGS / บันทึกข้อมูลแรงดันย้อนหลัง ---"`);
  lines.push(
    `"Record ID","Timestamp (ISO)","Timestamp (Local TH)","Gas Code","Gas Name","Measured Value","Unit","Status","Manifold Bank","Y1 (Left)","Y2 (Right)","Y3 (Supply R3)","Y4 (Alarm)","Y5 (Fan)","Y6 (Beacon)"`
  );

  filtered.forEach(row => {
    const dateObj = new Date(row.timestamp);
    const isoStr = dateObj.toISOString();
    const thStr = dateObj.toLocaleString('th-TH', { timeZone: 'Asia/Bangkok' });
    const gasInfo = DEFAULT_GAS_CHANNELS.find(g => g.code === row.gasCode);
    const gasName = gasInfo ? gasInfo.nameTh : row.gasCode;

    const rState = (idx: number) => {
      if (!row.relayStates || row.relayStates[idx] === undefined) return 'N/A';
      return row.relayStates[idx] ? 'ON' : 'OFF';
    };

    lines.push(
      `"${row.id}","${isoStr}","${thStr}","${row.gasCode}","${gasName}",${row.value.toFixed(2)},"${row.unit}","${row.status}","${row.bank}","${rState(0)}","${rState(1)}","${rState(2)}","${rState(3)}","${rState(4)}","${rState(5)}"`
    );
  });

  // Prepend UTF-8 BOM for perfect Microsoft Excel Thai character support
  return '\uFEFF' + lines.join('\r\n');
}

export function downloadCsvFile(csvContent: string, fileName?: string) {
  const name = fileName || `medgas_master_v3_report_${new Date().toISOString().slice(0, 10)}.csv`;
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', name);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
