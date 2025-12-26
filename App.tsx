import React, { useState, useEffect, useMemo } from 'react';
import ImageUploader from './components/ImageUploader.tsx';
import { 
  smartFitAI, 
  sceneArchitect, 
  generateCinematicVideo 
} from './services/geminiService';

// Định nghĩa các Tab cho ứng dụng
type TabType = 'fit' | 'scene' | 'video' | 'settings';

const App = () => {
  // --- States ---
  const [activeTab, setActiveTab] = useState<TabType>('fit');
  const [loading, setLoading] = useState(false);
  const [apiKey, setApiKey] = useState(localStorage.getItem('user_gemini_key') || '');
  
  // States lưu trữ hình ảnh
  const [images, setImages] = useState({
    person: null as string | null,
    product: null as string | null,
    result: null as string | null, // Kết quả sau khi ghép/đổi nền
    videoResult: null as string | null
  });

  // Lưu API Key vào máy người dùng mỗi khi thay đổi
  useEffect(() => {
    localStorage.setItem('user_gemini_key', apiKey);
  }, [apiKey]);

  // --- Handlers ---

  // Xử lý Gộp bước 1 & 2: Thử đồ thông minh
  const handleSmartFit = async () => {
    if (!apiKey) return alert("Vui lòng vào tab 'Cài đặt' để nhập API Key!");
    if (!images.person || !images.product) return alert("Vui lòng tải lên cả ảnh người mẫu và ảnh sản phẩm!");
    
    setLoading(true);
    try {
      const res = await smartFitAI(apiKey, images.person, images.product);
      setImages(prev => ({ ...prev, result: res }));
      alert("Ghép đồ thành công! Xem kết quả ở phía trên.");
    } catch (e: any) {
      alert("Lỗi: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  // Xử lý Bước 3: Đổi bối cảnh chuyên nghiệp
  const handleReplaceBackground = async (prompt: string) => {
    if (!images.result) return alert("Bạn cần có ảnh đã ghép đồ trước khi đổi bối cảnh!");
    setLoading(true);
    try {
      const res = await sceneArchitect(apiKey, images.result, prompt);
      setImages(prev => ({ ...prev, result: res }));
    } catch (e: any) {
      alert("Lỗi: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  // Xử lý Bước 4: Tạo Video Cinematic (Veo)
  const handleMakeVideo = async () => {
    if (!images.result) return alert("Hãy tạo ảnh bối cảnh trước khi sản xuất video!");
    setLoading(true);
    try {
      const videoUrl = await generateCinematicVideo(apiKey, images.result, "Cinematic panning shot, studio lighting, high quality");
      setImages(prev => ({ ...prev, videoResult: videoUrl }));
      alert("Video đã sẵn sàng!");
    } catch (e: any) {
      alert("Lỗi: " + e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] text-white font-sans pb-24">
      {/* Header cố định */}
      <header className="sticky top-0 z-50 bg-[#020617]/80 backdrop-blur-md border-b border-white/5 p-4 flex justify-between items-center">
        <h1 className="text-xl font-black bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
          PN AI STUDIO
        </h1>
        {loading && (
          <div className="flex items-center space-x-2 bg-blue-500/10 px-3 py-1 rounded-full border border-blue-500/20">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-widest">Đang xử lý</span>
          </div>
        )}
      </header>

      <main className="max-w-md mx-auto p-4 space-y-8">
        
        {/* Khu vực hiển thị kết quả (Luôn ở trên cùng để dễ xem) */}
        {(images.result || images.videoResult) && (
          <section className="space-y-3">
            <div className="relative aspect-[3/4] w-full rounded-3xl overflow-hidden border border-white/10 shadow-2xl bg-slate-900">
              {images.videoResult ? (
                <video src={images.videoResult} controls autoPlay loop className="w-full h-full object-cover" />
              ) : (
                <img src={images.result!} className="w-full h-full object-cover" alt="Result" />
              )}
              <div className="absolute top-4 right-4 flex gap-2">
                 <button onClick={() => setImages({...images, result: null, videoResult: null})} className="p-2 bg-black/50 backdrop-blur-md rounded-full text-xs">✕</button>
              </div>
            </div>
            <p className="text-[10px] text-center text-slate-500 italic">Kết quả xử lý từ AI Studio</p>
          </section>
        )}

        {/* Tab 1: Thử đồ */}
        {activeTab === 'fit' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="space-y-1">
              <h2 className="text-xl font-bold italic">Thử Đồ Thông Minh</h2>
              <p className="text-sm text-slate-400">Gộp bước tách nền & ghép đồ tự động.</p>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <ImageUploader 
                id="person-upload"
                label="Người mẫu" 
                image={images.person} 
                onUpload={(b64) => setImages({...images, person: b64})} 
                compact
              />
              <ImageUploader 
                id="product-upload"
                label="Sản phẩm" 
                image={images.product} 
                onUpload={(b64) => setImages({...images, product: b64})} 
                compact
              />
            </div>

            <button 
              onClick={handleSmartFit}
              disabled={loading || !images.person || !images.product}
              className="w-full h-14 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-2xl font-bold shadow-xl shadow-blue-900/20 active:scale-95 transition-transform disabled:opacity-30"
            >
              {loading ? "Đang xử lý..." : "Bắt đầu ghép đồ"}
            </button>
          </div>
        )}

        {/* Tab 2: Bối cảnh */}
        {activeTab === 'scene' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <div className="space-y-1">
              <h2 className="text-xl font-bold italic">Kiến Trúc Bối Cảnh</h2>
              <p className="text-sm text-slate-400">Thay đổi môi trường xung quanh sản phẩm.</p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {["Studio sang trọng", "Sân khấu ngoài trời", "Cyberpunk City", "Bãi biển mùa hè"].map(style => (
                <button 
                  key={style}
                  onClick={() => handleReplaceBackground(style)}
                  className="p-4 bg-slate-900 border border-white/5 rounded-xl text-xs font-medium hover:border-blue-500/50 transition-colors"
                >
                  {style}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Tab 3: Video */}
        {activeTab === 'video' && (
          <div className="space-y-6 text-center py-10 animate-in fade-in slide-in-from-bottom-4">
            <div className="w-20 h-20 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
               <span className="text-3xl">🎬</span>
            </div>
            <h2 className="text-xl font-bold italic">Sản Xuất Video</h2>
            <p className="text-sm text-slate-400 px-10">Tạo video quảng cáo Cinematic từ ảnh kết quả cuối cùng.</p>
            <button 
              onClick={handleMakeVideo}
              disabled={loading || !images.result}
              className="px-8 py-4 bg-white text-black rounded-full font-bold shadow-lg active:scale-95 transition-all disabled:opacity-20"
            >
              {loading ? "Đang tạo video..." : "Render Video 4K (Veo)"}
            </button>
          </div>
        )}

        {/* Tab 4: Cài đặt */}
        {activeTab === 'settings' && (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4">
            <h2 className="text-xl font-bold italic">Cài Đặt API</h2>
            <div className="bg-slate-900/50 border border-white/5 p-5 rounded-3xl space-y-4">
              <p className="text-xs text-slate-400 leading-relaxed">
                Ứng dụng sử dụng API Key cá nhân của bạn để bảo mật. Key này chỉ được lưu tại trình duyệt này (LocalStorage).
              </p>
              <input 
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Dán Google Gemini API Key..."
                className="w-full bg-[#020617] border border-white/10 p-4 rounded-xl focus:ring-2 ring-blue-500 outline-none text-sm"
              />
              <a 
                href="https://aistudio.google.com/app/apikey" 
                target="_blank" 
                rel="noreferrer"
                className="block text-center text-xs text-blue-400 font-medium"
              >
                Lấy Key miễn phí tại Google AI Studio →
              </a>
            </div>
          </div>
        )}

      </main>

      {/* --- BOTTOM NAVIGATION (Mobile optimized) --- */}
      <nav className="fixed bottom-0 left-0 right-0 h-20 bg-[#020617]/90 backdrop-blur-xl border-t border-white/5 flex justify-around items-center px-4 z-[100]">
        <NavButton active={activeTab === 'fit'} onClick={() => setActiveTab('fit')} icon="👕" label="Thử đồ" />
        <NavButton active={activeTab === 'scene'} onClick={() => setActiveTab('scene')} icon="🏢" label="Bối cảnh" />
        <NavButton active={activeTab === 'video'} onClick={() => setActiveTab('video')} icon="🎥" label="Video" />
        <NavButton active={activeTab === 'settings'} onClick={() => setActiveTab('settings')} icon="⚙️" label="Cài đặt" />
      </nav>
    </div>
  );
};

// Component con cho nút điều hướng
const NavButton = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: string, label: string }) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center justify-center space-y-1 transition-all ${active ? 'text-blue-400 scale-110' : 'text-slate-500'}`}
  >
    <span className="text-xl">{icon}</span>
    <span className="text-[10px] font-bold uppercase tracking-tighter">{label}</span>
    {active && <div className="w-1 h-1 bg-blue-400 rounded-full shadow-[0_0_8px_rgba(96,165,250,0.8)]"></div>}
  </button>
);

export default App;