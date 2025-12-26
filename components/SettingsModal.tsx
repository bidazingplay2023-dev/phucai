import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Key, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from './ui/Button';

export const SettingsModal = () => {
  const { isSettingsOpen, setIsSettingsOpen, apiKeyConfig, setApiKey, validateApiKey } = useApp();
  const [inputKey, setInputKey] = useState(apiKeyConfig.key);
  const [isValidating, setIsValidating] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  const handleSaveAndTest = async () => {
    setIsValidating(true);
    setStatusMsg(null);
    setApiKey(inputKey);
    
    // Đợi 1 chút để state cập nhật rồi validate (hoặc truyền trực tiếp nếu cần sửa logic context)
    // Ở đây ta gọi hàm validate context, nó dùng key trong state.
    // Hack nhẹ: dùng setTimeout hoặc cập nhật context để nhận key ngay lập tức.
    // Tốt hơn: validateApiKey nên nhận tham số optional hoặc lấy từ state mới nhất.
    // Logic trong context đang dùng apiKeyConfig.key.
    // Ta sẽ tạm thời set key vào localStorage rồi reload page hoặc để context tự update.
    
    // Cải tiến: validateApiKey trong context sẽ dùng key hiện tại trong state
    // Nhưng do React batch update, ta cần chờ. 
    // Tuy nhiên, để UX mượt, ta giả lập logic test tại chỗ với key input:
    
    try {
        const { GoogleGenAI } = await import("@google/genai");
        const ai = new GoogleGenAI({ apiKey: inputKey });
        await ai.models.generateContent({
             model: 'gemini-2.5-flash-latest',
             contents: 'ping',
        });
        setStatusMsg({ type: 'success', text: "Kết nối thành công! Gemini đã sẵn sàng." });
        setApiKey(inputKey); // Lưu chính thức
        setTimeout(() => setIsSettingsOpen(false), 1500);
    } catch (e) {
        setStatusMsg({ type: 'error', text: "Key không hợp lệ hoặc lỗi kết nối." });
    } finally {
        setIsValidating(false);
    }
  };

  return (
    <AnimatePresence>
      {isSettingsOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
            onClick={() => setIsSettingsOpen(false)}
          />
          
          {/* Modal Content - Slide up on mobile, Fade in/Scale on desktop */}
          <motion.div
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 md:top-1/2 md:left-1/2 md:bottom-auto md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-md z-50 bg-zinc-900 border-t md:border border-zinc-800 p-6 md:rounded-2xl shadow-2xl"
          >
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Key className="w-5 h-5 text-blue-500" />
                Cài đặt hệ thống
              </h2>
              <button onClick={() => setIsSettingsOpen(false)} className="p-2 hover:bg-zinc-800 rounded-full">
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-400 mb-1">
                  Google Gemini API Key
                </label>
                <input
                  type="password"
                  value={inputKey}
                  onChange={(e) => setInputKey(e.target.value)}
                  placeholder="sk-..."
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                />
                <p className="text-xs text-zinc-500 mt-2">
                  Key của bạn được lưu trữ an toàn trong LocalStorage của trình duyệt (BYOK Architecture).
                </p>
              </div>

              {statusMsg && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`p-3 rounded-lg flex items-center gap-2 text-sm ${
                    statusMsg.type === 'success' 
                      ? 'bg-green-500/10 text-green-400 border border-green-500/20' 
                      : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}
                >
                  {statusMsg.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                  {statusMsg.text}
                </motion.div>
              )}

              <div className="pt-4 flex flex-col gap-3">
                <Button 
                  onClick={handleSaveAndTest} 
                  isLoading={isValidating}
                  className="w-full"
                >
                  Lưu & Kiểm tra kết nối
                </Button>
                <a 
                  href="https://aistudio.google.com/app/apikey" 
                  target="_blank" 
                  rel="noreferrer"
                  className="text-center text-xs text-blue-400 hover:text-blue-300 hover:underline"
                >
                  Lấy API Key tại Google AI Studio
                </a>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};