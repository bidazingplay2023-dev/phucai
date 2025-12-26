import React from 'react';
import { Shirt, Image as ImageIcon, Video, Settings, Sparkles } from 'lucide-react';
import { AppTab } from '../types';

interface DesktopLayoutProps {
  currentTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  children: React.ReactNode;
}

const DesktopLayout: React.FC<DesktopLayoutProps> = ({ currentTab, onTabChange, children }) => {
  const navItems = [
    { id: AppTab.VIRTUAL_FIT, icon: Shirt, label: 'Virtual Fit' },
    { id: AppTab.SCENE_MAGIC, icon: ImageIcon, label: 'Scene Magic' },
    { id: AppTab.CINEMATIC_VIDEO, icon: Video, label: 'Cinematic Video' },
  ];

  return (
    <div className="flex h-screen bg-lumina-bg">
      {/* Sidebar */}
      <aside className="w-64 bg-lumina-surface border-r border-gray-800 flex flex-col">
        <div className="p-6 flex items-center space-x-2">
          <div className="w-8 h-8 bg-gradient-to-tr from-lumina-primary to-purple-500 rounded-lg flex items-center justify-center">
            <Sparkles className="text-white w-5 h-5" />
          </div>
          <h1 className="text-xl font-bold text-white tracking-tight">Lumina Studio</h1>
        </div>

        <nav className="flex-1 px-4 space-y-2 mt-4">
          {navItems.map((item) => {
            const isActive = currentTab === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`flex items-center space-x-3 w-full px-4 py-3 rounded-xl transition-all ${
                  isActive 
                    ? 'bg-lumina-primary text-white shadow-lg shadow-lumina-primary/25' 
                    : 'text-lumina-muted hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-gray-800">
           <button
                onClick={() => onTabChange(AppTab.SETTINGS)}
                className={`flex items-center space-x-3 w-full px-4 py-3 rounded-xl transition-all ${
                  currentTab === AppTab.SETTINGS
                    ? 'bg-gray-700 text-white' 
                    : 'text-lumina-muted hover:bg-gray-800 hover:text-white'
                }`}
              >
                <Settings className="w-5 h-5" />
                <span className="font-medium">Settings</span>
              </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto bg-lumina-bg p-8">
        <div className="max-w-6xl mx-auto h-full">
            {children}
        </div>
      </main>
    </div>
  );
};

export default DesktopLayout;
