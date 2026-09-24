import React, { useState } from 'react';
import {
  Apple,
  Check,
  Chrome,
  Cpu,
  Download,
  ExternalLink,
  Laptop,
  Monitor,
  Share2,
  Smartphone,
  Terminal,
  X,
  Zap,
} from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PWAInstallModal: React.FC<PWAInstallModalProps> = ({ isOpen, onClose }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [activeTab, setActiveTab] = useState<'app' | 'hardware'>('app');
  const [installing, setInstalling] = useState(false);
  const [installedSuccess, setInstalledSuccess] = useState(false);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    setInstalling(true);
    const accepted = await install();
    setInstalling(false);
    if (accepted) {
      setInstalledSuccess(true);
      setTimeout(() => {
        setInstalledSuccess(false);
        onClose();
      }, 1500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col justify-between">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900/95 backdrop-blur z-10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-semibold text-white">
                ติดตั้งระบบ Medgas Master v3.1 ลงเครื่อง
              </h2>
              <p className="text-xs text-slate-400">
                ติดตั้งเป็นแอป PWA บนมือถือ/คอมพิวเตอร์ หรือ แฟลชลงบอร์ด ESP32-C3
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

        {/* Tab Navigation */}
        <div className="px-5 pt-4 pb-2 border-b border-slate-800/80 flex items-center gap-2">
          <button
            onClick={() => setActiveTab('app')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
              activeTab === 'app'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>1. ติดตั้งเป็นแอปบนมือถือ / PC (PWA)</span>
          </button>
          <button
            onClick={() => setActiveTab('hardware')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
              activeTab === 'hardware'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>2. แฟลชลงบอร์ด ESP32-C3</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 space-y-4">
          {activeTab === 'app' && (
            <div className="space-y-4">
              {/* If browser supports beforeinstallprompt */}
              {isInstallable && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-cyan-950/70 to-blue-950/70 border border-cyan-500/40 text-center space-y-2">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-400 flex items-center justify-center mx-auto mb-2">
                    <Download className="w-6 h-6 animate-bounce" />
                  </div>
                  <h3 className="font-bold text-white text-base">พร้อมติดตั้งลงเครื่องทันที (1-Click Install)</h3>
                  <p className="text-xs text-slate-300">
                    เบราว์เซอร์ของคุณรองรับการติดตั้งแอปแบบ Standalone สามารถกดติดตั้งเพื่อใช้งานเสมือนแอปแท้ได้ทันที
                  </p>
                  <button
                    onClick={handleInstallClick}
                    disabled={installing}
                    className="w-full mt-2 py-3 px-4 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/30 transition-all active:scale-[0.98]"
                  >
                    <Download className="w-4 h-4" />
                    <span>{installing ? 'กำลังติดตั้ง...' : 'กดติดตั้งแอป Medgas v3.1 เดี๋ยวนี้'}</span>
                  </button>
                </div>
              )}

              {isInstalled && (
                <div className="p-3.5 rounded-xl bg-emerald-950/70 border border-emerald-500/50 text-emerald-300 text-xs flex items-center gap-2">
                  <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                  <span>แอปพลิเคชันนี้ได้รับการติดตั้งลงบนอุปกรณ์ของคุณแล้ว (Standalone Mode)</span>
                </div>
              )}

              {/* Instructions by OS */}
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-slate-300">
                  ขั้นตอนการติดตั้งตามระบบปฏิบัติการ:
                </h4>

                {/* iOS Instructions */}
                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-slate-200 text-xs font-bold">
                    <Apple className="w-4 h-4 text-slate-300" />
                    <span>iPhone / iPad (iOS Safari)</span>
                  </div>
                  <ol className="list-decimal list-inside text-[11px] text-slate-400 space-y-1 pl-1">
                    <li>เปิดหน้านี้บนเบราว์เซอร์ <strong>Safari</strong></li>
                    <li>
                      แตะปุ่ม <strong>แชร์ (Share Icon)</strong> <Share2 className="w-3 h-3 inline text-cyan-400" /> ที่แถบเมนูด้านล่าง
                    </li>
                    <li>
                      เลื่อนลงมาแล้วเลือก <strong>"เพิ่มไปยังหน้าจอโฮม" (Add to Home Screen)</strong>
                    </li>
                    <li>แตะ <strong>"เพิ่ม" (Add)</strong> เพื่อติดตั้งไอคอนลงบนหน้าจอ iPhone ของคุณ</li>
                  </ol>
                </div>

                {/* Android Instructions */}
                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-slate-200 text-xs font-bold">
                    <Smartphone className="w-4 h-4 text-emerald-400" />
                    <span>Android (Google Chrome / Samsung Internet)</span>
                  </div>
                  <ol className="list-decimal list-inside text-[11px] text-slate-400 space-y-1 pl-1">
                    <li>เปิดเมนูจุด 3 จุด (<strong>⋮</strong>) ที่มุมบนขวาของ Chrome</li>
                    <li>เลือก <strong>"ติดตั้งแอป" (Install app)</strong> หรือ <strong>"เพิ่มลงในหน้าจอหลัก"</strong></li>
                    <li>กดยืนยัน <strong>"ติดตั้ง" (Install)</strong> เพื่อเปิดใช้งานแบบเต็มจอและรับการแจ้งเตือน NTFY</li>
                  </ol>
                </div>

                {/* Desktop Instructions */}
                <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-2">
                  <div className="flex items-center gap-2 text-slate-200 text-xs font-bold">
                    <Monitor className="w-4 h-4 text-cyan-400" />
                    <span>Windows / macOS (Chrome / Edge)</span>
                  </div>
                  <p className="text-[11px] text-slate-400">
                    มองหาไอคอน <strong>"ติดตั้งแอป" (Install icon)</strong> บนแถบที่อยู่ URL ด้านขวาบนของเบราว์เซอร์ แล้วคลิกเพื่อติดตั้งเป็นโปรแกรมเดสก์ท็อป
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'hardware' && (
            <div className="space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
                <span className="font-bold text-white block">
                  ขั้นตอนการอัปโหลดโค้ดลงบอร์ด NOOB-MINI-C3 (ESP32-C3):
                </span>
                <p className="text-slate-400">
                  ไฟล์โค้ดของระบบนี้คือ <code className="text-cyan-300 font-mono">Medgas Master v3.1.0.ino</code> ซึ่งรวบรวม REST API, WiFi AP+STA, mDNS, RS-485 และ Relay ไว้ในไฟล์เดียว
                </p>
              </div>

              <div className="space-y-2">
                <span className="font-semibold text-slate-300 block">คำสั่งอัปโหลดผ่าน Arduino-CLI:</span>
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 font-mono text-[11px] text-cyan-300 overflow-x-auto space-y-1.5">
                  <p className="text-slate-500"># คอมไพล์และเปิดใช้งาน USB CDC On Boot</p>
                  <p>arduino-cli compile --fqbn "esp32:esp32:esp32c3:CDCOnBoot=cdc" .</p>
                  <p className="text-slate-500"># อัปโหลดลงบอร์ดผ่านพอร์ต COM</p>
                  <p>arduino-cli upload -p COM8 --fqbn "esp32:esp32:esp32c3:CDCOnBoot=cdc" .</p>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-300 space-y-1 text-[11px]">
                <span className="font-bold block">ข้อแนะนำในการตั้งค่า Arduino IDE:</span>
                <ul className="list-disc list-inside space-y-0.5 text-slate-300 pl-1">
                  <li>Board: <strong>ESP32C3 Dev Module</strong></li>
                  <li>USB CDC On Boot: <strong>Enabled</strong> (จำเป็นเพื่อให้พอร์ต Serial ทำงาน)</li>
                  <li>Partition Scheme: <strong>Default 4MB with spiffs / littlefs</strong></li>
                  <li>Library: ติดตั้ง <strong>ArduinoJson v6</strong> (bblanchon)</li>
                  <li>อัปโหลดโฟลเดอร์ <strong>data/</strong> (LittleFS) เพื่อเสิร์ฟหน้าเว็บ</li>
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-slate-800 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Medgas Master v3.1 &mdash; PWA Standalone Ready
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 transition-colors"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
};
