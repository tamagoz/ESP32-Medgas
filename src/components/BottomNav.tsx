import React from 'react';
import { Activity, Bell, LayoutDashboard, Sliders, Zap } from 'lucide-react';

interface BottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  unacknowledgedAlertsCount: number;
}

export const BottomNav: React.FC<BottomNavProps> = ({
  activeTab,
  onTabChange,
  unacknowledgedAlertsCount,
}) => {
  const tabs = [
    { id: 'dashboard', label: 'แดชบอร์ด', icon: LayoutDashboard },
    { id: 'relays', label: 'รีเลย์ Y1-Y6', icon: Zap },
    { id: 'analytics', label: 'กราฟแนวโน้ม', icon: Activity },
    { id: 'ntfy', label: 'แจ้งเตือน', icon: Bell, badge: unacknowledgedAlertsCount },
    { id: 'thresholds', label: 'เกณฑ์แรงดัน', icon: Sliders },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-950/95 backdrop-blur-md border-t border-slate-800/90 pb-safe shadow-lg">
      <div className="grid grid-cols-5 items-center h-14">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className="relative flex flex-col items-center justify-center h-full min-h-[44px] min-w-[44px] py-1 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <div className="relative">
                <Icon
                  className={`w-5 h-5 transition-transform ${
                    isActive ? 'text-cyan-400 scale-110' : 'text-slate-400'
                  }`}
                />
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="absolute -top-1 -right-2 px-1 text-[9px] font-bold rounded-full bg-rose-500 text-white min-w-[14px] text-center">
                    {tab.badge}
                  </span>
                )}
              </div>
              <span
                className={`text-[10px] font-medium tracking-tight mt-1 transition-colors ${
                  isActive ? 'text-cyan-400 font-semibold' : 'text-slate-400'
                }`}
              >
                {tab.label}
              </span>
              {isActive && (
                <span className="absolute bottom-1 w-1 h-1 rounded-full bg-cyan-400" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};
