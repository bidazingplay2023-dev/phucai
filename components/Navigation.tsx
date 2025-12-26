import React from 'react';
import { useApp } from '../context/AppContext';
import { AppRoute } from '../types';
import { Shirt, Settings, Home, Sparkles } from 'lucide-react';

const navItems = [
  { id: AppRoute.HOME, label: 'Trang chủ', icon: Home },
  { id: AppRoute.FITTING, label: 'Phòng thử đồ', icon: Shirt },
  { id: AppRoute.SETTINGS, label: 'Cài đặt', icon: Settings },
];

export const DesktopSidebar = () => {
  const { currentRoute, navigate, setIsSettingsOpen } = useApp();

  return (
    <div className="hidden md:flex flex-col w-64 h-screen bg-zinc-900 border-r border-zinc-800 fixed left-0 top-0 p-4">
      <div className="flex items-center gap-2 mb-8 px-2">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-white" />
        </div>
        <h1 className="font-bold text-lg tracking-tight">Phúc Nguyễn AI</h1>
      </div>

      <nav className="space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => {
              if (item.id === AppRoute.SETTINGS) {
                setIsSettingsOpen(true);
              } else {
                navigate(item.id);
              }
            }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              currentRoute === item.id && item.id !== AppRoute.SETTINGS
                ? 'bg-blue-600/10 text-blue-400'
                : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'
            }`}
          >
            <item.icon className="w-5 h-5" />
            {item.label}
          </button>
        ))}
      </nav>
      
      <div className="mt-auto pt-4 border-t border-zinc-800">
         <div className="px-3 py-2 bg-zinc-950 rounded-lg border border-zinc-800">
             <p className="text-xs text-zinc-500 font-mono">v2.0.0 (Edge)</p>
         </div>
      </div>
    </div>
  );
};

export const MobileTabBar = () => {
  const { currentRoute, navigate, setIsSettingsOpen } = useApp();

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-zinc-900/90 backdrop-blur-lg border-t border-zinc-800 pb-safe-area z-40">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const isActive = currentRoute === item.id && item.id !== AppRoute.SETTINGS;
          return (
            <button
              key={item.id}
              onClick={() => {
                if (item.id === AppRoute.SETTINGS) {
                  setIsSettingsOpen(true);
                } else {
                  navigate(item.id);
                }
              }}
              className="flex flex-col items-center justify-center w-full h-full space-y-1 touch-manipulation"
            >
              <item.icon 
                className={`w-6 h-6 transition-colors ${isActive ? 'text-blue-500' : 'text-zinc-500'}`} 
                strokeWidth={isActive ? 2.5 : 2}
              />
              <span className={`text-[10px] font-medium ${isActive ? 'text-blue-500' : 'text-zinc-500'}`}>
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};