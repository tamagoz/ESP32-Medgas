import React, { useState } from 'react';
import { Cpu, Globe, Info, RefreshCw, Save, Server, Shield, Wifi, X, Zap } from 'lucide-react';
import { ConnectionConfig, DeviceTelemetry } from '../types/medgas';

interface HardwareWifiModalProps {
  isOpen: boolean;
  onClose: () => void;
  connectionConfig: ConnectionConfig;
  onSaveConnection: (config: ConnectionConfig) => void;
  telemetry: DeviceTelemetry;
  onScanWifi: () => Promise<Array<{ ssid: string; rssi: number }>>;
  onSaveDeviceWifi: (ssid: string, pass: string) => Promise<boolean>;
}

export const HardwareWifiModal: React.FC<HardwareWifiModalProps> = ({
  isOpen,
  onClose,
  connectionConfig,
  onSaveConnection,
  telemetry,
  onScanWifi,
  onSaveDeviceWifi,
}) => {
  const [localConfig, setLocalConfig] = useState<ConnectionConfig>({ ...connectionConfig });
  const [wifiSsid, setWifiSsid] = useState('');
  const [wifiPass, setWifiPass] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [scanResults, setScanResults] = useState<Array<{ ssid: string; rssi: number }>>([]);
  const [isSavingWifi, setIsSavingWifi] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; error?: boolean } | null>(null);

  if (!isOpen) return null;

  const handleSaveConn = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveConnection(localConfig);
    setStatusMsg({ text: 'บันทึกการตั้งค่าการเชื่อมต่อสำเร็จ' });
    setTimeout(() => {
      setStatusMsg(null);
      onClose();
    }, 1000);
  };

  const handleScan = async () => {
    setIsScanning(true);
    setStatusMsg(null);
    try {
      const results = await onScanWifi();
      setScanResults(results);
    } catch (e: any) {
      setStatusMsg({ text: 'สแกน WiFi ไม่สำเร็จ (ตรวจการเชื่อมต่อกับบอร์ด)', error: true });
    } finally {
      setIsScanning(false);
    }
  };

  const handleSaveWifiToBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wifiSsid) return;
    setIsSavingWifi(true);
    setStatusMsg(null);
    try {
      const ok = await onSaveDeviceWifi(wifiSsid, wifiPass);
      if (ok) {
        setStatusMsg({ text: 'บันทึก WiFi ลง ESP32 (NVS) แล้ว บอร์ดกำลังรีบูตเพื่อเชื่อมต่อ...' });
      } else {
        setStatusMsg({ text: 'บันทึกไม่สำเร็จ ตรวจสอบ IP บอร์ด', error: true });
      }
    } catch (e: any) {
      setStatusMsg({ text: e.message || 'เกิดข้อผิดพลาดในการบันทึก', error: true });
    } finally {
      setIsSavingWifi(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col justify-between">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900/95 backdrop-blur z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-white">
                การเชื่อมต่อฮาร์ดแวร์ & WiFi (Medgas Master v3.1)
              </h2>
              <p className="text-xs text-slate-400">
                กำหนดการเชื่อมต่อ REST API กับบอร์ด NOOB-MINI-C3 (ESP32-C3)
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

        {/* Content */}
        <div className="p-5 space-y-6">
          {/* Section 1: Connection Mode */}
          <form onSubmit={handleSaveConn} className="space-y-4">
            <h3 className="text-sm font-semibold text-cyan-300 flex items-center gap-2">
              <Globe className="w-4 h-4" />
              <span>1. โหมดการเชื่อมต่อข้อมูล (Connection Target)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {[
                {
                  id: 'SIMULATOR',
                  title: 'โหมดจำลอง (Sim)',
                  desc: 'ทดสอบระบบทันที มีข้อมูลและแจ้งเตือนจำลองสมบูรณ์แบบ',
                },
                {
                  id: 'DIRECT',
                  title: 'เชื่อมต่อตรง ESP32',
                  desc: 'ต่อ WiFi บอร์ด Medgas-XXXX (http://192.168.4.1 หรือ mDNS)',
                },
                {
                  id: 'PROXY',
                  title: 'ผ่าน Proxy Server',
                  desc: 'ส่งผ่านเซิร์ฟเวอร์ช่วยข้ามปัญหา CORS / Mixed Content',
                },
              ].map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setLocalConfig({ ...localConfig, mode: m.id as any })}
                  className={`p-3 rounded-xl text-left border transition-all ${
                    localConfig.mode === m.id
                      ? 'bg-cyan-950/40 border-cyan-500 text-white shadow-sm'
                      : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className="font-semibold text-xs block text-slate-200 mb-1">{m.title}</span>
                  <span className="text-[11px] text-slate-400 leading-snug block">{m.desc}</span>
                </button>
              ))}
            </div>

            {localConfig.mode !== 'SIMULATOR' && (
              <div className="space-y-3 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    URL ของอุปกรณ์ Medgas Master v3.1
                  </label>
                  <input
                    type="url"
                    value={localConfig.targetUrl}
                    onChange={(e) => setLocalConfig({ ...localConfig, targetUrl: e.target.value })}
                    placeholder="http://192.168.4.1"
                    className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:border-cyan-500 font-mono"
                  />
                  <div className="flex items-center gap-2 mt-1.5 text-[11px] text-slate-400">
                    <span>แนะนำ:</span>
                    <button
                      type="button"
                      onClick={() => setLocalConfig({ ...localConfig, targetUrl: 'http://192.168.4.1' })}
                      className="text-cyan-400 hover:underline"
                    >
                      http://192.168.4.1 (AP ตรง)
                    </button>
                    <span>·</span>
                    <button
                      type="button"
                      onClick={() => setLocalConfig({ ...localConfig, targetUrl: 'http://medgas.local' })}
                      className="text-cyan-400 hover:underline"
                    >
                      http://medgas.local (mDNS)
                    </button>
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              <span>นำการตั้งค่าโหมดการเชื่อมต่อนี้ไปใช้</span>
            </button>
          </form>

          {/* Section 2: WiFi Setup on Board via REST API /save */}
          <div className="pt-4 border-t border-slate-800 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
                <Wifi className="w-4 h-4 text-emerald-400" />
                <span>2. ตั้งค่า WiFi ให้บอร์ด ESP32 เชื่อมต่อกับ Router รพ. (STA Mode)</span>
              </h3>
              <button
                type="button"
                onClick={handleScan}
                disabled={isScanning}
                className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
              >
                <RefreshCw className={`w-3 h-3 ${isScanning ? 'animate-spin' : ''}`} />
                <span>{isScanning ? 'กำลังสแกน...' : 'สแกน WiFi'}</span>
              </button>
            </div>

            {scanResults.length > 0 && (
              <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 max-h-36 overflow-y-auto space-y-1">
                <span className="text-[11px] font-semibold text-slate-400 block mb-1">
                  เครือข่าย WiFi ที่ตรวจพบรอบข้าง:
                </span>
                {scanResults.map((net, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setWifiSsid(net.ssid)}
                    className="w-full text-left px-2 py-1 rounded hover:bg-slate-900 text-xs flex items-center justify-between text-slate-300 transition-colors"
                  >
                    <span className="font-mono">{net.ssid}</span>
                    <span className="text-[11px] text-slate-500 font-mono">{net.rssi} dBm</span>
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={handleSaveWifiToBoard} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">SSID เครือข่าย</label>
                <input
                  type="text"
                  value={wifiSsid}
                  onChange={(e) => setWifiSsid(e.target.value)}
                  placeholder="ชื่อ WiFi รพ. หรือเราเตอร์"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-cyan-500 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">รหัสผ่าน WiFi</label>
                <input
                  type="password"
                  value={wifiPass}
                  onChange={(e) => setWifiPass(e.target.value)}
                  placeholder="รหัสผ่าน (ถ้ามี)"
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-xs focus:outline-none focus:border-cyan-500 font-mono"
                />
              </div>

              <div className="sm:col-span-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isSavingWifi || !wifiSsid}
                  className="py-2 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isSavingWifi ? 'กำลังบันทึกลง ESP32...' : 'บันทึกและเชื่อมต่อ (POST /save)'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Section 3: Hardware Pinout Reference */}
          <div className="pt-4 border-t border-slate-800 space-y-3">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-indigo-400" />
              <span>3. ข้อมูลฮาร์ดแวร์บอร์ด NOOB-MINI-C3 (ESP32-C3)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                <span className="font-semibold text-cyan-300 block mb-1">รีเลย์ 6 ช่อง (Y1-Y6)</span>
                <p className="text-slate-400 text-[11px]">
                  GPIO 0, 1, 2, 3, 4, 10 โดย Y3 (GPIO2) เป็นค่าเริ่มต้น ON
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                <span className="font-semibold text-emerald-300 block mb-1">RS-485 Modbus</span>
                <p className="text-slate-400 text-[11px]">
                  Hardware UART1: GPIO20 (RX), GPIO21 (TX) ที่ความเร็ว 9600 Baud
                </p>
              </div>

              <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800">
                <span className="font-semibold text-amber-300 block mb-1">ปุ่ม ACK Reset</span>
                <p className="text-slate-400 text-[11px]">
                  GPIO 9 (ปุ่ม BOOT) กดค้าง 5 วินาที เพื่อล้าง NVS WiFi
                </p>
              </div>
            </div>
          </div>

          {statusMsg && (
            <div
              className={`p-3 rounded-xl text-xs flex items-center gap-2 ${
                statusMsg.error
                  ? 'bg-rose-950/70 border border-rose-500/50 text-rose-300'
                  : 'bg-emerald-950/70 border border-emerald-500/50 text-emerald-300'
              }`}
            >
              <Info className="w-4 h-4 shrink-0" />
              <span>{statusMsg.text}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
