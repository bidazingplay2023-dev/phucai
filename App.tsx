import React from 'react';
import { AppProvider, useApp } from './context/AppContext';
import { DesktopSidebar, MobileTabBar } from './components/Navigation';
import { SettingsModal } from './components/SettingsModal';
import { VirtualFitting } from './pages/VirtualFitting';
import { AppRoute } from './types';
import { motion, AnimatePresence } from 'framer-motion';

const MainContent = () => {
  // Fix: Destructure navigate from useApp hook at the top level
  const { currentRoute, navigate } = useApp();

  return (
    <div className="md:ml-64 min-h-screen bg-black">
      <main className="max-w-5xl mx-auto p-4 md:p-8 pt-6">
        <AnimatePresence mode="wait">
          {currentRoute === AppRoute.FITTING && (
            <motion.div
              key="fitting"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <VirtualFitting />
            </motion.div>
          )}
          {currentRoute === AppRoute.HOME && (
            <motion.div
              key="home"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="text-center py-20"
            >
                <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500 mb-4">
                    Chào mừng đến Phúc Nguyễn AI Studio
                </h2>
                <p className="text-zinc-400 max-w-lg mx-auto">
                    Nền tảng sử dụng sức mạnh của Google Gemini 2.5 để cách mạng hóa trải nghiệm mua sắm trực tuyến.
                </p>
                <button 
                  // Fix: Use the navigate function from the hook
                  onClick={() => navigate(AppRoute.FITTING)}
                  className="mt-8 px-6 py-3 bg-white text-black rounded-full font-semibold hover:bg-zinc-200 transition-colors"
                >
                    Bắt đầu thử đồ ngay
                </button>
            </motion.div>
          )}
          {/* Settings is handled via Modal */}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default function App() {
  return (
    <AppProvider>
      <div className="min-h-screen bg-black text-zinc-100 selection:bg-blue-500/30">
        <DesktopSidebar />
        <MainContent />
        <MobileTabBar />
        <SettingsModal />
      </div>
    </AppProvider>
  );
}