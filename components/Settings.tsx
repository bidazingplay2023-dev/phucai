import React, { useState, useEffect } from 'react';

interface SettingsProps {
  apiKey: string | null;
  onSaveKey: (key: string) => void;
  onClearKey: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ apiKey, onSaveKey, onClearKey }) => {
  const [inputKey, setInputKey] = useState('');

  useEffect(() => {
    if (apiKey) setInputKey(apiKey);
  }, [apiKey]);

  const handleSave = () => {
    if (inputKey.trim().length > 10) {
      onSaveKey(inputKey.trim());
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="bg-studio-800 p-6 rounded-2xl border border-studio-700 shadow-lg">
        <h2 className="text-xl font-bold text-white mb-4">Cấu hình hệ thống</h2>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Google Gemini API Key
            </label>
            <input
              type="password"
              value={inputKey}
              onChange={(e) => setInputKey(e.target.value)}
              placeholder="Nhập API Key của bạn (bắt đầu bằng AIza...)"
              className="w-full bg-studio-900 border border-studio-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-studio-accent focus:border-transparent outline-none transition-all"
            />
            <p className="mt-2 text-xs text-gray-500">
              Key được lưu trữ an toàn trong trình duyệt của bạn (LocalStorage).
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSave}
              className="flex-1 bg-studio-accent hover:bg-violet-600 text-white font-semibold py-3 px-4 rounded-xl transition-all active:scale-95"
            >
              Lưu cấu hình
            </button>
            {apiKey && (
              <button
                onClick={() => {
                  onClearKey();
                  setInputKey('');
                }}
                className="px-4 py-3 border border-red-500/30 text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
              >
                Xóa Key
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="bg-studio-800 p-6 rounded-2xl border border-studio-700">
        <h3 className="text-lg font-semibold text-white mb-3">Hướng dẫn</h3>
        <ul className="list-disc list-inside space-y-2 text-sm text-gray-400">
          <li>Truy cập <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" className="text-blue-400 underline">Google AI Studio</a> để lấy key miễn phí.</li>
          <li>Chọn "Get API Key" và tạo key mới.</li>
          <li>Dán key vào ô bên trên để kích hoạt tất cả tính năng.</li>
        </ul>
      </div>
    </div>
  );
};