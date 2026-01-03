import React, { useState } from 'react';
import { Key, ShieldCheck, ExternalLink, AlertTriangle, Cpu } from 'lucide-react';
import { ApiKeys } from '../types';

interface ApiKeyInputProps {
  onSetKeys: (keys: ApiKeys) => void;
}

export const ApiKeyInput: React.FC<ApiKeyInputProps> = ({ onSetKeys }) => {
  const [geminiKey, setGeminiKey] = useState('');
  const [everAiKey, setEverAiKey] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const cleanGemini = geminiKey.trim();
    const cleanEverAi = everAiKey.trim();

    if (!cleanGemini || cleanGemini.length < 20) {
      setError('Vui lòng nhập Gemini API Key hợp lệ.');
      return;
    }

    if (!cleanEverAi) {
      setError('Vui lòng nhập EverAI API Key.');
      return;
    }

    // Check ASCII for Gemini to avoid header errors
    if (/[^\x00-\x7F]/.test(cleanGemini) || /[^\x00-\x7F]/.test(cleanEverAi)) {
      setError('Key chứa ký tự không hợp lệ (ví dụ: tiếng Việt có dấu). Vui lòng tắt bộ gõ.');
      return;
    }

    onSetKeys({ gemini: cleanGemini, everAi: cleanEverAi });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white text-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
            <Key size={32} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold">Cấu hình hệ thống</h2>
          <p className="text-indigo-100 text-sm mt-2">Nhập API Key để kết nối AI</p>
        </div>

        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Gemini Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Cpu size={16} className="text-blue-500"/> Google Gemini API Key
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={geminiKey}
                  onChange={(e) => {
                    setGeminiKey(e.target.value);
                    setError('');
                  }}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                  placeholder="AIzaSy..."
                />
                <ShieldCheck size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
              <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-[10px] text-blue-500 hover:underline mt-1 block text-right">Lấy key Google tại đây</a>
            </div>

            {/* EverAI Input */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                <Cpu size={16} className="text-purple-500"/> EverAI API Key
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={everAiKey}
                  onChange={(e) => {
                    setEverAiKey(e.target.value);
                    setError('');
                  }}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                  placeholder="ever-..."
                />
                <ShieldCheck size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
              <a href="https://www.everai.vn/" target="_blank" className="text-[10px] text-purple-500 hover:underline mt-1 block text-right">Lấy key EverAI tại đây</a>
            </div>

            {error && <p className="text-red-500 text-xs font-medium bg-red-50 p-2 rounded">{error}</p>}

            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex gap-3 items-start">
               <AlertTriangle size={20} className="text-blue-600 shrink-0 mt-0.5" />
               <div className="text-xs text-blue-800 leading-relaxed">
                  <strong>An toàn:</strong> Key chỉ lưu trên RAM trình duyệt và mất khi tải lại trang. Hệ thống dùng Proxy nội bộ để bảo mật và tránh lỗi CORS.
               </div>
            </div>

            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg active:scale-[0.98]"
            >
              Truy cập ứng dụng
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};