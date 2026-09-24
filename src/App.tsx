/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Bell,
  Check,
  CheckCircle2,
  Cpu,
  Download,
  Eye,
  Flame,
  Gauge,
  Info,
  Layers,
  Radio,
  RefreshCw,
  Server,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  Wifi,
  Wind,
  Zap,
} from 'lucide-react';

import {
  AlarmEvent,
  ConnectionConfig,
  DeviceTelemetry,
  GasChannel,
  GasCode,
  GasThreshold,
  HistoricalReading,
  NtfyConfig,
  PressureUnit,
  RelayItem,
} from './types/medgas';

import { MedgasApiClient } from './services/api';
import { sendNtfyNotification } from './services/ntfy';
import {
  loadActiveUnit,
  loadStoredAlarms,
  loadStoredConnection,
  loadStoredHistory,
  loadStoredNtfy,
  loadStoredThresholds,
  saveActiveUnit,
  saveStoredAlarms,
  saveStoredConnection,
  saveStoredHistory,
  saveStoredNtfy,
  saveStoredThresholds,
} from './services/storage';

import { DEFAULT_GAS_CHANNELS, DEFAULT_RELAYS } from './utils/defaults';
import { evaluateGasStatus, formatPressure } from './utils/units';

import { Header } from './components/Header';
import { GasPressureCard } from './components/GasPressureCard';
import { RelayControlPanel } from './components/RelayControlPanel';
import { DataVisualization } from './components/DataVisualization';
import { NtfySettingsPanel } from './components/NtfySettingsPanel';
import { ThresholdSettingsModal } from './components/ThresholdSettingsModal';
import { HardwareWifiModal } from './components/HardwareWifiModal';
import { ExportCsvModal } from './components/ExportCsvModal';
import { BottomNav } from './components/BottomNav';
import { OfflineIndicator } from './components/OfflineIndicator';
import { PWAInstallModal } from './components/PWAInstallModal';

