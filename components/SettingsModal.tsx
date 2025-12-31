import React, { useState, useEffect } from 'react';
import { X, Key, ExternalLink, Save, AlertTriangle, ShieldCheck, CreditCard } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isErrorTrigger?: boolean;
  errorType?: 'QUOTA' | 'BILLING';
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, isErrorTrigger, errorType = 'QUOTA' }) => {
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
              {isErrorTrigger 
                ? (errorType === 'BILLING' ? 'Yêu cầu thanh toán' : 'Giới hạn Free Tier') 
                : 'Cài đặt API Key'
              }
            </h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {isErrorTrigger && errorType === 'BILLING' && (
            <div className="text-sm text-gray-700 bg-orange-50 p-4 rounded-xl border border-orange-100">
              <div className="flex items-start gap-3">
                 <CreditCard className="shrink-0 text-orange-600 mt-0.5" size={18} />
                 <div>
                    <strong className="block text-orange-800 mb-1">Cần liên kết thẻ Visa/Mastercard!</strong>
                    Model tạo ảnh AI này yêu cầu dự án Google Cloud của bạn phải bật chức năng thanh toán (Billing Account).
                    <ul className="list-disc list-inside mt-2 space-y-1 text-xs text-orange-800/80">
                        <li>Bạn vẫn có thể dùng <strong>miễn phí</strong> (có hạn mức).</li>
                        <li>Nhưng Google yêu cầu thẻ để xác minh danh tính.</li>
                        <li>Nếu không có thẻ, lỗi "Limit: 0" sẽ luôn xảy ra.</li>
                    </ul>
                 </div>
              </div>
            </div>
          )}

          {isErrorTrigger && errorType === 'QUOTA' && (
            <div className="text-sm text-gray-600 bg-orange-50 p-3 rounded-lg border border-orange-100">
              <strong className="block text-orange-800 mb-1">Hết lượt miễn phí trong ngày</strong>
              API Key hiện tại đã hết lượt sử dụng miễn phí (Quota Exceeded).
              <br/><br/>
              Vui lòng nhập Key mới hoặc Key từ dự án có trả phí (Pay-as-you-go).
            </div>
          )}

          {!isErrorTrigger && (
             <div className="text-sm text-gray-500 space-y-2">
                <p>Nhập API Key Google Gemini của riêng bạn để sử dụng ổn định.</p>
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
            href="https://console.cloud.google.com/billing" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-xs text-indigo-600 font-medium hover:underline"
          >
            Quản lý Billing tại Google Cloud Console <ExternalLink size={12} />
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