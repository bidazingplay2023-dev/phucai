import React, { useState } from 'react';
import { Key, ShieldCheck, ExternalLink, AlertTriangle } from 'lucide-react';

interface ApiKeyInputProps {
  onSetKey: (key: string) => void;
}

export const ApiKeyInput: React.FC<ApiKeyInputProps> = ({ onSetKey }) => {
  const [inputKey, setInputKey] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputKey.trim() || inputKey.length < 20) {
      setError('Vui lòng nhập API Key hợp lệ.');
      return;
    }
    onSetKey(inputKey.trim());
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white text-center">
          <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 backdrop-blur-sm">
            <Key size={32} className="text-white" />
          </div>
          <h2 className="text-2xl font-bold">Cấu hình bảo mật</h2>
          <p className="text-indigo-100 text-sm mt-2">Nhập Gemini API Key để bắt đầu</p>
        </div>

        <div className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Gemini API Key của bạn
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={inputKey}
                  onChange={(e) => {
                    setInputKey(e.target.value);
                    setError('');
                  }}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all outline-none"
                  placeholder="AIzaSy..."
                />
                <ShieldCheck size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              </div>
              {error && <p className="text-red-500 text-xs mt-2 ml-1">{error}</p>}
            </div>

            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex gap-3 items-start">
               <AlertTriangle size={20} className="text-blue-600 shrink-0 mt-0.5" />
               <div className="text-xs text-blue-800 leading-relaxed">
                  <strong>Bảo mật tuyệt đối:</strong> Key của bạn <u>chỉ lưu trên RAM</u> (bộ nhớ tạm) của trình duyệt và sẽ bị xóa ngay lập tức khi bạn tải lại trang (F5) hoặc đóng tab. Hệ thống không lưu trữ key này ở bất kỳ đâu.
               </div>
            </div>

            <button
              type="submit"
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg active:scale-[0.98]"
            >
              Truy cập ứng dụng
            </button>
          </form>

          <div className="mt-6 text-center">
            <a 
              href="https://aistudio.google.com/app/apikey" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-indigo-600 transition-colors"
            >
              Chưa có Key? Lấy miễn phí tại đây <ExternalLink size={14} />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};