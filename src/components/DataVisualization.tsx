import React, { useState, useMemo } from 'react';
import { Activity, Calendar, Download, Eye, Filter, Info, TrendingDown, TrendingUp } from 'lucide-react';
import { GasChannel, GasCode, HistoricalReading, PressureUnit } from '../types/medgas';
import { DEFAULT_GAS_CHANNELS } from '../utils/defaults';
import { convertPressure, formatPressure } from '../utils/units';

interface DataVisualizationProps {
  history: HistoricalReading[];
  gases: GasChannel[];
  activeUnit: PressureUnit;
  onOpenExportModal: () => void;
  selectedGasCode?: GasCode;
}

export const DataVisualization: React.FC<DataVisualizationProps> = ({
  history,
  gases,
  activeUnit,
  onOpenExportModal,
  selectedGasCode: initialGasCode,
}) => {
  const [selectedGas, setSelectedGas] = useState<GasCode>(initialGasCode || 'O2');
  const [timeRange, setTimeRange] = useState<'15m' | '1h' | '6h' | '24h'>('1h');
  const [hoveredPoint, setHoveredPoint] = useState<HistoricalReading | null>(null);

  // Time window in ms
  const timeWindowMs = useMemo(() => {
    switch (timeRange) {
      case '15m': return 15 * 60 * 1000;
      case '1h': return 60 * 60 * 1000;
      case '6h': return 6 * 60 * 60 * 1000;
      case '24h': return 24 * 60 * 60 * 1000;
    }
  }, [timeRange]);

  const activeGasChannel = useMemo(() => {
    return gases.find(g => g.code === selectedGas) || gases[0];
  }, [gases, selectedGas]);

  // Filter history for selected gas and time range
  const filteredData = useMemo(() => {
    const cutoff = Date.now() - timeWindowMs;
    const items = history.filter(h => h.gasCode === selectedGas && h.timestamp >= cutoff);
    return items.sort((a, b) => a.timestamp - b.timestamp);
  }, [history, selectedGas, timeWindowMs]);

  // Compute Statistics
  const stats = useMemo(() => {
    if (filteredData.length === 0) {
      return { min: 0, max: 0, avg: 0, count: 0, normalRatio: 100 };
    }
    let min = Infinity;
    let max = -Infinity;
    let sum = 0;
    let normalCount = 0;

    filteredData.forEach(d => {
      min = Math.min(min, d.value);
      max = Math.max(max, d.value);
      sum += d.value;
      if (d.status === 'NORMAL') normalCount++;
    });

    const avg = sum / filteredData.length;
    const normalRatio = (normalCount / filteredData.length) * 100;
    return { min, max, avg, count: filteredData.length, normalRatio };
  }, [filteredData]);

  // SVG Chart Dimensions
  const width = 800;
  const height = 300;
  const padding = { top: 25, right: 30, bottom: 40, left: 60 };

  // Calculate dynamic Y domain with bounds padding
  const yDomain = useMemo(() => {
    const thresh = activeGasChannel.threshold;
    let min = thresh.minCrit;
    let max = thresh.maxCrit;

    filteredData.forEach(d => {
      min = Math.min(min, d.value);
      max = Math.max(max, d.value);
    });

    // Provide buffer
    const span = Math.max(0.5, Math.abs(max - min));
    return {
      min: min - span * 0.15,
      max: max + span * 0.15,
    };
  }, [activeGasChannel, filteredData]);

  // Scale functions
  const getX = (timestamp: number, startTime: number, endTime: number) => {
    const timeSpan = Math.max(1000, endTime - startTime);
    const ratio = (timestamp - startTime) / timeSpan;
    return padding.left + ratio * (width - padding.left - padding.right);
  };

  const getY = (val: number) => {
    const span = Math.max(0.01, yDomain.max - yDomain.min);
    const ratio = (val - yDomain.min) / span;
    return height - padding.bottom - ratio * (height - padding.top - padding.bottom);
  };

  const startTime = Date.now() - timeWindowMs;
  const endTime = Date.now();

  // Generate SVG path for line and area fill
  const { linePath, areaPath, points } = useMemo(() => {
    if (filteredData.length === 0) return { linePath: '', areaPath: '', points: [] };

    const pts = filteredData.map(d => ({
      x: getX(d.timestamp, startTime, endTime),
      y: getY(d.value),
      data: d,
    }));

    if (pts.length === 1) {
      return {
        linePath: `M ${pts[0].x} ${pts[0].y}`,
        areaPath: '',
        points: pts,
      };
    }

    let lp = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      // Smooth cubic curve
      const prev = pts[i - 1];
      const curr = pts[i];
      const cpX = (prev.x + curr.x) / 2;
      lp += ` C ${cpX} ${prev.y}, ${cpX} ${curr.y}, ${curr.x} ${curr.y}`;
    }

    const baselineY = getY(yDomain.min);
    const ap = `${lp} L ${pts[pts.length - 1].x} ${baselineY} L ${pts[0].x} ${baselineY} Z`;

    return { linePath: lp, areaPath: ap, points: pts };
  }, [filteredData, startTime, endTime, yDomain]);

  // Reference lines (Nominal, Warn, Crit)
  const nominalY = getY(activeGasChannel.threshold.nominal);
  const minCritY = getY(activeGasChannel.threshold.minCrit);
  const maxCritY = getY(activeGasChannel.threshold.maxCrit);
  const minWarnY = getY(activeGasChannel.threshold.minWarn);
  const maxWarnY = getY(activeGasChannel.threshold.maxWarn);

  return (
    <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 shadow-sm space-y-5">
      {/* Header and Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Activity className="w-4 h-4" />
            </div>
            <h2 className="text-base sm:text-lg font-semibold text-white">
              การแสดงผลข้อมูลแนวโน้มแรงดัน (Data Visualization)
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            วิเคราะห์พฤติกรรมการจ่ายก๊าซและเปรียบเทียบกับขอบเขตเกณฑ์มาตรฐาน (Threshold Bounds)
          </p>
        </div>

        {/* Time range selector & Export button */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
            {(['15m', '1h', '6h', '24h'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTimeRange(t)}
                className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                  timeRange === t
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {t === '15m' ? '15 นาที' : t === '1h' ? '1 ชั่วโมง' : t === '6h' ? '6 ชม.' : '24 ชม.'}
              </button>
            ))}
          </div>

          <button
            onClick={onOpenExportModal}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-medium border border-slate-700 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>ดาวน์โหลด CSV</span>
          </button>
        </div>
      </div>

      {/* Gas Switcher Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {DEFAULT_GAS_CHANNELS.map(g => (
          <button
            key={g.code}
            onClick={() => setSelectedGas(g.code)}
            className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-all whitespace-nowrap ${
              selectedGas === g.code
                ? 'bg-slate-800 border-cyan-500/50 text-white shadow-sm'
                : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:text-slate-200'
            }`}
          >
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: g.color }}
            />
            <span className="font-bold font-mono">{g.code}</span>
            <span className="text-[11px] text-slate-400 hidden sm:inline">{g.nameTh}</span>
          </button>
        ))}
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/70">
          <span className="text-[11px] text-slate-400 block mb-0.5">ค่าปัจจุบัน (Current)</span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-bold font-mono text-white tabular-nums">
              {formatPressure(activeGasChannel.currentValue, activeGasChannel.unit)}
            </span>
            <span className="text-xs font-mono text-slate-400">{activeGasChannel.unit}</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/70">
          <span className="text-[11px] text-slate-400 block mb-0.5">ค่าเฉลี่ย (Average)</span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-bold font-mono text-cyan-300 tabular-nums">
              {stats.count > 0 ? stats.avg.toFixed(2) : '-'}
            </span>
            <span className="text-xs font-mono text-slate-400">{activeGasChannel.unit}</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/70">
          <span className="text-[11px] text-slate-400 block mb-0.5">จุดต่ำสุด / สูงสุด (Min/Max)</span>
          <div className="flex items-center gap-2 text-xs font-mono">
            <span className="text-rose-400 font-semibold">{stats.count > 0 ? stats.min.toFixed(2) : '-'}</span>
            <span className="text-slate-600">/</span>
            <span className="text-emerald-400 font-semibold">{stats.count > 0 ? stats.max.toFixed(2) : '-'}</span>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/70">
          <span className="text-[11px] text-slate-400 block mb-0.5">ความเสถียรตามมาตรฐาน</span>
          <div className="flex items-baseline gap-1">
            <span className="text-xl sm:text-2xl font-bold font-mono text-emerald-400 tabular-nums">
              {stats.normalRatio.toFixed(0)}%
            </span>
            <span className="text-[11px] text-slate-400">ในเกณฑ์ปกติ</span>
          </div>
        </div>
      </div>

      {/* SVG Interactive Chart Canvas */}
      <div className="relative bg-slate-950 rounded-2xl border border-slate-800 p-2 sm:p-4 overflow-hidden">
        {filteredData.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-slate-500 text-xs">
            <Activity className="w-8 h-8 mb-2 opacity-40 text-cyan-500 animate-pulse" />
            <p>กำลังเก็บรวบรวมข้อมูลโทรมาตรแบบ Real-time...</p>
          </div>
        ) : (
          <div className="relative w-full overflow-x-auto">
            <svg
              viewBox={`0 0 ${width} ${height}`}
              className="w-full h-auto min-w-[600px] select-none"
              style={{ overflow: 'visible' }}
            >
              <defs>
                <linearGradient id={`grad-${selectedGas}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={activeGasChannel.color} stopOpacity="0.3" />
                  <stop offset="100%" stopColor={activeGasChannel.color} stopOpacity="0.0" />
                </linearGradient>
              </defs>

              {/* Grid Lines */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                const y = padding.top + ratio * (height - padding.top - padding.bottom);
                const val = yDomain.max - ratio * (yDomain.max - yDomain.min);
                return (
                  <g key={i}>
                    <line
                      x1={padding.left}
                      y1={y}
                      x2={width - padding.right}
                      y2={y}
                      stroke="#1e293b"
                      strokeDasharray="3 3"
                    />
                    <text
                      x={padding.left - 8}
                      y={y + 3}
                      fill="#64748b"
                      fontSize="10"
                      fontFamily="JetBrains Mono, monospace"
                      textAnchor="end"
                    >
                      {val.toFixed(2)}
                    </text>
                  </g>
                );
              })}

              {/* Threshold Lines */}
              {/* Critical High Line */}
              {maxCritY >= padding.top && maxCritY <= height - padding.bottom && (
                <line
                  x1={padding.left}
                  y1={maxCritY}
                  x2={width - padding.right}
                  y2={maxCritY}
                  stroke="#f43f5e"
                  strokeWidth="1.2"
                  strokeDasharray="4 4"
                />
              )}

              {/* Nominal Line */}
              {nominalY >= padding.top && nominalY <= height - padding.bottom && (
                <line
                  x1={padding.left}
                  y1={nominalY}
                  x2={width - padding.right}
                  y2={nominalY}
                  stroke="#10b981"
                  strokeWidth="1.2"
                  strokeDasharray="2 2"
                />
              )}

              {/* Critical Low Line */}
              {minCritY >= padding.top && minCritY <= height - padding.bottom && (
                <line
                  x1={padding.left}
                  y1={minCritY}
                  x2={width - padding.right}
                  y2={minCritY}
                  stroke="#f43f5e"
                  strokeWidth="1.2"
                  strokeDasharray="4 4"
                />
              )}

              {/* Area Gradient Fill */}
              {areaPath && (
                <path d={areaPath} fill={`url(#grad-${selectedGas})`} />
              )}

              {/* Main Line */}
              <path
                d={linePath}
                fill="none"
                stroke={activeGasChannel.color}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* Data Point Markers (Hoverable) */}
              {points.map((pt, idx) => (
                <circle
                  key={idx}
                  cx={pt.x}
                  cy={pt.y}
                  r="3.5"
                  className="cursor-pointer transition-transform hover:scale-150"
                  fill="#0f172a"
                  stroke={activeGasChannel.color}
                  strokeWidth="2"
                  onMouseEnter={() => setHoveredPoint(pt.data)}
                />
              ))}

              {/* Time X-Axis Labels */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                const t = startTime + ratio * (endTime - startTime);
                const x = padding.left + ratio * (width - padding.left - padding.right);
                const timeStr = new Date(t).toLocaleTimeString('th-TH', {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                });
                return (
                  <text
                    key={i}
                    x={x}
                    y={height - 12}
                    fill="#64748b"
                    fontSize="9"
                    fontFamily="JetBrains Mono, monospace"
                    textAnchor="middle"
                  >
                    {timeStr}
                  </text>
                );
              })}
            </svg>

            {/* Hover Tooltip Overlay */}
            {hoveredPoint && (
              <div
                className="absolute top-4 right-4 bg-slate-900/95 border border-slate-700/80 rounded-xl p-3 shadow-xl text-xs space-y-1 backdrop-blur-md animate-fadeIn"
                onMouseLeave={() => setHoveredPoint(null)}
              >
                <div className="flex items-center justify-between gap-3 font-semibold text-white">
                  <span>{activeGasChannel.nameTh}</span>
                  <span className="font-mono text-cyan-400">
                    {hoveredPoint.value.toFixed(2)} {hoveredPoint.unit}
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 font-mono">
                  {new Date(hoveredPoint.timestamp).toLocaleString('th-TH')}
                </div>
                <div className="text-[10px] flex items-center gap-1.5 pt-1 border-t border-slate-800">
                  <span className="text-slate-400">สถานะ:</span>
                  <span
                    className={`font-semibold ${
                      hoveredPoint.status === 'NORMAL'
                        ? 'text-emerald-400'
                        : hoveredPoint.status.includes('CRIT')
                        ? 'text-rose-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {hoveredPoint.status}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Legend */}
        <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between flex-wrap gap-3 text-[11px] text-slate-400 font-mono">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-emerald-400 inline-block" />
              <span>Nominal Target ({activeGasChannel.threshold.nominal} {activeGasChannel.unit})</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-0.5 bg-rose-500 inline-block stroke-dash" />
              <span>Critical Bounds (Min: {activeGasChannel.threshold.minCrit}, Max: {activeGasChannel.threshold.maxCrit})</span>
            </div>
          </div>
          <div>
            <span>บันทึกแล้ว {filteredData.length} ตัวอย่าง</span>
          </div>
        </div>
      </div>
    </div>
  );
};
