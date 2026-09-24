import React from 'react';
import { Activity, Bell, Download, RefreshCw, Server, Settings, Wifi, Zap } from 'lucide-react';
import { ConnectionConfig, DeviceTelemetry, NtfyConfig, PressureUnit } from '../types/medgas';
import { PWAInstallButton } from './PWAInstallButton';

interface HeaderProps {
  telemetry: DeviceTelemetry;
  connectionConfig: ConnectionConfig;
  ntfyConfig: NtfyConfig;
  activeUnit: PressureUnit;
  onUnitChange: (unit: PressureUnit) => void;
  onOpenConnectionModal: () => void;
  onOpenThresholdModal: () => void;
  onOpenExportModal: () => void;
  onOpenWifiModal: () => void;
  onManualRefresh: () => void;
  isRefreshing: boolean;
  unacknowledgedAlertsCount: number;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  telemetry,
  connectionConfig,
  ntfyConfig,
  activeUnit,
  onUnitChange,
  onOpenConnectionModal,
  onOpenThresholdModal,
  onOpenExportModal,
  onOpenWifiModal,
  onManualRefresh,
  isRefreshing,
  unacknowledgedAlertsCount,
  activeTab,
  onTabChange,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-slate-950/90 backdrop-blur-md border-b border-slate-800/80 px-4 lg:px-8 py-3 transition-colors">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Zone 1: Single text element wordmark with telemetry indicator */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 text-cyan-400">
            <Activity className="w-5 h-5" />
            <span
              className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full ${
                telemetry.isConnected ? 'bg-emerald-400 ring-2 ring-emerald-500/30' : 'bg-rose-500 ring-2 ring-rose-500/30'
              }`}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base sm:text-lg font-bold tracking-tight text-white">
                Medgas Master <span className="text-xs font-mono font-normal text-cyan-400 px-1.5 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/50">v3.1</span>
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              ระบบตรวจสอบแรงดันก๊าซทางการแพทย์ & ควบคุมรีเลย์
            </p>
          </div>
        </div>

        {/* Zone 2: Navigation Links (Desktop) */}
        <nav className="hidden md:flex items-center gap-1 bg-slate-900/60 p-1 rounded-xl border border-slate-800">
          {[
            { id: 'dashboard', label: 'แดชบอร์ดหลัก' },
            { id: 'relays', label: 'รีเลย์ Y1-Y6' },
            { id: 'analytics', label: 'กราฟแนวโน้ม' },
            { id: 'ntfy', label: 'แจ้งเตือน NTFY' },
            { id: 'thresholds', label: 'ตั้งค่าเกณฑ์แรงดัน' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
              {tab.id === 'ntfy' && unacknowledgedAlertsCount > 0 && (
                <span className="ml-1.5 px-1.5 py-0.2 text-[10px] font-bold rounded-full bg-rose-500 text-white">
                  {unacknowledgedAlertsCount}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Zone 3: Primary Actions & Telemetry status */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Pressure Unit Selector */}
          <div className="hidden sm:flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs">
            {(['bar', 'psi', 'kPa'] as PressureUnit[]).map(unit => (
              <button
                key={unit}
                onClick={() => onUnitChange(unit)}
                className={`px-2 py-1 rounded font-mono font-medium transition-colors ${
                  activeUnit === unit ? 'bg-cyan-600 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                {unit}
              </button>
            ))}
          </div>

          {/* Connection Mode Pill / Trigger */}
          <button
            onClick={onOpenConnectionModal}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
              connectionConfig.mode === 'SIMULATOR'
                ? 'bg-indigo-950/50 border-indigo-500/40 text-indigo-300 hover:bg-indigo-900/50'
                : telemetry.isConnected
                ? 'bg-emerald-950/50 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/50'
                : 'bg-rose-950/50 border-rose-500/40 text-rose-300 hover:bg-rose-900/50'
            }`}
            title="เปลี่ยนโหมดการเชื่อมต่อ / ตั้งค่า IP ESP32-C3"
          >
            <Server className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">
              {connectionConfig.mode === 'SIMULATOR'
                ? 'โหมดจำลอง (Sim)'
                : connectionConfig.mode === 'DIRECT'
                ? 'ต่อตรง ESP32'
                : 'Proxy Server'}
            </span>
          </button>

          {/* NTFY Status Badge */}
          <button
            onClick={() => onTabChange('ntfy')}
            className={`relative p-2 rounded-lg border transition-colors ${
              ntfyConfig.enabled
                ? 'bg-slate-900 border-slate-800 text-cyan-400 hover:border-cyan-500/40'
                : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
            }`}
            title={ntfyConfig.enabled ? `NTFY Alert: ${ntfyConfig.topic}` : 'NTFY ปิดใช้งาน'}
          >
            <Bell className="w-4 h-4" />
            {ntfyConfig.enabled && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            )}
            {unacknowledgedAlertsCount > 0 && (
              <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-[9px] font-bold rounded-full bg-rose-500 text-white">
                {unacknowledgedAlertsCount}
              </span>
            )}
          </button>

          {/* Install to Device Button (PWA) */}
          <PWAInstallButton />

          {/* Export CSV Button */}
          <button
            onClick={onOpenExportModal}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 border border-slate-700/80 rounded-lg transition-colors whitespace-nowrap"
            title="ส่งออกรายงานข้อมูลสรุป CSV"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">ส่งออก CSV</span>
          </button>

          {/* Manual Refresh */}
          <button
            onClick={onManualRefresh}
            disabled={isRefreshing}
            className="p-2 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 hover:text-white hover:border-slate-700 disabled:opacity-50 transition-colors"
            title="ดึงข้อมูลล่าสุด"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>
    </header>
  );
};
