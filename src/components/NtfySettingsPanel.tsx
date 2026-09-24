import React, { useState } from 'react';
import { AlertTriangle, Bell, BellRing, Check, ExternalLink, QrCode, Send, ShieldCheck, Smartphone } from 'lucide-react';
import { NtfyConfig } from '../types/medgas';
import { sendNtfyNotification } from '../services/ntfy';

interface NtfySettingsPanelProps {
  config: NtfyConfig;
  onSaveConfig: (newConfig: NtfyConfig) => void;
}

export const NtfySettingsPanel: React.FC<NtfySettingsPanelProps> = ({
  config,
  onSaveConfig,
}) => {
  const [formData, setFormData] = useState<NtfyConfig>({ ...config });
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showQr, setShowQr] = useState(false);

  const handleToggleEnabled = (val: boolean) => {
    const updated = { ...formData, enabled: val };
    setFormData(updated);
    onSaveConfig(updated);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveConfig(formData);
    setTestResult({ success: true, message: 'บันทึกการตั้งค่าการแจ้งเตือน NTFY สำเร็จ' });
    setTimeout(() => setTestResult(null), 3000);
  };

  const handleTestAlert = async () => {
    setIsTesting(true);
    setTestResult(null);

    const res = await sendNtfyNotification(formData, {
      title: '🚨 [ทดสอบระบบ] Medgas Master v3.1 Alert',
      message: `การทดสอบการแจ้งเตือนระบบแรงดันก๊าซทางการแพทย์\nสถานี: Medgas Master v3.1 (ESP32-C3)\nเวลาทดสอบ: ${new Date().toLocaleTimeString('th-TH')}\nสถานะ: ปกติพร้อมใช้งานบน iOS และ Android`,
      priority: 'high',
      tags: 'white_check_mark,hospital,syringe',
      force: true,
    });

    setIsTesting(false);
    setTestResult(res);
  };

  const topicUrl = `${(formData.serverUrl || 'https://ntfy.sh').replace(/\/+$/, '')}/${encodeURIComponent(formData.topic || '')}`;

  return (
    <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 shadow-sm space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <BellRing className="w-4 h-4" />
            </div>
            <h2 className="text-base sm:text-lg font-semibold text-white">
              ระบบแจ้งเตือนผ่าน NTFY Notify (iOS & Android)
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            รับการแจ้งเตือน Push Notification เข้ามือถือทันทีเมื่อค่าแรงดันก๊าซอยู่นอกเกณฑ์ หรือสถานะรีเลย์เปลี่ยน
          </p>
        </div>

        {/* Enable / Disable Master Switch */}
        <label className="flex items-center gap-3 cursor-pointer bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 self-start sm:self-auto">
          <span className="text-xs font-medium text-slate-300">
            {formData.enabled ? 'เปิดระบบแจ้งเตือน' : 'ปิดระบบแจ้งเตือน'}
          </span>
          <div className="relative">
            <input
              type="checkbox"
              className="sr-only"
              checked={formData.enabled}
              onChange={(e) => handleToggleEnabled(e.target.checked)}
            />
            <div
              className={`w-10 h-6 rounded-full transition-colors ${
                formData.enabled ? 'bg-cyan-500' : 'bg-slate-700'
              }`}
            />
            <div
              className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                formData.enabled ? 'translate-x-4' : ''
              }`}
            />
          </div>
        </label>
      </div>

      {/* Main Settings Form */}
      <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              NTFY Server URL
            </label>
            <input
              type="url"
              value={formData.serverUrl}
              onChange={(e) => setFormData({ ...formData, serverUrl: e.target.value })}
              placeholder="https://ntfy.sh"
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:border-cyan-500 font-mono"
            />
            <span className="text-[11px] text-slate-500 mt-1 block">
              ใช้เซิร์ฟเวอร์ฟรีมาตรฐาน <code className="text-cyan-400">https://ntfy.sh</code> หรือเซิร์ฟเวอร์ภายใน รพ. (Self-hosted)
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              หัวข้อแจ้งเตือน (Topic Name)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={formData.topic}
                onChange={(e) => setFormData({ ...formData, topic: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '') })}
                placeholder="medgas-icu-ward"
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:border-cyan-500 font-mono"
                required
              />
            </div>
            <span className="text-[11px] text-slate-500 mt-1 block">
              ชื่อ Topic สำหรับสมัครรับแจ้งเตือนบนแอป NTFY (ควรตั้งชื่อเฉพาะของแผนก)
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                ระดับความสำคัญ (Priority)
              </label>
              <select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value as any })}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:border-cyan-500"
              >
                <option value="urgent">สูงสุด (Urgent - ปลุกเครื่อง)</option>
                <option value="high">สูง (High - แจ้งเตือนดัง)</option>
                <option value="default">มาตรฐาน (Default)</option>
                <option value="low">ต่ำ (Low - ไร้เสียง)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                ระยะหน่วงเตือนซ้ำ (Cooldown)
              </label>
              <select
                value={formData.cooldownSeconds}
                onChange={(e) => setFormData({ ...formData, cooldownSeconds: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 text-sm focus:outline-none focus:border-cyan-500"
              >
                <option value={30}>30 วินาที</option>
                <option value={60}>60 วินาที (แนะนำ)</option>
                <option value={120}>2 นาที</option>
                <option value={300}>5 นาที</option>
              </select>
            </div>
          </div>
        </div>

        {/* Triggers & Test Box */}
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">
              เงื่อนไขการส่งแจ้งเตือน (Notification Triggers)
            </label>
            <div className="space-y-2 bg-slate-950/70 p-3 rounded-xl border border-slate-800/80">
              <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.notifyOnCrit}
                  onChange={(e) => setFormData({ ...formData, notifyOnCrit: e.target.checked })}
                  className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                />
                <span className="font-medium text-rose-400">แรงดันวิกฤต (Critical High / Low)</span>
              </label>

              <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.notifyOnWarn}
                  onChange={(e) => setFormData({ ...formData, notifyOnWarn: e.target.checked })}
                  className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                />
                <span className="text-amber-400">แรงดันเริ่มออกนอกเกณฑ์ปกติ (Warning High / Low)</span>
              </label>

              <label className="flex items-center gap-2.5 text-xs text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.notifyOnRelayChange}
                  onChange={(e) => setFormData({ ...formData, notifyOnRelayChange: e.target.checked })}
                  className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                />
                <span className="text-cyan-300">การสลับสถานะรีเลย์ฮาร์ดแวร์ (Y1 - Y6 Switchover)</span>
              </label>
            </div>
          </div>

          {/* Test & Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
            <button
              type="button"
              onClick={handleTestAlert}
              disabled={isTesting || !formData.topic}
              className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold flex items-center justify-center gap-2 border border-slate-700 transition-colors disabled:opacity-50"
            >
              <Send className={`w-3.5 h-3.5 ${isTesting ? 'animate-bounce text-cyan-400' : ''}`} />
              <span>{isTesting ? 'กำลังส่งทดสอบ...' : 'ทดสอบส่งข้อความแจ้งเตือน (Test Alert)'}</span>
            </button>

            <button
              type="submit"
              className="py-2.5 px-6 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center justify-center gap-2 shadow-md shadow-cyan-950/40 transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              <span>บันทึกการตั้งค่า</span>
            </button>
          </div>

          {testResult && (
            <div
              className={`p-3 rounded-xl text-xs flex items-start gap-2 ${
                testResult.success
                  ? 'bg-emerald-950/70 border border-emerald-500/50 text-emerald-300'
                  : 'bg-rose-950/70 border border-rose-500/50 text-rose-300'
              }`}
            >
              {testResult.success ? (
                <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-400" />
              ) : (
                <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
              )}
              <div className="flex-1">
                <span className="font-semibold">{testResult.success ? 'สำเร็จ:' : 'เกิดข้อผิดพลาด:'}</span>{' '}
                <span>{testResult.message}</span>
              </div>
            </div>
          )}
        </div>
      </form>

      {/* Step-by-Step Mobile Instructions (iOS & Android) */}
      <div className="pt-4 border-t border-slate-800">
        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
          <Smartphone className="w-4 h-4 text-cyan-400" />
          <span>วิธีติดตั้งรับการแจ้งเตือนบนสมาร์ตโฟน (iOS & Android)</span>
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* iOS Card */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200">📱 ระบบปฏิบัติการ iOS (iPhone / iPad)</span>
              <span className="text-[10px] text-cyan-400 font-mono">App Store</span>
            </div>
            <ol className="list-decimal list-inside space-y-1.5 text-slate-400 pl-1">
              <li>ดาวน์โหลดแอป <strong>"ntfy"</strong> จาก Apple App Store (ฟรี ไม่มีโฆษณา)</li>
              <li>เปิดแอป กดปุ่ม <strong>+ (Subscribe)</strong></li>
              <li>
                กรอก Topic: <code className="text-cyan-300 font-mono font-bold">{formData.topic}</code>
              </li>
              <li>กด <strong>Subscribe</strong> เพื่อเริ่มรับแจ้งเตือนเตือนภัยแรงดันก๊าซได้ทันที</li>
            </ol>
            <div className="pt-1">
              <a
                href={topicUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-cyan-400 hover:underline"
              >
                <span>เปิด Topic บนเบราว์เซอร์ Safari</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>

          {/* Android Card */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-200">🤖 ระบบปฏิบัติการ Android</span>
              <span className="text-[10px] text-emerald-400 font-mono">Google Play / F-Droid</span>
            </div>
            <ol className="list-decimal list-inside space-y-1.5 text-slate-400 pl-1">
              <li>ดาวน์โหลดแอป <strong>"ntfy"</strong> จาก Google Play Store</li>
              <li>เปิดแอป กดปุ่มเครื่องหมายบวก <strong>+</strong> เพื่อเพิ่มหัวข้อ</li>
              <li>
                พิมพ์ชื่อหัวข้อ: <code className="text-cyan-300 font-mono font-bold">{formData.topic}</code>
              </li>
              <li>ตั้งค่าสิทธิ์ให้แอปทำงานเบื้องหลัง (Background Notification) ได้ตลอด 24 ชม.</li>
            </ol>
            <div className="pt-1">
              <a
                href={`https://play.google.com/store/apps/details?id=io.heckel.ntfy`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[11px] text-emerald-400 hover:underline"
              >
                <span>ลิงก์ไปยัง Google Play Store</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
