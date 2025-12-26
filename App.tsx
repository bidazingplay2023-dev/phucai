import React, { useState, useEffect } from 'react';
import { NavTab } from './types';
import { Layout } from './components/Layout';
import { TryOnFeature } from './components/TryOnFeature';
import { BackgroundFeature } from './components/BackgroundFeature';
import { VideoFeature } from './components/VideoFeature';
import { Settings } from './components/Settings';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<NavTab>(NavTab.TRY_ON);
  const [apiKey, setApiKey] = useState<string | null>(null);
  
  // Toast State
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    // Load API Key from local storage on mount
    const storedKey = localStorage.getItem('GEMINI_API_KEY');
    if (storedKey) {
      setApiKey(storedKey);
    }
  }, []);

  const saveApiKey = (key: string) => {
    setApiKey(key);
    localStorage.setItem('GEMINI_API_KEY', key);
    showToast("Đã lưu API Key thành công!", 'success');
  };

  const clearApiKey = () => {
    setApiKey(null);
    localStorage.removeItem('GEMINI_API_KEY');
    showToast("Đã xóa API Key.", 'success');
  };

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const renderContent = () => {
    switch (activeTab) {
      case NavTab.TRY_ON:
        return <TryOnFeature apiKey={apiKey} onError={(m) => showToast(m, 'error')} onSuccess={(m) => showToast(m, 'success')} />;
      case NavTab.BACKGROUND:
        return <BackgroundFeature apiKey={apiKey} onError={(m) => showToast(m, 'error')} onSuccess={(m) => showToast(m, 'success')} />;
      case NavTab.VIDEO:
        return <VideoFeature apiKey={apiKey} onError={(m) => showToast(m, 'error')} onSuccess={(m) => showToast(m, 'success')} />;
      case NavTab.SETTINGS:
        return <Settings apiKey={apiKey} onSaveKey={saveApiKey} onClearKey={clearApiKey} />;
      default:
        return <TryOnFeature apiKey={apiKey} onError={(m) => showToast(m, 'error')} onSuccess={(m) => showToast(m, 'success')} />;
    }
  };

  return (
    <Layout activeTab={activeTab} onTabChange={setActiveTab}>
      {/* Tab Content */}
      <div className="animate-fade-in">
        {renderContent()}
      </div>

      {/* Toast Notification */}
      {toast && (
        <div 
          className={`fixed top-4 left-1/2 transform -translate-x-1/2 px-6 py-3 rounded-full shadow-2xl z-[60] flex items-center gap-2 animate-bounce-in ${
            toast.type === 'error' ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'
          }`}
        >
          <span>{toast.type === 'error' ? '⚠️' : '✅'}</span>
          <span className="font-medium text-sm">{toast.msg}</span>
        </div>
      )}
    </Layout>
  );
};

export default App;