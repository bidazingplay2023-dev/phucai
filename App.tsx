import React, { useState, useEffect } from 'react';
import { AppTab } from './types';
import MobileLayout from './components/MobileLayout';
import DesktopLayout from './components/DesktopLayout';
import { VirtualFit } from './features/VirtualFit';
import { SceneMagic } from './features/SceneMagic';
import { CinematicVideo } from './features/CinematicVideo';
import { useApiKey } from './context/ApiKeyContext';
import { LogOut } from 'lucide-react';

const SettingsView = () => {
  const { clearKey, apiKey } = useApiKey();
  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold text-white">Settings</h2>
      <div className="bg-lumina-surface p-4 rounded-xl border border-gray-700">
        <h3 className="text-lg font-medium text-white mb-2">API Key Management</h3>
        <p className="text-sm text-lumina-muted mb-4">
          Your key is stored in your browser's Local Storage.
        </p>
        <div className="flex items-center justify-between bg-black/30 p-3 rounded-lg border border-gray-800 mb-4">
             <code className="text-xs text-gray-400 font-mono">
                {apiKey ? `${apiKey.substring(0, 8)}...${apiKey.substring(apiKey.length - 4)}` : 'No Key Found'}
             </code>
        </div>
        <button 
            onClick={clearKey}
            className="flex items-center gap-2 px-4 py-2 bg-red-900/30 text-red-400 border border-red-900 rounded-lg hover:bg-red-900/50 transition-colors text-sm"
        >
            <LogOut className="w-4 h-4" />
            Remove Key & Reset
        </button>
      </div>
    </div>
  )
}

function App() {
  const [activeTab, setActiveTab] = useState<AppTab>(AppTab.VIRTUAL_FIT);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const renderContent = () => {
    switch (activeTab) {
      case AppTab.VIRTUAL_FIT: return <VirtualFit />;
      case AppTab.SCENE_MAGIC: return <SceneMagic />;
      case AppTab.CINEMATIC_VIDEO: return <CinematicVideo />;
      case AppTab.SETTINGS: return <SettingsView />;
      default: return <VirtualFit />;
    }
  };

  const Layout = isMobile ? MobileLayout : DesktopLayout;

  return (
    <Layout currentTab={activeTab} onTabChange={setActiveTab}>
      <div className="animate-fade-in">
         {renderContent()}
      </div>
    </Layout>
  );
}

export default App;
