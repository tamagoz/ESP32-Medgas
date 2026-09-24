import React, { useState } from 'react';
import { AlertCircle, Check, RotateCcw, Sliders, X } from 'lucide-react';
import { GasChannel, GasCode, GasThreshold } from '../types/medgas';
import { DEFAULT_THRESHOLDS } from '../utils/units';

interface ThresholdSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  thresholds: Record<GasCode, GasThreshold>;
  onSaveThresholds: (updated: Record<GasCode, GasThreshold>) => void;
  initialGasCode?: GasCode;
}

export const ThresholdSettingsModal: React.FC<ThresholdSettingsModalProps> = ({
  isOpen,
  onClose,
  thresholds,
  onSaveThresholds,
  initialGasCode = 'O2',
}) => {
  const [activeGas, setActiveGas] = useState<GasCode>(initialGasCode);
  const [localThresholds, setLocalThresholds] = useState<Record<GasCode, GasThreshold>>({ ...thresholds });
  const [saveSuccess, setSaveSuccess] = useState(false);

  if (!isOpen) return null;

  const currentThresh = localThresholds[activeGas] || DEFAULT_THRESHOLDS[activeGas];

  const handleFieldChange = (field: keyof GasThreshold, val: number) => {
    setLocalThresholds(prev => ({
      ...prev,
      [activeGas]: {
        ...prev[activeGas],
        [field]: Number(val),
      },
    }));
  };

  const handleApplyPreset = (preset: 'ISO' | 'STRICT' | 'DEFAULT') => {
    if (preset === 'DEFAULT' || preset === 'ISO') {
      setLocalThresholds({ ...DEFAULT_THRESHOLDS });
    } else if (preset === 'STRICT') {
      // Tighter 5% margin for ICU / OR
      const strict: Record<GasCode, GasThreshold> = {
        O2: { nominal: 4.0, minCrit: 3.4, minWarn: 3.8, maxWarn: 4.3, maxCrit: 4.6, unit: 'bar' },
        MA4: { nominal: 4.0, minCrit: 3.4, minWarn: 3.8, maxWarn: 4.3, maxCrit: 4.6, unit: 'bar' },
        SA7: { nominal: 7.0, minCrit: 6.2, minWarn: 6.6, maxWarn: 7.5, maxCrit: 8.0, unit: 'bar' },
        VAC: { nominal: -65.0, minCrit: -50.0, minWarn: -60.0, maxWarn: -75.0, maxCrit: -85.0, unit: 'kPa' },
        N2O: { nominal: 4.0, minCrit: 3.4, minWarn: 3.8, maxWarn: 4.3, maxCrit: 4.6, unit: 'bar' },
        CO2: { nominal: 4.0, minCrit: 3.4, minWarn: 3.8, maxWarn: 4.3, maxCrit: 4.6, unit: 'bar' },
      };
      setLocalThresholds(strict);
    }
  };

  const handleSave = () => {
    onSaveThresholds(localThresholds);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 800);
  };

  const gasList: Array<{ code: GasCode; name: string }> = [
    { code: 'O2', name: 'ออกซิเจน (O2)' },
    { code: 'MA4', name: 'อากาศทางการแพทย์ 4 bar (MA4)' },
    { code: 'SA7', name: 'อากาศผ่าตัด 7 bar (SA7)' },
    { code: 'VAC', name: 'สุญญากาศ (VAC)' },
    { code: 'N2O', name: 'ไนตรัสออกไซด์ (N2O)' },
    { code: 'CO2', name: 'คาร์บอนไดออกไซด์ (CO2)' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col justify-between">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900/95 backdrop-blur z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-white">
                ตั้งค่าขอบเขตเกณฑ์แรงดัน (Threshold Calibration)
              </h2>
              <p className="text-xs text-slate-400">
                กำหนดจุดตัดแจ้งเตือนเตือนภัยสำหรับแต่ละชนิดก๊าซทางการแพทย์
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-5 space-y-5">
          {/* Preset Buttons */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-semibold text-slate-300">พรีเซ็ตมาตรฐานสากล:</span>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => handleApplyPreset('ISO')}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700"
              >
                ISO 7396-1
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('STRICT')}
                className="px-2.5 py-1 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 text-xs font-medium border border-cyan-800"
              >
                ICU / OR เคร่งครัด (±5%)
              </button>
              <button
                type="button"
                onClick={() => handleApplyPreset('DEFAULT')}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 text-xs font-medium border border-slate-700 flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>รีเซ็ต</span>
              </button>
            </div>
          </div>

          {/* Gas Selector Buttons */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {gasList.map(g => (
              <button
                key={g.code}
                onClick={() => setActiveGas(g.code)}
                className={`p-2.5 rounded-xl text-left border transition-all text-xs ${
                  activeGas === g.code
                    ? 'bg-slate-800 border-cyan-500 text-white font-semibold'
                    : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className="font-mono font-bold block">{g.code}</span>
                <span className="text-[11px] truncate block opacity-80">{g.name}</span>
              </button>
            ))}
          </div>

          {/* Active Gas Threshold Inputs */}
          <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <span className="font-semibold text-sm text-cyan-300">
                เกณฑ์กำหนดก๊าซ {activeGas} (หน่วย: {currentThresh.unit})
              </span>
              <span className="text-xs text-slate-400 font-mono">
                Nominal: {currentThresh.nominal} {currentThresh.unit}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              {/* Min Critical */}
              <div>
                <label className="block text-rose-400 font-semibold mb-1">
                  1. ต่ำวิกฤต (Critical Low Threshold)
                </label>
                <input
                  type="number"
                  step="0.05"
                  value={currentThresh.minCrit}
                  onChange={(e) => handleFieldChange('minCrit', Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-rose-900/60 text-white font-mono focus:outline-none focus:border-rose-500"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  ต่ำกว่าค่านี้จะส่งเสียงเตือนไซเรน Y4 และ NTFY ทันที
                </span>
              </div>

              {/* Min Warning */}
              <div>
                <label className="block text-amber-400 font-semibold mb-1">
                  2. เริ่มต่ำกว่าเกณฑ์ (Warning Low Threshold)
                </label>
                <input
                  type="number"
                  step="0.05"
                  value={currentThresh.minWarn}
                  onChange={(e) => handleFieldChange('minWarn', Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-amber-900/60 text-white font-mono focus:outline-none focus:border-amber-500"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  แจ้งเตือนล่วงหน้าให้ตรวจสอบปริมาณก๊าซในถัง
                </span>
              </div>

              {/* Max Warning */}
              <div>
                <label className="block text-amber-400 font-semibold mb-1">
                  3. เริ่มสูงเกินเกณฑ์ (Warning High Threshold)
                </label>
                <input
                  type="number"
                  step="0.05"
                  value={currentThresh.maxWarn}
                  onChange={(e) => handleFieldChange('maxWarn', Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-amber-900/60 text-white font-mono focus:outline-none focus:border-amber-500"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  เตือนเมื่อเรกูเลเตอร์เริ่มจ่ายแรงดันเกิน
                </span>
              </div>

              {/* Max Critical */}
              <div>
                <label className="block text-rose-400 font-semibold mb-1">
                  4. สูงวิกฤต (Critical High Threshold)
                </label>
                <input
                  type="number"
                  step="0.05"
                  value={currentThresh.maxCrit}
                  onChange={(e) => handleFieldChange('maxCrit', Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-rose-900/60 text-white font-mono focus:outline-none focus:border-rose-500"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  สูงอันตรายต่อเครื่องช่วยหายใจหรือท่อก๊าซ
                </span>
              </div>
            </div>

            {/* Target Nominal */}
            <div className="pt-2">
              <label className="block text-slate-300 font-medium mb-1">
                ค่าแรงดันเป้าหมายปกติ (Nominal Reference)
              </label>
              <input
                type="number"
                step="0.1"
                value={currentThresh.nominal}
                onChange={(e) => handleFieldChange('nominal', Number(e.target.value))}
                className="w-full sm:w-1/2 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-slate-800 bg-slate-900/95 sticky bottom-0 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-400">
            {saveSuccess ? (
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <Check className="w-4 h-4" /> บันทึกและปรับปรุงระบบเรียบร้อย
              </span>
            ) : (
              <span>ค่าที่ตั้งจะถูกบันทึกลงเบราว์เซอร์และใช้เปรียบเทียบทันที</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 shadow-md shadow-cyan-950/40 transition-colors flex items-center gap-1.5"
            >
              <Check className="w-4 h-4" />
              <span>บันทึกเกณฑ์แรงดัน</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
