
import React, { useState, useEffect } from 'react';
import { Key, Save, ExternalLink, Eye, EyeOff, AlertTriangle, Loader2 } from 'lucide-react';
import { validateApiKey } from '../services/geminiService';

interface ApiKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  forceOpen?: boolean; // Nếu true, không cho đóng trừ khi đã có key
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, forceOpen = false }) => {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    // Load key from storage when modal opens
    const storedKey = localStorage.getItem('GOOGLE_API_KEY');
    if (storedKey) {
      setApiKey(storedKey);
    }
  }, [isOpen]);

  const handleSave = async () => {
    const trimmedKey = apiKey.trim();
    if (!trimmedKey) {
      setError('Vui lòng nhập API Key');
      return;
    }

    if (!trimmedKey.startsWith('AIza')) {
      setError('API Key có vẻ không hợp lệ (thường bắt đầu bằng AIza...)');
      // Không return ở đây, để user thử vận may nếu muốn, nhưng phần lớn sẽ fail ở bước validate
    }

    setIsValidating(true);
    setError(null);

    try {
      // Gọi service để kiểm tra key có hoạt động thật không
      const isValid = await validateApiKey(trimmedKey);
      
      if (!isValid) {
        setError('API Key không hoạt động! Vui lòng kiểm tra lại (có thể key sai, hết hạn hoặc chưa bật billing).');
        setIsValidating(false);
        return;
      }

      // Nếu Valid
      localStorage.setItem('GOOGLE_API_KEY', trimmedKey);
      setIsValidating(false);
      onClose();
      
      // Trigger UI update
      window.dispatchEvent(new Event('storage'));
      
    } catch (e) {
      setError('Lỗi kết nối khi kiểm tra Key. Vui lòng thử lại.');
      setIsValidating(false);
    }
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
                disabled={isValidating}
                placeholder="AIzaSy..."
                className="w-full pl-4 pr-10 py-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all disabled:bg-gray-100 disabled:text-gray-500"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                disabled={isValidating}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 disabled:opacity-50"
              >
                {showKey ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
            
            {error && (
              <div className="flex items-start gap-2 text-xs text-red-600 bg-red-50 p-2 rounded-lg">
                <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </div>

          <div className="pt-2">
            <button
              onClick={handleSave}
              disabled={isValidating}
              className={`w-full py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg 
                ${isValidating 
                  ? 'bg-indigo-400 cursor-not-allowed text-white/80' 
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white active:scale-[0.98] shadow-indigo-200'}`}
            >
              {isValidating ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Đang kiểm tra Key...
                </>
              ) : (
                <>
                  <Save size={18} />
                  Lưu & Bắt đầu
                </>
              )}
            </button>
            
            {!forceOpen && !isValidating && (
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
