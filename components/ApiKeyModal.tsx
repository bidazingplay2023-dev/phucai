
import React, { useState, useEffect } from 'react';
import { Key, Save, ExternalLink, Eye, EyeOff, AlertTriangle } from 'lucide-react';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  forceOpen?: boolean; // Nếu true, không cho đóng trừ khi đã có key
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, forceOpen = false }) => {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Load key from storage when modal opens
    const storedKey = localStorage.getItem('GOOGLE_API_KEY');
    if (storedKey) {
      setApiKey(storedKey);
    }
  }, [isOpen]);

  const handleSave = () => {
    if (!apiKey.trim()) {
      setError('Vui lòng nhập API Key');
      return;
    }

    if (!apiKey.startsWith('AIza')) {
      setError('API Key có vẻ không hợp lệ (thường bắt đầu bằng AIza...)');
      // Warning only, still allow save
    }

    localStorage.setItem('GOOGLE_API_KEY', apiKey.trim());
    setError(null);
    onClose();
    // Reload page to ensure services pick up the new key if needed, 
    // though our service logic reads directly from localStorage so reload isn't strictly necessary.
    // However, trigger a UI update event is good practice.
    window.dispatchEvent(new Event('storage'));
  };

  if (!isOpen && !forceOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 text-white">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-white/20 p-2 rounded-lg">
              <Key size={24} className="text-white" />
            </div>
            <h2 className="text-xl font-bold">Cấu hình API Key</h2>
          </div>
          <p className="text-indigo-100 text-sm">
            Ứng dụng cần Google Gemini API Key để hoạt động. Key của bạn được lưu cục bộ trên trình duyệt này.
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-semibold text-gray-700 flex justify-between">
              Google Gemini API Key
              <a 
                href="https://aistudio.google.com/app/apikey" 
                target="_blank" 
                rel="noreferrer"
                className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
              >
                Lấy Key miễn phí <ExternalLink size={10} />
              </a>
            </label>
            
            <div className="relative">
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  setError(null);
                }}
                placeholder="AIzaSy..."
                className="w-full pl-4 pr-10 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            
            {error && (
              <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 p-2 rounded-lg">
                <AlertTriangle size={14} />
                {error}
              </div>
            )}
          </div>

          <div className="pt-2">
            <button
              onClick={handleSave}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] shadow-lg shadow-indigo-200"
            >
              <Save size={18} />
              Lưu & Bắt đầu
            </button>
            
            {!forceOpen && (
               <button
                onClick={onClose}
                className="w-full mt-3 py-2 text-gray-500 hover:text-gray-700 text-sm font-medium"
              >
                Đóng
              </button>
            )}
          </div>
          
          <p className="text-[10px] text-gray-400 text-center leading-relaxed">
            * Chúng tôi không lưu trữ key của bạn trên server. Key chỉ được dùng để gọi trực tiếp từ trình duyệt của bạn đến Google API.
          </p>
        </div>
      </div>
    </div>
  );
};
