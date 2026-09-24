export type PressureUnit = 'bar' | 'psi' | 'kPa' | 'MPa';

export type GasCode = 'O2' | 'MA4' | 'SA7' | 'VAC' | 'N2O' | 'CO2';

export type GasStatus = 'NORMAL' | 'WARN_LOW' | 'CRIT_LOW' | 'WARN_HIGH' | 'CRIT_HIGH';

export interface GasThreshold {
  nominal: number; // in bar (or kPa for VAC)
  minCrit: number;
  minWarn: number;
  maxWarn: number;
  maxCrit: number;
  unit: PressureUnit;
}

export interface GasChannel {
  id: string;
  code: GasCode;
  nameEn: string;
  nameTh: string;
  color: string;
  currentValue: number; // in native storage unit (bar or kPa for VAC)
  displayValue: number; // in active unit
  unit: PressureUnit;
  status: GasStatus;
  threshold: GasThreshold;
  bankSource: 'LEFT' | 'RIGHT' | 'RESERVE';
  flowRateLpm: number;
  temperatureC: number;
}

export interface RelayItem {
  id: number; // 1 to 6 (Y1 to Y6)
  pin: number; // ESP32-C3 GPIO
  name: string; // "Y1", "Y2", etc.
  labelEn: string;
  labelTh: string;
  description: string;
  state: boolean;
  defaultOn?: boolean;
}

export interface DeviceTelemetry {
  fw: string;
  mode: string;
  sta_ip: string;
  ap_ip: string;
  rssi: number;
  uptime_s: number;
  heap: number;
  rs485_baud: number;
  relays: {
    id: number;
    pin: number;
    state: boolean;
  }[];
  lastUpdated: number;
  isConnected: boolean;
}

export interface NtfyConfig {
  enabled: boolean;
  serverUrl: string; // default: https://ntfy.sh
  topic: string; // e.g. medgas-station-icu
  priority: 'urgent' | 'high' | 'default' | 'low';
  authToken?: string;
  cooldownSeconds: number; // minimum delay between notifications of same gas
  notifyOnWarn: boolean;
  notifyOnCrit: boolean;
  notifyOnRelayChange: boolean;
  lastSentAlerts: Record<string, number>; // key: gasCode or relayId -> timestamp
}

export interface HistoricalReading {
  id: string;
  timestamp: number;
  gasCode: GasCode;
  value: number; // in bar (or kPa for VAC)
  unit: PressureUnit;
  status: GasStatus;
  bank: 'LEFT' | 'RIGHT' | 'RESERVE';
  relayStates: boolean[];
}

export interface AlarmEvent {
  id: string;
  timestamp: number;
  type: 'CRITICAL_LOW' | 'WARNING_LOW' | 'CRITICAL_HIGH' | 'WARNING_HIGH' | 'RELAY_STATE' | 'SYSTEM_OFFLINE';
  gasCode?: GasCode;
  title: string;
  message: string;
  value?: number;
  unit?: string;
  severity: 'critical' | 'warning' | 'info';
  acknowledged: boolean;
}

export type ConnectionMode = 'SIMULATOR' | 'DIRECT' | 'PROXY';

export interface ConnectionConfig {
  mode: ConnectionMode;
  targetUrl: string; // e.g. http://192.168.4.1 or http://medgas.local or http://192.168.1.50
  pollIntervalMs: number; // default: 2000 ms
  timeoutMs: number;
}