export default function App() {
  // Config States
  const [connectionConfig, setConnectionConfig] = useState<ConnectionConfig>(loadStoredConnection);
  const [thresholds, setThresholds] = useState<Record<GasCode, GasThreshold>>(loadStoredThresholds);
  const [ntfyConfig, setNtfyConfig] = useState<NtfyConfig>(loadStoredNtfy);
  const [activeUnit, setActiveUnit] = useState<PressureUnit>(loadActiveUnit);

  // Data States
  const [gases, setGases] = useState<GasChannel[]>(() => {
    const loadedThresh = loadStoredThresholds();
    return DEFAULT_GAS_CHANNELS.map(g => ({
      ...g,
      threshold: loadedThresh[g.code] || g.threshold,
    }));
  });

  const [relays, setRelays] = useState<RelayItem[]>(DEFAULT_RELAYS);
  const [telemetry, setTelemetry] = useState<DeviceTelemetry>({
    fw: 'v3.1.0',
    mode: 'STA + AP',
    sta_ip: '192.168.1.50',
    ap_ip: '192.168.4.1',
    rssi: -52,
    uptime_s: 48200,
    heap: 245760,
    rs485_baud: 9600,
    relays: DEFAULT_RELAYS.map(r => ({ id: r.id, pin: r.pin, state: r.state })),
    lastUpdated: Date.now(),
    isConnected: true,
  });

  const [history, setHistory] = useState<HistoricalReading[]>(loadStoredHistory);
  const [alarms, setAlarms] = useState<AlarmEvent[]>(loadStoredAlarms);

  // Navigation & UI States
  const [activeTab, setActiveTab] = useState<'dashboard' | 'relays' | 'analytics' | 'ntfy' | 'thresholds'>('dashboard');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isUpdatingRelay, setIsUpdatingRelay] = useState<number | null>(null);

  // Modals
  const [isThresholdModalOpen, setIsThresholdModalOpen] = useState(false);
  const [selectedGasForModal, setSelectedGasForModal] = useState<GasCode>('O2');
  const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isPWAInstallModalOpen, setIsPWAInstallModalOpen] = useState(false);

  // API Client Ref
  const apiClientRef = useRef<MedgasApiClient>(new MedgasApiClient(connectionConfig));

  // Keep API client config synced
  useEffect(() => {
    apiClientRef.current.updateConfig(connectionConfig);
    saveStoredConnection(connectionConfig);
  }, [connectionConfig]);

  // Keep thresholds synced to gases
  useEffect(() => {
    saveStoredThresholds(thresholds);
    setGases(prev =>
      prev.map(g => {
        const newThresh = thresholds[g.code] || g.threshold;
        return {
          ...g,
          threshold: newThresh,
          status: evaluateGasStatus(g.currentValue, newThresh, g.code),
        };
      })
    );
  }, [thresholds]);

  // Keep NTFY synced
  useEffect(() => {
    saveStoredNtfy(ntfyConfig);
  }, [ntfyConfig]);

  // Keep active unit synced
  const handleUnitChange = (u: PressureUnit) => {
    setActiveUnit(u);
    saveActiveUnit(u);
  };

  // Seed sample initial history if empty so visualizations look realistic immediately
  useEffect(() => {
    if (history.length === 0) {
      const now = Date.now();
      const initialLogs: HistoricalReading[] = [];
      const channels = DEFAULT_GAS_CHANNELS;

      // Seed 60 sample points over last 30 minutes
      for (let i = 60; i >= 0; i--) {
        const t = now - i * 30 * 1000;
        channels.forEach(gas => {
          const cycle = Math.sin((t / 1000) / 10) * 0.05;
          const val = Number((gas.threshold.nominal + cycle + (Math.random() - 0.5) * 0.03).toFixed(2));
          initialLogs.push({
            id: `log-${gas.code}-${t}`,
            timestamp: t,
            gasCode: gas.code,
            value: val,
            unit: gas.unit,
            status: evaluateGasStatus(val, gas.threshold, gas.code),
            bank: 'LEFT',
            relayStates: [false, false, true, false, false, false],
          });
        });
      }
      setHistory(initialLogs);
      saveStoredHistory(initialLogs);
    }
  }, []);

  // Poll loop: fetches from ESP32-C3 or Simulator
  const pollData = useCallback(async () => {
    try {
      const data = await apiClientRef.current.fetchStatus();

      // Apply current thresholds to received gas values
      const evaluatedGases = data.gases.map(g => {
        const th = thresholds[g.code] || g.threshold;
        const status = evaluateGasStatus(g.currentValue, th, g.code);
        return {
          ...g,
          threshold: th,
          status,
        };
      });

      setTelemetry(data.telemetry);
      setGases(evaluatedGases);
      setRelays(data.relays);

      // Record telemetry history
      const now = Date.now();
      const newReadings: HistoricalReading[] = evaluatedGases.map(g => ({
        id: `h-${g.code}-${now}`,
        timestamp: now,
        gasCode: g.code,
        value: g.currentValue,
        unit: g.unit,
        status: g.status,
        bank: g.bankSource,
        relayStates: data.relays.map(r => r.state),
      }));

      setHistory(prev => {
        const updated = [...prev, ...newReadings].slice(-1200);
        saveStoredHistory(updated);
        return updated;
      });

      // Check alarms & send NTFY alerts
      evaluatedGases.forEach(gas => {
        if (gas.status !== 'NORMAL') {
          const isCrit = gas.status === 'CRIT_LOW' || gas.status === 'CRIT_HIGH';
          const shouldNotify = isCrit ? ntfyConfig.notifyOnCrit : ntfyConfig.notifyOnWarn;

          if (shouldNotify && ntfyConfig.enabled) {
            const statusText =
              gas.status === 'CRIT_LOW'
                ? 'แรงดันต่ำวิกฤต (Critical Low)'
                : gas.status === 'CRIT_HIGH'
                ? 'แรงดันสูงวิกฤต (Critical High)'
                : gas.status === 'WARN_LOW'
                ? 'แรงดันต่ำกว่าเกณฑ์ (Warning Low)'
                : 'แรงดันสูงเกินเกณฑ์ (Warning High)';

            const alertTitle = `🚨 [Medgas Master v3.1] ${gas.nameTh} (${gas.code}): ${statusText}`;
            const alertMsg = `สถานี: Medgas Master v3.1 (ESP32-C3)\nชนิดก๊าซ: ${gas.nameTh} (${gas.code})\nค่าที่วัดได้: ${gas.currentValue} ${gas.unit}\nเกณฑ์ปกติ: ${gas.threshold.nominal} ${gas.unit} (Min: ${gas.threshold.minCrit} / Max: ${gas.threshold.maxCrit})\nแหล่งจ่าย: ถังชุด ${gas.bankSource === 'LEFT' ? 'ซ้าย' : 'ขวา'}\nเวลา: ${new Date().toLocaleTimeString('th-TH')}`;

            sendNtfyNotification(ntfyConfig, {
              title: alertTitle,
              message: alertMsg,
              priority: isCrit ? 'urgent' : 'high',
              tags: isCrit ? 'rotating_light,hospital,skull' : 'warning,hospital',
              key: `gas_${gas.code}_${gas.status}`,
            });
          }

          // Register in Alarm history if new
          setAlarms(prevAlarms => {
            const hasRecentSame = prevAlarms.some(
              a => a.gasCode === gas.code && now - a.timestamp < 30000 && a.type.includes(gas.status.split('_')[0])
            );
            if (!hasRecentSame) {
              const newAlarm: AlarmEvent = {
                id: `alarm-${now}-${gas.code}`,
                timestamp: now,
                type: gas.status === 'CRIT_LOW' ? 'CRITICAL_LOW' : gas.status === 'CRIT_HIGH' ? 'CRITICAL_HIGH' : gas.status === 'WARN_LOW' ? 'WARNING_LOW' : 'WARNING_HIGH',
                gasCode: gas.code,
                title: `${gas.nameTh} ${gas.status}`,
                message: `แรงดันอยู่ที่ ${gas.currentValue} ${gas.unit} (เกณฑ์ปกติ ${gas.threshold.nominal} ${gas.unit})`,
                value: gas.currentValue,
                unit: gas.unit,
                severity: isCrit ? 'critical' : 'warning',
                acknowledged: false,
              };
              const updated = [newAlarm, ...prevAlarms].slice(0, 100);
              saveStoredAlarms(updated);
              return updated;
            }
            return prevAlarms;
          });
        }
      });
    } catch (e: any) {
      setTelemetry(prev => ({ ...prev, isConnected: false }));
    }
  }, [thresholds, ntfyConfig]);

  // Main Polling Timer
  useEffect(() => {
    pollData();
    const interval = setInterval(pollData, connectionConfig.pollIntervalMs || 2500);
    return () => clearInterval(interval);
  }, [pollData, connectionConfig.pollIntervalMs]);

  // Manual refresh trigger
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await pollData();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  // Toggle Relay handler (sends POST /api/relay)
  const handleToggleRelay = async (relayId: number, newState: boolean): Promise<boolean> => {
    setIsUpdatingRelay(relayId);
    try {
      const ok = await apiClientRef.current.setRelay(relayId, newState);
      if (ok) {
        setRelays(prev =>
          prev.map(r => (r.id === relayId ? { ...r, state: newState } : r))
        );

        // Notify on relay change if enabled
        if (ntfyConfig.enabled && ntfyConfig.notifyOnRelayChange) {
          const targetRelay = relays.find(r => r.id === relayId);
          sendNtfyNotification(ntfyConfig, {
            title: `⚡ [Medgas Master] สถานะ Relay Y${relayId} เปลี่ยนแปลง`,
            message: `รีเลย์: ${targetRelay?.labelTh || `Y${relayId}`} (GPIO${targetRelay?.pin})\nสถานะใหม่: ${newState ? 'เปิด (ON)' : 'ปิด (OFF)'}\nเวลา: ${new Date().toLocaleTimeString('th-TH')}`,
            priority: 'default',
            tags: 'zap,information_source',
            key: `relay_${relayId}`,
          });
        }
        return true;
      }
      return false;
    } finally {
      setIsUpdatingRelay(null);
    }
  };

  // Quick Action: Edit Threshold from Card
  const handleEditThreshold = (gas: GasChannel) => {
    setSelectedGasForModal(gas.code);
    setIsThresholdModalOpen(true);
  };

  // Quick Action: View Trend from Card
  const handleViewTrend = (gas: GasChannel) => {
    setSelectedGasForModal(gas.code);
    setActiveTab('analytics');
  };

  // Simulator Scenario injection helper
  const handleSetSimScenario = (scenario: 'NORMAL' | 'O2_DROP' | 'AIR_SPIKE' | 'VAC_LOSS') => {
    apiClientRef.current.setSimScenario(scenario);
    pollData();
  };

  // Count unacknowledged alarms
  const unacknowledgedCount = alarms.filter(a => !a.acknowledged).length;

  const handleAcknowledgeAllAlarms = () => {
    const updated = alarms.map(a => ({ ...a, acknowledged: true }));
    setAlarms(updated);
    saveStoredAlarms(updated);
  };

  // Overall Medical Gas Pipeline Status
  const criticalGases = gases.filter(g => g.status === 'CRIT_LOW' || g.status === 'CRIT_HIGH');
  const warningGases = gases.filter(g => g.status === 'WARN_LOW' || g.status === 'WARN_HIGH');
  const isSystemCritical = criticalGases.length > 0;
  const isSystemWarning = warningGases.length > 0 && !isSystemCritical;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-black">
      {/* Top Header */}
      <Header
        telemetry={telemetry}
        connectionConfig={connectionConfig}
        ntfyConfig={ntfyConfig}
        activeUnit={activeUnit}
        onUnitChange={handleUnitChange}
        onOpenConnectionModal={() => setIsConnectionModalOpen(true)}
        onOpenThresholdModal={() => setIsThresholdModalOpen(true)}
        onOpenExportModal={() => setIsExportModalOpen(true)}
        onOpenWifiModal={() => setIsConnectionModalOpen(true)}
        onManualRefresh={handleManualRefresh}
        isRefreshing={isRefreshing}
        unacknowledgedAlertsCount={unacknowledgedCount}
        activeTab={activeTab}
        onTabChange={(tab: any) => setActiveTab(tab)}
      />

      {/* Simulator Test Bar (when in simulation mode) */}
      {connectionConfig.mode === 'SIMULATOR' && (
        <div className="bg-indigo-950/70 border-b border-indigo-800/60 px-4 py-2 text-xs">
          <div className="max-w-7xl mx-auto flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2 text-indigo-300">
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span className="font-semibold">แถบทดสอบฮาร์ดแวร์จำลอง (Live Simulation Controls):</span>
              <span className="text-slate-400 hidden sm:inline">
                ทดลองส่งสัญญาณเตือนภัยเพื่อทดสอบระบบ NTFY และกราฟได้ทันที
              </span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => handleSetSimScenario('O2_DROP')}
                className="px-2.5 py-1 rounded bg-rose-900/60 hover:bg-rose-800/80 border border-rose-700/60 text-rose-200 text-[11px] font-medium transition-colors"
                title="จำลองออกซิเจนรั่วหรือแรงดันตกเหลือ 3.12 bar"
              >
                🔴 ทดสอบ O2 ตกวิกฤต
              </button>
              <button
                onClick={() => handleSetSimScenario('AIR_SPIKE')}
                className="px-2.5 py-1 rounded bg-amber-900/60 hover:bg-amber-800/80 border border-amber-700/60 text-amber-200 text-[11px] font-medium transition-colors"
                title="จำลองเรกูเลเตอร์จ่ายอากาศทางการแพทย์สูงเกิน"
              >
                🟡 ทดสอบ MA4 สูงเกิน
              </button>
              <button
                onClick={() => handleSetSimScenario('VAC_LOSS')}
                className="px-2.5 py-1 rounded bg-yellow-950/70 hover:bg-yellow-900/80 border border-yellow-700/60 text-yellow-300 text-[11px] font-medium transition-colors"
                title="จำลองปั๊มสุญญากาศขัดข้อง (-38 kPa)"
              >
                ⚠️ ทดสอบสุญญากาศตก
              </button>
              <button
                onClick={() => handleSetSimScenario('NORMAL')}
                className="px-2.5 py-1 rounded bg-emerald-900/60 hover:bg-emerald-800/80 border border-emerald-700/60 text-emerald-200 text-[11px] font-medium transition-colors"
              >
                🟢 คืนสถานะปกติ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Container */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-8 space-y-6">
        {/* Master System Alert Banner (If Out of Spec) */}
        {isSystemCritical && (
          <div className="p-4 rounded-2xl bg-rose-950/80 border-2 border-rose-500 text-rose-200 flex items-start justify-between gap-3 shadow-xl shadow-rose-950/50 animate-pulse">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-sm sm:text-base text-white">
                  ตรวจพบสภาวะแรงดันก๊าซทางการแพทย์อยู่ในระดับวิกฤต (Critical Alarm)!
                </h3>
                <p className="text-xs text-rose-300 mt-1">
                  ก๊าซที่มีปัญหา:{' '}
                  {criticalGases.map(g => `${g.nameTh} (${g.currentValue} ${g.unit})`).join(', ')} —{' '}
                  ไซเรนเสียง Y4 ถูกสั่งเปิดใช้งาน และระบบได้ส่ง Push Notification ผ่าน NTFY ไปยังสมาร์ตโฟนแล้ว
                </p>
              </div>
            </div>
            <button
              onClick={() => handleToggleRelay(4, false)}
              className="px-3 py-1.5 rounded-lg bg-rose-900 hover:bg-rose-800 text-white text-xs font-semibold shrink-0 border border-rose-700"
            >
              ปิดเสียงไซเรน (Mute Y4)
            </button>
          </div>
        )}

        {/* TAB 1: DASHBOARD VIEW */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Top Quick Status Ribbon */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
              {/* Overall Pipeline Health */}
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
                <span className="text-xs text-slate-400 block mb-1">สถานะระบบรวม (ISO 7396-1)</span>
                <div className="flex items-center gap-2">
                  <span
                    className={`w-3 h-3 rounded-full ${
                      isSystemCritical
                        ? 'bg-rose-500 animate-ping'
                        : isSystemWarning
                        ? 'bg-amber-400'
                        : 'bg-emerald-400'
                    }`}
                  />
                  <span
                    className={`text-base sm:text-lg font-bold ${
                      isSystemCritical
                        ? 'text-rose-400'
                        : isSystemWarning
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                    }`}
                  >
                    {isSystemCritical
                      ? 'พบแรงดันวิกฤต'
                      : isSystemWarning
                      ? 'พบค่าเริ่มผิดปกติ'
                      : 'ท่อก๊าซปกติทุกระบบ'}
                  </span>
                </div>
              </div>

              {/* Active Manifold Bank */}
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
                <span className="text-xs text-slate-400 block mb-1">ถัง Manifold ที่กำลังจ่าย</span>
                <div className="flex items-center gap-2">
                  <Layers className="w-4 h-4 text-cyan-400" />
                  <span className="text-base sm:text-lg font-bold font-mono text-white">
                    ถังชุดซ้าย (A)
                  </span>
                </div>
              </div>

              {/* Hardware Connection */}
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
                <span className="text-xs text-slate-400 block mb-1">ฮาร์ดแวร์ ESP32-C3</span>
                <div className="flex items-center gap-2">
                  <Wifi className="w-4 h-4 text-emerald-400" />
                  <span className="text-xs sm:text-sm font-mono text-slate-200 truncate">
                    {connectionConfig.mode === 'SIMULATOR'
                      ? 'จำลองบนบราวเซอร์'
                      : telemetry.sta_ip || 'AP: 192.168.4.1'}
                  </span>
                </div>
              </div>

              {/* Uptime / Modbus RS-485 */}
              <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
                <span className="text-xs text-slate-400 block mb-1">RS-485 UART1 / Uptime</span>
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-indigo-400" />
                  <span className="text-xs sm:text-sm font-mono text-slate-200">
                    {telemetry.rs485_baud} Baud · {Math.floor(telemetry.uptime_s / 3600)} ชม.{' '}
                    {Math.floor((telemetry.uptime_s % 3600) / 60)} น.
                  </span>
                </div>
              </div>
            </div>

            {/* PWA Install Quick Banner */}
            <div className="rounded-2xl bg-gradient-to-r from-cyan-950/50 via-slate-900 to-indigo-950/50 border border-cyan-500/30 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0">
                  <Download className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-white text-sm sm:text-base flex items-center gap-2">
                    <span>ติดตั้ง Medgas Master v3.1 ลงบนเครื่องของคุณ</span>
                    <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                      PWA / Standalone
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    รองรับการติดตั้งลงบน iPhone, iPad (iOS), Android, Windows และ Mac เปิดใช้งานได้สะดวกรวดเร็วโดยไม่ต้องเข้าเบราว์เซอร์
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsPWAInstallModalOpen(true)}
                className="py-2.5 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 shadow-md shadow-cyan-500/20 transition-all active:scale-[0.98] shrink-0"
              >
                <Download className="w-4 h-4" />
                <span>เปิดหน้าต่างติดตั้งลงเครื่อง</span>
              </button>
            </div>

            {/* Medical Gas Pressure Cards Grid (O2, MA4, SA7, VAC, N2O, CO2) */}
            <div>
              <div className="flex items-center justify-between mb-3.5">
                <div className="flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-cyan-400" />
                  <h2 className="text-base sm:text-lg font-semibold text-white">
                    สถานะแรงดันก๊าซทางการแพทย์แบบ Real-Time (6 ช่องทาง)
                  </h2>
                </div>
                <button
                  onClick={() => setIsThresholdModalOpen(true)}
                  className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium"
                >
                  <Sliders className="w-3.5 h-3.5" />
                  <span>ตั้งค่าเกณฑ์แรงดันทั้งหมด</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {gases.map(gas => (
                  <GasPressureCard
                    key={gas.id}
                    gas={gas}
                    activeUnit={activeUnit}
                    onEditThreshold={handleEditThreshold}
                    onViewTrend={handleViewTrend}
                  />
                ))}
              </div>
            </div>

            {/* Hardware Relay Control Panel Y1 - Y6 */}
            <RelayControlPanel
              relays={relays}
              onToggleRelay={handleToggleRelay}
              isUpdatingRelay={isUpdatingRelay}
            />

            {/* Quick Chart Preview in Dashboard */}
            <DataVisualization
              history={history}
              gases={gases}
              activeUnit={activeUnit}
              onOpenExportModal={() => setIsExportModalOpen(true)}
              selectedGasCode={selectedGasForModal}
            />
          </div>
        )}

        {/* TAB 2: RELAYS VIEW */}
        {activeTab === 'relays' && (
          <div className="space-y-6">
            <RelayControlPanel
              relays={relays}
              onToggleRelay={handleToggleRelay}
              isUpdatingRelay={isUpdatingRelay}
            />

            {/* Relay Status Explanation Card */}
            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 space-y-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Info className="w-4 h-4 text-cyan-400" />
                <span>คำอธิบายฟังก์ชันควบคุมรีเลย์ทางการแพทย์ (Manifold Automation)</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-300">
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                  <span className="font-bold text-cyan-300 block mb-1">Y1 & Y2: Manifold Solenoids</span>
                  <p className="text-slate-400 leading-relaxed">
                    ควบคุมโซลินอยด์วาล์วสลับแหล่งจ่ายก๊าซถังชุดซ้าย (A) และถังชุดขวา (B) แบบอัตโนมัติเมื่อแรงดันถังลดลงต่ำกว่า 15%
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                  <span className="font-bold text-emerald-300 block mb-1">Y3: Main Line Supply (R3)</span>
                  <p className="text-slate-400 leading-relaxed">
                    วาล์วจ่ายท่อหลักของโรงพยาบาล เริ่มต้นเปิด (ON) ตลอดเวลาตามการทำงานของเฟิร์มแวร์ Medgas Master v3.1.0
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                  <span className="font-bold text-rose-300 block mb-1">Y4: Audio Alarm / Strobe</span>
                  <p className="text-slate-400 leading-relaxed">
                    ส่งสัญญาณขับเสียงกริ่งเตือนภัยและไฟกะพริบแจ้งเตือนเมื่อตรวจพบแรงดันวิกฤต หรือแรงดันในท่อตกฉับพลัน
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800">
                  <span className="font-bold text-indigo-300 block mb-1">Y5 & Y6: Safety Exhaust & Beacon</span>
                  <p className="text-slate-400 leading-relaxed">
                    เปิดพัดลมดูดระบายอากาศห้องก๊าซเพื่อความปลอดภัย และส่งสัญญาณไฟเตือนไปยังเคาน์เตอร์พยาบาลแผนกฉุกเฉิน / ICU
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: ANALYTICS VIEW */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            <DataVisualization
              history={history}
              gases={gases}
              activeUnit={activeUnit}
              onOpenExportModal={() => setIsExportModalOpen(true)}
              selectedGasCode={selectedGasForModal}
            />

            {/* Historical Incident Log */}
            <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Activity className="w-4 h-4 text-cyan-400" />
                    <span>บันทึกเหตุการณ์เตือนภัยย้อนหลัง (Incident Audit Log)</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
                    ประวัติการเกิดแรงดันผิดปกติและการแจ้งเตือนระบบทั้งหมด
                  </p>
                </div>
                {unacknowledgedCount > 0 && (
                  <button
                    onClick={handleAcknowledgeAllAlarms}
                    className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-medium border border-slate-700 transition-colors"
                  >
                    รับทราบเหตุการณ์ทั้งหมด
                  </button>
                )}
              </div>

              {alarms.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-500/50" />
                  <p>ไม่พบเหตุการณ์ผิดปกติในระบบ ก๊าซทุกชนิดทำงานอยู่ในเกณฑ์มาตรฐาน</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-800/80 max-h-80 overflow-y-auto pr-1">
                  {alarms.map(alarm => (
                    <div key={alarm.id} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                      <div className="flex items-start gap-2.5">
                        <span
                          className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                            alarm.severity === 'critical' ? 'bg-rose-500' : 'bg-amber-400'
                          }`}
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-200">{alarm.title}</span>
                            <span className="text-[10px] font-mono text-slate-500">
                              {new Date(alarm.timestamp).toLocaleString('th-TH')}
                            </span>
                          </div>
                          <p className="text-slate-400 text-[11px] mt-0.5">{alarm.message}</p>
                        </div>
                      </div>
                      <span
                        className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${
                          alarm.severity === 'critical'
                            ? 'bg-rose-950/60 text-rose-300 border border-rose-800/50'
                            : 'bg-amber-950/60 text-amber-300 border border-amber-800/50'
                        }`}
                      >
                        {alarm.severity === 'critical' ? 'วิกฤต' : 'เตือนล่วงหน้า'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: NTFY NOTIFY VIEW */}
        {activeTab === 'ntfy' && (
          <div className="space-y-6">
            <NtfySettingsPanel
              config={ntfyConfig}
              onSaveConfig={(updated) => setNtfyConfig(updated)}
            />
          </div>
        )}

        {/* TAB 5: THRESHOLDS VIEW */}
        {activeTab === 'thresholds' && (
          <div className="space-y-6">
            <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-white flex items-center gap-2">
                    <Sliders className="w-5 h-5 text-cyan-400" />
                    <span>การตั้งค่าเกณฑ์แรงดันมาตรฐาน (Medical Gas Thresholds)</span>
                  </h2>
                  <p className="text-xs text-slate-400 mt-1">
                    ปรับแต่งเกณฑ์แจ้งเตือนสำหรับเครื่องตรวจวัดทั้ง 6 ชนิดก๊าซให้สอดคล้องกับมาตรฐานโรงพยาบาล
                  </p>
                </div>
                <button
                  onClick={() => setIsThresholdModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-2 shadow-md shadow-cyan-950/40 transition-colors self-start sm:self-auto"
                >
                  <Sliders className="w-4 h-4" />
                  <span>เปิดหน้าต่างปรับเกณฑ์แรงดัน</span>
                </button>
              </div>

              {/* Thresholds Table */}
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="py-2.5 px-3">ก๊าซทางการแพทย์</th>
                      <th className="py-2.5 px-3 text-rose-400">ต่ำวิกฤต (Min Crit)</th>
                      <th className="py-2.5 px-3 text-amber-400">ต่ำกว่าเกณฑ์ (Min Warn)</th>
                      <th className="py-2.5 px-3 text-emerald-400">เป้าหมายปกติ (Nominal)</th>
                      <th className="py-2.5 px-3 text-amber-400">สูงเกินเกณฑ์ (Max Warn)</th>
                      <th className="py-2.5 px-3 text-rose-400">สูงวิกฤต (Max Crit)</th>
                      <th className="py-2.5 px-3">หน่วย</th>
                      <th className="py-2.5 px-3 text-right">การจัดการ</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 text-slate-200">
                    {gases.map(gas => (
                      <tr key={gas.code} className="hover:bg-slate-800/30 transition-colors">
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: gas.color }}
                            />
                            <span className="font-bold text-white">{gas.code}</span>
                            <span className="text-[11px] text-slate-400 font-sans">{gas.nameTh}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-rose-400 font-semibold">{gas.threshold.minCrit}</td>
                        <td className="py-3 px-3 text-amber-400">{gas.threshold.minWarn}</td>
                        <td className="py-3 px-3 text-emerald-400 font-bold">{gas.threshold.nominal}</td>
                        <td className="py-3 px-3 text-amber-400">{gas.threshold.maxWarn}</td>
                        <td className="py-3 px-3 text-rose-400 font-semibold">{gas.threshold.maxCrit}</td>
                        <td className="py-3 px-3 text-slate-400">{gas.threshold.unit}</td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => handleEditThreshold(gas)}
                            className="text-cyan-400 hover:text-cyan-300 text-xs font-sans hover:underline"
                          >
                            แก้ไข
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Modals */}
      <ThresholdSettingsModal
        isOpen={isThresholdModalOpen}
        onClose={() => setIsThresholdModalOpen(false)}
        thresholds={thresholds}
        onSaveThresholds={(updated) => setThresholds(updated)}
        initialGasCode={selectedGasForModal}
      />

      <HardwareWifiModal
        isOpen={isConnectionModalOpen}
        onClose={() => setIsConnectionModalOpen(false)}
        connectionConfig={connectionConfig}
        onSaveConnection={(cfg) => setConnectionConfig(cfg)}
        telemetry={telemetry}
        onScanWifi={() => apiClientRef.current.fetchWifiScan()}
        onSaveDeviceWifi={(s, p) => apiClientRef.current.saveWifiCredentials(s, p)}
      />

      <ExportCsvModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        history={history}
        gases={gases}
        relays={relays}
      />

      <PWAInstallModal
        isOpen={isPWAInstallModalOpen}
        onClose={() => setIsPWAInstallModalOpen(false)}
      />

      {/* Offline Status Indicator */}
      <OfflineIndicator />

      {/* Mobile Touch Navigation Bar (iOS & Android) */}
      <BottomNav
        activeTab={activeTab}
        onTabChange={(tab: any) => setActiveTab(tab)}
        unacknowledgedAlertsCount={unacknowledgedCount}
      />
    </div>
  );
}
