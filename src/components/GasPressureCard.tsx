import React from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, ChevronRight, Gauge, Sliders, Wind } from 'lucide-react';
import { GasChannel, PressureUnit } from '../types/medgas';
import { convertPressure, formatPressure, getStatusColor, getStatusLabel } from '../utils/units';

interface GasPressureCardProps {
  gas: GasChannel;
  activeUnit: PressureUnit;
  onEditThreshold: (gas: GasChannel) => void;
  onViewTrend: (gas: GasChannel) => void;
}

export const GasPressureCard: React.FC<GasPressureCardProps> = ({
  gas,
  activeUnit,
  onEditThreshold,
  onViewTrend,
}) => {
  // Convert current pressure to active unit
  const displayVal = convertPressure(gas.currentValue, gas.unit, activeUnit);
  const formattedVal = formatPressure(displayVal, activeUnit);

  // Convert thresholds to active unit for reference calculation
  const nomVal = convertPressure(gas.threshold.nominal, gas.threshold.unit, activeUnit);
  const minCritVal = convertPressure(gas.threshold.minCrit, gas.threshold.unit, activeUnit);
  const maxCritVal = convertPressure(gas.threshold.maxCrit, gas.threshold.unit, activeUnit);

  const statusStyle = getStatusColor(gas.status);
  const statusLabel = getStatusLabel(gas.status, 'th');

  // Gauge percentage calculation (clamped between 0 and 100)
  let percentage = 50;
  if (gas.code === 'VAC') {
    // Vacuum scale from -90 kPa to 0 kPa
    const minScale = -90;
    const maxScale = 0;
    percentage = Math.max(0, Math.min(100, ((gas.currentValue - minScale) / (maxScale - minScale)) * 100));
  } else {
    // Normal positive pressure scale
    const minScale = gas.threshold.nominal * 0.5;
    const maxScale = gas.threshold.nominal * 1.5;
    percentage = Math.max(0, Math.min(100, ((gas.currentValue - minScale) / (maxScale - minScale)) * 100));
  }

  const isAlert = gas.status !== 'NORMAL';
  const isCritical = gas.status === 'CRIT_LOW' || gas.status === 'CRIT_HIGH';

  return (
    <div
      className={`relative rounded-2xl bg-slate-900/80 border p-4 sm:p-5 transition-all duration-200 flex flex-col justify-between ${
        isCritical
          ? 'border-rose-500/80 shadow-lg shadow-rose-950/40 bg-slate-900/90'
          : isAlert
          ? 'border-amber-500/70 shadow-md shadow-amber-950/20'
          : 'border-slate-800 hover:border-slate-700/80'
      }`}
    >
      {/* Top Row: Gas Identification & Status */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-2.5">
          <div className="flex items-center gap-2.5">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center font-bold font-mono text-sm tracking-tight text-white border shadow-sm"
              style={{
                backgroundColor: `${gas.color}25`,
                borderColor: `${gas.color}70`,
                color: gas.color,
              }}
            >
              {gas.code}
            </div>
            <div>
              <h3 className="font-semibold text-slate-100 text-sm sm:text-base leading-tight">
                {gas.nameTh}
              </h3>
              <p className="text-xs text-slate-400 font-medium">
                {gas.nameEn}
              </p>
            </div>
          </div>

          {/* Status Indicator */}
          <div className="flex items-center gap-1.5">
            <span
              className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full ${statusStyle.badge} ${
                isCritical ? 'animate-pulse' : ''
              }`}
            >
              {isCritical ? (
                <AlertCircle className="w-3 h-3 shrink-0" />
              ) : isAlert ? (
                <AlertTriangle className="w-3 h-3 shrink-0" />
              ) : (
                <CheckCircle2 className="w-3 h-3 shrink-0" />
              )}
              <span>{statusLabel}</span>
            </span>
          </div>
        </div>

        {/* Big Reading Display */}
        <div className="my-3 flex items-baseline justify-between">
          <div className="flex items-baseline gap-1.5">
            <span
              className={`text-3xl sm:text-4xl font-bold font-mono tabular-nums tracking-tight ${
                isCritical ? 'text-rose-400' : isAlert ? 'text-amber-400' : 'text-white'
              }`}
            >
              {formattedVal}
            </span>
            <span className="text-xs font-mono font-semibold uppercase text-slate-400">
              {activeUnit}
            </span>
          </div>

          {/* Target Nominal */}
          <div className="text-right">
            <span className="text-[10px] uppercase font-mono text-slate-400 block">เกณฑ์ปกติ (Nominal)</span>
            <span className="text-xs font-mono text-slate-300">
              {formatPressure(nomVal, activeUnit)} {activeUnit}
            </span>
          </div>
        </div>

        {/* Visual Progress / Range Bar */}
        <div className="space-y-1 mb-3">
          <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800 p-0.5">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isCritical
                  ? 'bg-rose-500'
                  : isAlert
                  ? 'bg-amber-500'
                  : 'bg-emerald-400'
              }`}
              style={{ width: `${percentage}%` }}
            />
          </div>
          <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 px-0.5">
            <span>Min: {formatPressure(minCritVal, activeUnit)}</span>
            <span className="text-slate-400 font-medium">Target: {formatPressure(nomVal, activeUnit)}</span>
            <span>Max: {formatPressure(maxCritVal, activeUnit)}</span>
          </div>
        </div>

        {/* Secondary Telemetry: Flow Rate & Manifold Bank */}
        <div className="grid grid-cols-2 gap-2 p-2 bg-slate-950/60 rounded-xl border border-slate-800/60 text-xs mb-3">
          <div className="flex items-center gap-1.5">
            <Wind className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <div>
              <span className="text-[10px] text-slate-400 block leading-none">อัตราจ่ายก๊าซ</span>
              <span className="font-mono text-slate-200 font-medium">{gas.flowRateLpm} L/min</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Gauge className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
            <div>
              <span className="text-[10px] text-slate-400 block leading-none">แหล่งจ่าย Manifold</span>
              <span className="font-mono text-slate-200 font-medium">
                {gas.bankSource === 'LEFT' ? 'ชุดซ้าย (A)' : gas.bankSource === 'RIGHT' ? 'ชุดขวา (B)' : 'สำรองฉุกเฉิน'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Card Actions */}
      <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
        <button
          onClick={() => onEditThreshold(gas)}
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-cyan-300 transition-colors py-1 px-1.5 rounded hover:bg-slate-800/60"
        >
          <Sliders className="w-3.5 h-3.5 text-slate-400" />
          <span>ปรับเกณฑ์</span>
        </button>

        <button
          onClick={() => onViewTrend(gas)}
          className="flex items-center gap-0.5 text-xs text-cyan-400 hover:text-cyan-300 font-medium transition-colors py-1 px-1.5 rounded hover:bg-cyan-950/30"
        >
          <span>วิเคราะห์แนวโน้ม</span>
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
