import React, { useState, useEffect } from 'react';
import { smartFitAI, sceneArchitect } from './services/geminiService';
import ImageUploader from './components/ImageUploader';

const App = () => {
  const [activeTab, setActiveTab] = useState('fit');
  const [apiKey, setApiKey] = useState(localStorage.getItem('user_api_key') || '');
  const [images, setImages] = useState<{person: any, product: any, result: any}>({person: null, product: null, result: null});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    localStorage.setItem('user_api_key', apiKey);
  }, [apiKey]);

  const handleSmartFit = async () => {
    if (!apiKey) return alert("Vui lòng vào 'Cài đặt' nhập API Key!");
    setLoading(true);
    try {
      const result = await smartFitAI(apiKey, images.person, images.product);
      setImages({...images, result});
    } catch (e: any) { alert(e.message); }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white pb-24">
      {/* Header */}
      <header className="p-4 border-b border-white/10 flex justify-between items-center bg-slate-900/50 sticky top-0 z-50">
        <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
          PN AI Studio
        </h1>
        {loading && <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-blue-500"></div>}
      </header>

      <main className="p-4 max-w-md mx-auto">
        {activeTab === 'fit' && (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold">Thử Đồ Thông Minh</h2>
            <ImageUploader label="Ảnh người mẫu" onUpload={(b64) => setImages({...images, person: b64})} image={images.person} />
            <ImageUploader label="Ảnh sản phẩm" onUpload={(b64) => setImages({...images, product: b64})} image={images.product} />
            <button 
              onClick={handleSmartFit}
              disabled={loading || !images.person || !images.product}
              className="w-full bg-blue-600 py-4 rounded-2xl font-bold shadow-lg shadow-blue-900/20 active:scale-95 transition-all"
            >
              {loading ? "Đang xử lý..." : "Bắt đầu ghép đồ"}
            </button>
          </div>
        )}

        {activeTab === 'result' && (
          <div className="space-y-4">
             <h2 className="text-lg font-semibold text-center">Kết quả Studio</h2>
             {images.result ? (
               <img src={images.result} className="w-full rounded-3xl border border-white/10 shadow-2xl" alt="Result" />
             ) : (
               <p className="text-center text-slate-500 pt-20">Chưa có ảnh kết quả</p>
             )}
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Cài đặt API cá nhân</h2>
            <p className="text-xs text-slate-400">Key của bạn được lưu an toàn trên trình duyệt này.</p>
            <input 
              type="password" 
              value={apiKey} 
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Dán Gemini API Key vào đây..."
              className="w-full bg-slate-800 border border-white/10 p-4 rounded-xl focus:ring-2 ring-blue-500 outline-none"
            />
            <a href="https://aistudio.google.com/app/apikey" target="_blank" className="text-blue-400 text-sm block text-center">Lấy Key miễn phí tại đây</a>
          </div>
        )}
      </main>

      {/* Bottom Navigation Chuyên nghiệp cho Mobile */}
      <nav className="fixed bottom-0 left-0 right-0 bg-slate-900/80 backdrop-blur-xl border-t border-white/10 flex justify-around p-3 z-50">
        <button onClick={() => setActiveTab('fit')} className={`flex flex-col items-center ${activeTab === 'fit' ? 'text-blue-400' : 'text-slate-500'}`}>
          <div className="p-1">👕</div>
          <span className="text-[10px]">Thử đồ</span>
        </button>
        <button onClick={() => setActiveTab('result')} className={`flex flex-col items-center ${activeTab === 'result' ? 'text-blue-400' : 'text-slate-500'}`}>
          <div className="p-1">🖼️</div>
          <span className="text-[10px]">Kết quả</span>
        </button>
        <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center ${activeTab === 'settings' ? 'text-blue-400' : 'text-slate-500'}`}>
          <div className="p-1">⚙️</div>
          <span className="text-[10px]">Cài đặt</span>
        </button>
      </nav>
    </div>
  );
};

export default App;