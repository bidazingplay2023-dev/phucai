import React, { createContext, useContext, useState, useEffect } from 'react';
import { Key, Lock, AlertTriangle } from 'lucide-react';

interface ApiKeyContextType {
  apiKey: string | null;
  isValid: boolean;
  saveKey: (key: string) => void;
  clearKey: () => void;
}

const ApiKeyContext = createContext<ApiKeyContextType | undefined>(undefined);

const STORAGE_KEY = 'lumina_gemini_api_key_v1';

export const ApiKeyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [tempKey, setTempKey] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setApiKey(stored);
    } else {
      setShowModal(true);
    }
  }, []);

  const saveKey = (key: string) => {
    if (key.trim().length > 10) {
      localStorage.setItem(STORAGE_KEY, key.trim());
      setApiKey(key.trim());
      setShowModal(false);
    }
  };

  const clearKey = () => {
    localStorage.removeItem(STORAGE_KEY);
    setApiKey(null);
    setShowModal(true);
  };

  return (
    <ApiKeyContext.Provider value={{ apiKey, isValid: !!apiKey, saveKey, clearKey }}>
      {children}
      
      {/* Settings/Key Modal - Forced if no key exists */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-lumina-surface border border-lumina-surface rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <div className="flex flex-col items-center text-center space-y-4">
              <div className="p-3 bg-lumina-primary/20 rounded-full">
                <Lock className="w-8 h-8 text-lumina-primary" />
              </div>
              <h2 className="text-2xl font-bold text-white">Unlock Lumina Studio</h2>
              <p className="text-lumina-muted text-sm">
                To maintain privacy and zero backend costs, Lumina runs entirely in your browser. 
                Please enter your Google Gemini API Key to continue.
              </p>
              
              <div className="w-full text-left">
                <label className="text-xs font-semibold text-lumina-muted uppercase tracking-wider">
                  Gemini API Key
                </label>
                <div className="relative mt-2">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-lumina-muted" />
                  <input
                    type="password"
                    value={tempKey}
                    onChange={(e) => setTempKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full bg-lumina-bg border border-gray-700 rounded-lg py-3 pl-10 pr-4 text-white focus:ring-2 focus:ring-lumina-primary focus:outline-none"
                  />
                </div>
              </div>

              <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-3 flex items-start gap-2 text-left w-full">
                <AlertTriangle className="w-4 h-4 text-yellow-500 shrink-0 mt-0.5" />
                <p className="text-xs text-yellow-200/80">
                  Your key is stored locally in your browser. It is never sent to our servers.
                </p>
              </div>

              <button
                onClick={() => saveKey(tempKey)}
                disabled={tempKey.length < 10}
                className="w-full py-3 bg-lumina-primary hover:bg-lumina-accent text-white font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Start Creating
              </button>
              
              <a 
                href="https://aistudio.google.com/app/apikey" 
                target="_blank" 
                rel="noreferrer"
                className="text-xs text-lumina-primary hover:underline"
              >
                Get a free API Key here &rarr;
              </a>
            </div>
          </div>
        </div>
      )}
    </ApiKeyContext.Provider>
  );
};

export const useApiKey = () => {
  const context = useContext(ApiKeyContext);
  if (!context) {
    throw new Error('useApiKey must be used within an ApiKeyProvider');
  }
  return context;
};
