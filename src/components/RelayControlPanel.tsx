import React, { useState } from 'react';
import { AlertOctagon, Check, Power, ShieldAlert, Sparkles, Terminal, ToggleLeft, ToggleRight, Zap } from 'lucide-react';
import { RelayItem } from '../types/medgas';

interface RelayControlPanelProps {
  relays: RelayItem[];
  onToggleRelay: (relayId: number, newState: boolean) => Promise<boolean>;
  isUpdatingRelay: number | null;
}

export const RelayControlPanel: React.FC<RelayControlPanelProps> = ({
  relays,
  onToggleRelay,
  isUpdatingRelay,
}) => {
  const [lastActionMsg, setLastActionMsg] = useState<string | null>(null);

  const handleToggle = async (id: number, current: boolean) => {
    const targetState = !current;
    try {
      const ok = await onToggleRelay(id, targetState);
      if (ok) {
        setLastActionMsg(`สั่งการ Relay Y${id} -> ${targetState ? 'เปิด (ON)' : 'ปิด (OFF)'} สำเร็จ`);
        setTimeout(() => setLastActionMsg(null), 3000);
      }
    } catch (e: any) {
      setLastActionMsg(`ข้อผิดพลาด: ${e.message || 'ไม่สามารถติดต่อ ESP32 ได้'}`);
      setTimeout(() => setLastActionMsg(null), 4000);
    }
  };

  return (
    <div className="rounded-2xl bg-slate-900/80 border border-slate-800 p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
              <Zap className="w-4 h-4" />
            </div>
            <h2 className="text-base sm:text-lg font-semibold text-white">
              แผงควบคุมรีเลย์ฮาร์ดแวร์ (Relay Y1 - Y6)
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            เชื่อมต่อตรงกับคำสั่ง REST API: <code className="text-cyan-300 font-mono">POST /api/relay</code> บนบอร์ด NOOB-MINI-C3 (ESP32-C3)
          </p>
        </div>

        {lastActionMsg && (
          <div className="text-xs px-3 py-1.5 rounded-lg bg-cyan-950/70 border border-cyan-800/80 text-cyan-300 flex items-center gap-1.5 animate-fadeIn">
            <Terminal className="w-3.5 h-3.5" />
            <span>{lastActionMsg}</span>
          </div>
        )}
      </div>

      {/* Relays Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5 pt-4">
        {relays.map((relay) => {
          const isBusy = isUpdatingRelay === relay.id;
          const isOn = relay.state;

          return (
            <div
              key={relay.id}
              className={`rounded-xl p-3.5 border transition-all duration-200 flex flex-col justify-between ${
                isOn
                  ? 'bg-slate-900 border-emerald-500/40 shadow-sm shadow-emerald-950/20'
                  : 'bg-slate-950/60 border-slate-800/80'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-7 h-7 rounded-lg flex items-center justify-center font-mono font-bold text-xs ${
                        isOn
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                          : 'bg-slate-800 text-slate-400 border border-slate-700'
                      }`}
                    >
                      {relay.name}
                    </span>
                    <div>
                      <h4 className="font-semibold text-sm text-slate-200 leading-tight">
                        {relay.labelTh}
                      </h4>
                      <span className="text-[11px] font-mono text-slate-400">
                        GPIO {relay.pin} {relay.defaultOn && '· (Boot Default ON)'}
                      </span>
                    </div>
                  </div>

                  {/* Relay Status Indicator Light */}
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isOn ? 'bg-emerald-400 shadow-sm shadow-emerald-400 animate-pulse' : 'bg-slate-600'
                      }`}
                    />
                    <span
                      className={`text-xs font-mono font-bold ${
                        isOn ? 'text-emerald-400' : 'text-slate-500'
                      }`}
                    >
                      {isOn ? 'ON' : 'OFF'}
                    </span>
                  </div>
                </div>

                <p className="text-xs text-slate-400 mb-3.5 min-h-[32px] line-clamp-2">
                  {relay.description}
                </p>
              </div>

              {/* Action Button */}
              <button
                onClick={() => handleToggle(relay.id, relay.state)}
                disabled={isBusy}
                className={`w-full py-2.5 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                  isBusy
                    ? 'bg-slate-800 text-slate-400 cursor-wait'
                    : isOn
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-950/40'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                }`}
              >
                <Power className={`w-3.5 h-3.5 ${isOn ? 'text-white' : 'text-slate-400'}`} />
                <span>
                  {isBusy ? 'กำลังส่งคำสั่ง...' : isOn ? 'สั่งปิด (Switch OFF)' : 'สั่งเปิด (Switch ON)'}
                </span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Safety Notice & API Call Information */}
      <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs text-slate-400">
        <div className="flex items-center gap-1.5 text-amber-400/90">
          <ShieldAlert className="w-4 h-4 shrink-0" />
          <span>
            หมายเหตุ: Relay Y3 (GPIO2) เป็นวาล์วจ่ายหลัก ถูกตั้งค่าให้เปิด (ON) อัตโนมัติตั้งแต่เริ่มต้นระบบ
          </span>
        </div>
        <div className="font-mono text-[11px] text-slate-400">
          Payload: <span className="text-slate-300">{"{ relay: 1-6, state: true|false }"}</span>
        </div>
      </div>
    </div>
  );
};
