import React, { useState, useEffect } from 'react';
import { X, Key, ExternalLink, Save, AlertTriangle, ShieldCheck } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isErrorTrigger?: boolean;
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
              {isErrorTrigger ? 'Giới hạn Free Tier' : 'Cài đặt API Key'}
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
              <strong className="block text-orange-800 mb-1">Đây không phải lỗi bảo mật!</strong>
              API Key hiện tại đã hết lượt sử dụng miễn phí trong phút này (Quota Exceeded). Hệ thống đã thử lại nhiều lần nhưng Google vẫn từ chối.
              <br/><br/>
              Vui lòng nhập Key riêng của bạn để tiếp tục.
            </div>
          )}

          {!isErrorTrigger && (
             <div className="text-sm text-gray-500 space-y-2">
                <p>Nhập API Key Google Gemini của riêng bạn để không phải chia sẻ giới hạn với người khác.</p>
                <div className="bg-blue-50 p-2 rounded border border-blue-100 flex gap-2 items-start">
                    <ShieldCheck size={16} className="text-blue-600 shrink-0 mt-0.5" />
                    <span className="text-xs text-blue-800">
                        <strong>Mẹo bảo mật:</strong> Nếu bạn thấy lỗi khi dùng trên web, hãy vào Google AI Studio {'>'} API Key {'>'} <strong>API restrictions</strong> và thêm tên miền website của bạn vào mục <strong>HTTP referrers</strong>.
                    </span>
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
            Lấy API Key miễn phí tại Google AI Studio <ExternalLink size={12} />
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