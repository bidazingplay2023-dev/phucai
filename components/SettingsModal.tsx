import React, { useState, useEffect } from 'react';
import { X, Key, ExternalLink, Save, AlertTriangle, Zap } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isErrorTrigger?: boolean;
  errorType?: 'QUOTA' | 'BILLING';
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, isErrorTrigger }) => {
  const [apiKey, setApiKey] = useState('');
  
  useEffect(() => {
    const storedKey = localStorage.getItem('user_api_key');
    if (storedKey) setApiKey(storedKey);
  }, [isOpen]);

  const handleSave = () => {
    if (apiKey.trim()) {
      localStorage.setItem('user_api_key', apiKey.trim());
    } else {
      localStorage.removeItem('user_api_key');
    }
    onClose();
    window.location.reload(); 
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className={`px-6 py-4 flex items-center justify-between border-b ${isErrorTrigger ? 'bg-orange-50' : 'bg-white'}`}>
          <div className="flex items-center gap-2">
            {isErrorTrigger ? (
                <div className="bg-orange-100 p-2 rounded-full text-orange-600">
                    <AlertTriangle size={20} />
                </div>
            ) : (
                <div className="bg-indigo-50 p-2 rounded-full text-indigo-600">
                    <Key size={20} />
                </div>
            )}
            <h3 className={`font-bold text-lg ${isErrorTrigger ? 'text-orange-800' : 'text-gray-800'}`}>
              {isErrorTrigger ? 'Cần kiểm tra lại Key' : 'Cài đặt API Key'}
            </h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {isErrorTrigger && (
            <div className="text-sm text-gray-600 bg-orange-50 p-3 rounded-lg border border-orange-100">
              <strong className="block text-orange-800 mb-1">API Key đang bị giới hạn</strong>
              Có vẻ Key hiện tại đang bị Google tạm chặn do gửi quá nhiều dữ liệu cùng lúc.
              <br/><br/>
              Hệ thống đã tự động bật chế độ <strong>"Tiết kiệm dữ liệu"</strong> (nén ảnh nhỏ hơn). Vui lòng thử lại hoặc nhập Key mới.
            </div>
          )}

          {!isErrorTrigger && (
             <div className="text-sm text-gray-500 space-y-2">
                <p>Nhập API Key Google Gemini của riêng bạn để sử dụng ứng dụng ổn định.</p>
                <div className="flex gap-2 items-center text-xs bg-green-50 text-green-700 p-2 rounded border border-green-100">
                    <Zap size={14} fill="currentColor" />
                    Ứng dụng đã được tối ưu để chạy mượt trên gói Free Tier.
                </div>
             </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-700 uppercase tracking-wider">Google Gemini API Key</label>
            <input 
              type="password" 
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="AIzaSy..."
              className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono text-sm"
            />
          </div>

          <a 
            href="https://aistudio.google.com/app/apikey" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-indigo-600 font-medium hover:underline"
          >
            Lấy API Key mới miễn phí <ExternalLink size={12} />
          </a>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
          >
            Đóng
          </button>
          <button 
            onClick={handleSave}
            className="px-6 py-2 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg shadow-md transition-colors flex items-center gap-2"
          >
            <Save size={16} />
            Lưu & Thử lại
          </button>
        </div>
      </div>
    </div>
  );
};