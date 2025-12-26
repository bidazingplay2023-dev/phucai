import React from 'react';
import { Shirt, Image as ImageIcon, Video, Settings } from 'lucide-react';
import { AppTab } from '../types';

interface MobileLayoutProps {
  currentTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  children: React.ReactNode;
}

const MobileLayout: React.FC<MobileLayoutProps> = ({ currentTab, onTabChange, children }) => {
  const navItems = [
    { id: AppTab.VIRTUAL_FIT, icon: Shirt, label: 'Fit' },
    { id: AppTab.SCENE_MAGIC, icon: ImageIcon, label: 'Scene' },
    { id: AppTab.CINEMATIC_VIDEO, icon: Video, label: 'Video' },
    { id: AppTab.SETTINGS, icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="flex flex-col h-screen bg-lumina-bg overflow-hidden">
      {/* Content Area */}
      <main className="flex-1 overflow-y-auto no-scrollbar pb-24">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-lumina-surface/90 backdrop-blur-lg border-t border-gray-800 pb-safe">
        <div className="flex justify-around items-center h-16">
          {navItems.map((item) => {
            const isActive = currentTab === item.id;
            const Icon = item.icon;
            
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${
                  isActive ? 'text-lumina-primary' : 'text-lumina-muted hover:text-white'
                }`}
              >
                <Icon className={`w-6 h-6 ${isActive ? 'fill-current/20' : ''}`} strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] font-medium">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
};

export default MobileLayout;
