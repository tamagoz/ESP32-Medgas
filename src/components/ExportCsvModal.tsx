import React, { useState } from 'react';
import { Calendar, Check, Download, FileSpreadsheet, Filter, X } from 'lucide-react';
import { GasChannel, GasCode, HistoricalReading, RelayItem } from '../types/medgas';
import { downloadCsvFile, generateMedicalGasCsv } from '../services/storage';

interface ExportCsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  history: HistoricalReading[];
  gases: GasChannel[];
  relays: RelayItem[];
}

export const ExportCsvModal: React.FC<ExportCsvModalProps> = ({
  isOpen,
  onClose,
  history,
  gases,
  relays,
}) => {
  const [stationName, setStationName] = useState('Medical Gas Supply - Central Manifold Ward 3');
  const [gasFilter, setGasFilter] = useState<GasCode | 'ALL'>('ALL');
  const [timeFilter, setTimeFilter] = useState<'1h' | '24h' | '7d' | 'ALL'>('24h');
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);

  if (!isOpen) return null;

  const now = Date.now();
  let startDate: number | undefined;
  if (timeFilter === '1h') startDate = now - 1 * 60 * 60 * 1000;
  else if (timeFilter === '24h') startDate = now - 24 * 60 * 60 * 1000;
  else if (timeFilter === '7d') startDate = now - 7 * 24 * 60 * 60 * 1000;

  let recordsCount = history.length;
  if (startDate) {
    recordsCount = history.filter(h => h.timestamp >= startDate!).length;
  }
  if (gasFilter !== 'ALL') {
    recordsCount = history.filter(h => (startDate ? h.timestamp >= startDate! : true) && h.gasCode === gasFilter).length;
  }

  const handleDownload = () => {
    setIsExporting(true);
    try {
      const csv = generateMedicalGasCsv(history, gases, relays, {
        startDate,
        endDate: now,
        gasFilter,
        stationName,
      });

      const dateTag = new Date().toISOString().slice(0, 10);
      downloadCsvFile(csv, `medgas_report_${gasFilter.toLowerCase()}_${dateTag}.csv`);
      setExportSuccess(true);
      setTimeout(() => {
        setExportSuccess(false);
        onClose();
      }, 1200);
    } catch (e) {
      console.error(e);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">
                ส่งออกรายงานข้อมูลสรุป (Export CSV Report)
              </h2>
              <p className="text-xs text-slate-400">
                พร้อมหัวตารางสถิติและค่าประวัติย้อนหลัง รองรับ Excel / Google Sheets
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

        {/* Form Body */}
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              ชื่อสถานี / หอผู้ป่วย (Station Name)
            </label>
            <input
              type="text"
              value={stationName}
              onChange={(e) => setStationName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                ช่วงเวลาย้อนหลัง
              </label>
              <select
                value={timeFilter}
                onChange={(e) => setTimeFilter(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
              >
                <option value="1h">1 ชั่วโมงล่าสุด</option>
                <option value="24h">24 ชั่วโมงล่าสุด</option>
                <option value="7d">7 วันล่าสุด</option>
                <option value="ALL">บันทึกทั้งหมดที่มีในเครื่อง</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                เลือกชนิดก๊าซ
              </label>
              <select
                value={gasFilter}
                onChange={(e) => setGasFilter(e.target.value as any)}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-cyan-500"
              >
                <option value="ALL">ทั้งหมด (All 6 Gases)</option>
                <option value="O2">O2 (Oxygen)</option>
                <option value="MA4">MA4 (Medical Air 4 bar)</option>
                <option value="SA7">SA7 (Surgical Air 7 bar)</option>
                <option value="VAC">VAC (Medical Vacuum)</option>
                <option value="N2O">N2O (Nitrous Oxide)</option>
                <option value="CO2">CO2 (Carbon Dioxide)</option>
              </select>
            </div>
          </div>

          {/* Summary Preview Box */}
          <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800/80 space-y-1.5 text-xs">
            <div className="flex justify-between text-slate-300">
              <span>จำนวนบันทึกที่จะส่งออก:</span>
              <span className="font-mono font-bold text-cyan-400">{recordsCount} แถว</span>
            </div>
            <div className="flex justify-between text-slate-400 text-[11px]">
              <span>การเข้ารหัสภาษาไทย:</span>
              <span className="text-emerald-400">UTF-8 with BOM (ภาษาไทยไม่เป็นภาษาต่างดาว)</span>
            </div>
            <div className="flex justify-between text-slate-400 text-[11px]">
              <span>ข้อมูลประกอบ:</span>
              <span>สถานะ Relay Y1-Y6, เกณฑ์ขอบเขต, แหล่งจ่าย Manifold</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-800 flex items-center justify-between">
          <div className="text-xs">
            {exportSuccess && (
              <span className="text-emerald-400 font-semibold flex items-center gap-1">
                <Check className="w-4 h-4" /> ดาวน์โหลดไฟล์สำเร็จแล้ว
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={isExporting}
              className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 shadow-md shadow-cyan-950/40 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isExporting ? 'กำลังสร้างไฟล์...' : 'ดาวน์โหลดรายงาน CSV'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
