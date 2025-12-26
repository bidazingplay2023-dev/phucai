import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ApiKeyConfig, AppRoute } from '../types';
import { GoogleGenAI } from "@google/genai";

interface AppContextType {
  apiKeyConfig: ApiKeyConfig;
  setApiKey: (key: string) => void;
  validateApiKey: () => Promise<boolean>;
  currentRoute: AppRoute;
  navigate: (route: AppRoute) => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const LOCAL_STORAGE_KEY = 'PHUCNGUYEN_AI_STUDIO_KEY';

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [apiKeyConfig, setApiKeyConfig] = useState<ApiKeyConfig>({
    key: '',
    isValid: false,
  });
  const [currentRoute, setCurrentRoute] = useState<AppRoute>(AppRoute.FITTING); // Mặc định vào trang chính
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Load key from storage on mount
  useEffect(() => {
    const storedKey = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (storedKey) {
      setApiKeyConfig({ key: storedKey, isValid: false }); // Validate later
    } else {
      setIsSettingsOpen(true); // Force open settings if no key
    }
  }, []);

  const setApiKey = (key: string) => {
    localStorage.setItem(LOCAL_STORAGE_KEY, key);
    setApiKeyConfig({ key, isValid: false });
  };

  const validateApiKey = async (): Promise<boolean> => {
    if (!apiKeyConfig.key) return false;

    try {
      const ai = new GoogleGenAI({ apiKey: apiKeyConfig.key });
      // Thử gọi một model nhẹ để test connection
      const model = ai.models;
      // Gọi generateContent đơn giản
      await model.generateContent({
          model: 'gemini-2.5-flash-latest',
          contents: 'test',
      });
      
      setApiKeyConfig(prev => ({ ...prev, isValid: true }));
      return true;
    } catch (error) {
      console.error("API Key Validation Failed:", error);
      setApiKeyConfig(prev => ({ ...prev, isValid: false }));
      return false;
    }
  };

  const navigate = (route: AppRoute) => {
    setCurrentRoute(route);
  };

  return (
    <AppContext.Provider value={{
      apiKeyConfig,
      setApiKey,
      validateApiKey,
      currentRoute,
      navigate,
      isSettingsOpen,
      setIsSettingsOpen
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
};