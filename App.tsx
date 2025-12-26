import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Scissors, 
  Shirt, 
  Image as ImageIcon, 
  Video, 
  Key, 
  Sparkles, 
  Check, 
  AlertTriangle, 
  Download,
  Loader2
} from 'lucide-react';
import ImageUploader from './components/ImageUploader.tsx';
import { isolateProduct, compositeProduct, generateSalesVideo, replaceBackground, replaceBackgroundWithImage } from './services/geminiService.ts';

interface AIStudio {
  hasSelectedApiKey: () => Promise<boolean>;
  openSelectKey: () => Promise<void>;
}

const PRESET_STYLES = {
  cinematic: "Premium 4K cinematic commercial product showcase. Smooth slow-motion camera pan, elegant dynamic lighting, professional advertising aesthetic.",
  minimal: "Minimalist, clean product reveal. Soft white lighting, slow zoom in, high-key photography style, serene atmosphere.",
  energetic: "Dynamic, fast-paced commercial vibe. Vibrant colors, quick camera movements, bold lighting, energetic product display."
};

const CHECKERBOARD_STYLE: React.CSSProperties = {
  backgroundImage: 'linear-gradient(45deg, #1e293b 25%, transparent 25%), linear-gradient(-45deg, #1e293b 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1e293b 75%), linear-gradient(-45deg, transparent 75%, #1e293b 75%)',
  backgroundSize: '24px 24px',
  backgroundPosition: '0 0, 0 12px, 12px -12px, -12px 0px',
  opacity: 0.4 
};

type AppMode = 'standard' | 'premium';
type TabId = 1 | 2 | 3 | 4;

const App: React.FC = () => {
  const [appMode, setAppMode] = useState<AppMode>('standard'); 
  const [activeTab, setActiveTab] = useState<TabId>(1);
  
  const [productImg, setProductImg] = useState<string | null>(null); 
  const [isolatedImg, setIsolatedImg] = useState<string | null>(null); 
  const [finalImg, setFinalImg] = useState<string | null>(null); 
  const [bgReplacedImg, setBgReplacedImg] = useState<string | null>(null); 
  const [videoUrl, setVideoUrl] = useState<string | null>(null); 

  const [step2InputImg, setStep2InputImg] = useState<string | null>(null);
  const [step3InputImg, setStep3InputImg] = useState<string | null>(null);
  const [step4InputImg, setStep4InputImg] = useState<string | null>(null);
  const [templateImg, setTemplateImg] = useState<string | null>(null); 

  useEffect(() => { if (isolatedImg) setStep2InputImg(isolatedImg); }, [isolatedImg]);
  useEffect(() => { if (finalImg) setStep3InputImg(finalImg); }, [finalImg]);
  useEffect(() => { if (bgReplacedImg) setStep4InputImg(bgReplacedImg); }, [bgReplacedImg]);

  const [bgInputMode, setBgInputMode] = useState<'text' | 'image'>('text');
  const [customBgFile, setCustomBgFile] = useState<string | null>(null);
  const [bgAspectRatio, setBgAspectRatio] = useState<'1:1' | '16:9' | '9:16'>('1:1');
  const [bgPrompt, setBgPrompt] = useState<string>("");

  const [videoResolution, setVideoResolution] = useState<'720p' | '1080p'>('1080p');
  const [videoAspectRatio, setVideoAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [promptMode, setPromptMode] = useState<'auto' | 'custom'>('auto');
  const [autoStyle, setAutoStyle] = useState<keyof typeof PRESET_STYLES>('cinematic');
  const [customPrompt, setCustomPrompt] = useState<string>("");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");

  useEffect(() => {
    checkApiKey();
  }, []);

  const checkApiKey = async () => {
    try {
      if ((window as any).aistudio) {
        const selected = await ((window as any).aistudio as AIStudio).hasSelectedApiKey();
        setHasApiKey(selected);
        return selected;
      } else {
        setHasApiKey(true); 
        return true;
      }
    } catch (e) { return false; }
  };

  const handleOpenKeySelector = async () => {
    if ((window as any).aistudio) {
      await ((window as any).aistudio as AIStudio).openSelectKey();
      setHasApiKey(true);
      setError(null);
    } else {
        alert("Vui lòng cấu hình GEMINI_API_KEY trong file .env.local nếu chạy cục bộ.");
    }
  };

  const ensureApiKey = async () => {
    const active = await checkApiKey();
    if (!active) {
      await handleOpenKeySelector();
      return true; 
    }
    return true;
  };

  const handleError = async (err: any, isVideo = false) => {
    console.error("Error details:", err);
    let msg = "";
    if (err.error && err.error.message) msg = err.error.message;
    else if (err.message) msg = err.message;
    else msg = "Unknown error";

    if (msg.includes("429") || msg.includes("quota")) {
        setError("⚠️ Quá tải: Vui lòng thử lại sau giây lát.");
    } else if (msg.includes("403") || msg.includes("PERMISSION_DENIED") || msg.includes("Requested entity was not found")) {
        setHasApiKey(false);
        setError("⚠️ Lỗi xác thực/Thanh toán: Vui lòng chọn lại API Key.");
        await handleOpenKeySelector();
    } else {
       setError(`Lỗi: ${msg.substring(0, 100)}...`);
    }
  };

  const handleIsolate = async () => {
    if (!productImg) return;
    if (!await ensureApiKey()) return;
    setLoading(true); setLoadingMsg("AI đang tách nền..."); setError(null);
    try {
      const result = await isolateProduct(productImg, appMode);
      setIsolatedImg(result); 
      setStep2InputImg(result);
      if (window.innerWidth >= 768) setActiveTab(2); // Auto switch on desktop
    } catch (err: any) { handleError(err); } finally { setLoading(false); }
  };

  const handleComposite = async () => {
    if (!step2InputImg || !templateImg) return;
    if (!await ensureApiKey()) return;
    setLoading(true); setLoadingMsg("AI đang ghép ảnh..."); setError(null);
    try {
      const result = await compositeProduct(step2InputImg, templateImg, appMode);
      setFinalImg(result);
      setStep3InputImg(result);
      if (window.innerWidth >= 768) setActiveTab(3);
    } catch (err: any) { handleError(err); } finally { setLoading(false); }
  };

  const handleReplaceBackground = async () => {
    if (!step3InputImg) return;
    if (!await ensureApiKey()) return;
    setLoading(true); setLoadingMsg("AI đang thay đổi bối cảnh..."); setError(null);
    try {
      let result = "";
      if (bgInputMode === 'image' && customBgFile) {
         result = await replaceBackgroundWithImage(step3InputImg, customBgFile, appMode, bgAspectRatio);
      } else {
         result = await replaceBackground(step3InputImg, bgPrompt, appMode, bgAspectRatio);
      }
      setBgReplacedImg(result);
      setStep4InputImg(result);
      if (window.innerWidth >= 768) setActiveTab(4); 
    } catch (err: any) { handleError(err); } finally { setLoading(false); }
  };

  const handleGenerateVideo = async () => {
    if (!step4InputImg) return;
    if (!await ensureApiKey()) return;
    setLoading(true); setLoadingMsg("Đang render video (Veo)..."); setError(null);
    const finalPrompt = promptMode === 'auto' ? PRESET_STYLES[autoStyle] : customPrompt;
    try {
      const url = await generateSalesVideo(
        { base64: step4InputImg, mimeType: 'image/png' },
        { resolution: videoResolution, aspectRatio: videoAspectRatio, mode: appMode, prompt: finalPrompt }
      );
      setVideoUrl(url);
    } catch (err: any) { handleError(err, true); } finally { setLoading(false); }
  };

  const preview = useMemo(() => {
    if (activeTab === 4) return videoUrl ? { type: 'video', src: videoUrl } : (step4InputImg ? { type: 'image', src: step4InputImg } : null);
    if (activeTab === 3) return bgReplacedImg ? { type: 'image', src: bgReplacedImg } : (step3InputImg ? { type: 'image', src: step3InputImg } : null);
    if (activeTab === 2) return finalImg ? { type: 'image', src: finalImg } : (step2InputImg ? { type: 'image', src: step2InputImg } : null);
    if (activeTab === 1) return isolatedImg ? { type: 'image', src: isolatedImg } : (productImg ? { type: 'image', src: productImg } : null);
    return null;
  }, [activeTab, videoUrl, bgReplacedImg, finalImg, isolatedImg, productImg, step2InputImg, step3InputImg, step4InputImg]);

  // --- Sub-components for Cleaner Code ---

  const HeaderControls = () => (
    <div className="flex items-center gap-3">
        <button onClick={() => setAppMode(m => m === 'standard' ? 'premium' : 'standard')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${appMode === 'premium' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'bg-slate-800 text-slate-400'}`}>
            <Sparkles size={12} />
            {appMode === 'premium' ? 'PRO' : 'FREE'}
        </button>
        <button onClick={handleOpenKeySelector} className={`p-2 rounded-full transition-colors ${hasApiKey ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400 animate-pulse'}`}>
             <Key size={16} />
        </button>
    </div>
  );

  const PreviewSection = ({ isMobile = false }: { isMobile?: boolean }) => {
    if (!preview && !isMobile) {
        return (
            <div className="opacity-20 flex flex-col items-center">
                <ImageIcon className="w-20 h-20 mb-4" />
                <p className="text-sm">Vui lòng tải ảnh lên để bắt đầu</p>
            </div>
        )
    }

    if (!preview) return null;

    return (
        <div className={`relative z-10 w-full rounded-xl overflow-hidden shadow-2xl border border-white/10 ${isMobile ? 'mb-6 aspect-square' : 'max-h-[75vh] max-w-full'}`}>
             <div className="absolute inset-0 z-0" style={CHECKERBOARD_STYLE}></div>
             {preview.type === 'video' ? (
                <video src={preview.src} controls autoPlay loop className="relative z-10 w-full h-full object-contain bg-black/50" />
             ) : (
                <img src={preview.src} alt="Preview" className="relative z-10 w-full h-full object-contain" />
             )}
             
             {/* Download Overlay */}
             <a 
                href={preview.src} 
                download={`pn-studio-${Date.now()}`}
                className="absolute top-2 right-2 z-20 p-2 bg-black/60 backdrop-blur-md rounded-lg text-white hover:bg-indigo-600 transition-colors"
             >
                <Download size={16} />
             </a>
        </div>
    );
  };

  const ControlsContent = () => (
    <div className="space-y-6">
        {activeTab === 1 && (
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider">Bước 1: Tách nền</h3>
                    {isolatedImg && <Check size={16} className="text-emerald-400" />}
                </div>
                <ImageUploader id="up-p" label="Ảnh sản phẩm gốc" image={productImg} onUpload={setProductImg} />
                <button 
                    onClick={handleIsolate} 
                    disabled={!productImg || loading} 
                    className="w-full py-4 bg-indigo-600 rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-500 transition-all flex items-center justify-center gap-2 touch-manipulation"
                >
                    {loading ? <Loader2 className="animate-spin" /> : <Scissors size={18} />}
                    <span>Tách nền ngay</span>
                </button>
            </div>
        )}

        {activeTab === 2 && (
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider">Bước 2: Thử đồ ảo</h3>
                    {finalImg && <Check size={16} className="text-emerald-400" />}
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <ImageUploader id="up-s2" label="Sản phẩm" image={step2InputImg} onUpload={setStep2InputImg} compact />
                    <ImageUploader id="up-t" label="Người mẫu" image={templateImg} onUpload={setTemplateImg} compact />
                </div>
                <button 
                    onClick={handleComposite} 
                    disabled={!step2InputImg || !templateImg || loading} 
                    className="w-full py-4 bg-indigo-600 rounded-xl font-bold disabled:opacity-50 flex items-center justify-center gap-2 touch-manipulation"
                >
                    {loading ? <Loader2 className="animate-spin" /> : <Shirt size={18} />}
                    <span>Ghép lên mẫu</span>
                </button>
            </div>
        )}

        {activeTab === 3 && (
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider">Bước 3: Bối cảnh</h3>
                    {bgReplacedImg && <Check size={16} className="text-emerald-400" />}
                </div>
                
                <div className="p-4 bg-slate-900/50 rounded-xl space-y-4 border border-white/5">
                    <textarea 
                        value={bgPrompt} 
                        onChange={e => setBgPrompt(e.target.value)} 
                        placeholder="Mô tả bối cảnh mong muốn (Ví dụ: Trên bàn gỗ sồi, ánh sáng nắng sớm...)" 
                        className="w-full h-24 bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none" 
                    />
                    <button 
                        onClick={handleReplaceBackground} 
                        disabled={loading || !step3InputImg} 
                        className="w-full py-4 bg-indigo-600 rounded-xl font-bold disabled:opacity-50 flex items-center justify-center gap-2 touch-manipulation"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : <ImageIcon size={18} />}
                        <span>Tạo bối cảnh</span>
                    </button>
                </div>
            </div>
        )}

        {activeTab === 4 && (
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-pink-400 uppercase tracking-wider">Bước 4: Video Cinematic</h3>
                    {videoUrl && <Check size={16} className="text-emerald-400" />}
                </div>
                <ImageUploader id="up-s4" label="Ảnh Keyframe" image={step4InputImg} onUpload={setStep4InputImg} compact />
                <button 
                    onClick={handleGenerateVideo} 
                    disabled={loading || !step4InputImg} 
                    className="w-full py-4 bg-gradient-to-r from-pink-600 to-indigo-600 rounded-xl font-bold shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 touch-manipulation"
                >
                    {loading ? <Loader2 className="animate-spin" /> : <Video size={18} />}
                    <span>Render Video (Veo)</span>
                </button>
            </div>
        )}
    </div>
  );

  return (
    <div className="flex h-screen bg-[#020617] text-slate-200 overflow-hidden font-sans">
      {/* Background Ambience */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-indigo-900/10 blur-[100px]"></div>
        <div className="absolute top-[40%] -right-[10%] w-[50%] h-[50%] rounded-full bg-violet-900/10 blur-[100px]"></div>
      </div>

      {/* --- MOBILE LAYOUT (< md) --- */}
      <div className="md:hidden flex flex-col w-full h-full relative z-10">
        {/* Mobile Header */}
        <header className="h-16 flex items-center justify-between px-4 border-b border-white/5 bg-slate-900/80 backdrop-blur-md">
            <div className="font-bold text-white text-base tracking-tight">Phúc Nguyễn AI</div>
            <HeaderControls />
        </header>

        {/* Mobile Content Area (Stack: Preview -> Controls) */}
        <main className="flex-1 overflow-y-auto custom-scrollbar p-4 pb-24">
            <AnimatePresence mode="wait">
                <motion.div 
                    key={activeTab}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                >
                   {error && <div className="mb-4 p-3 bg-red-950/50 border border-red-500/30 rounded-lg flex items-center gap-2 text-red-200 text-xs"><AlertTriangle size={16} /> {error}</div>}
                   
                   {/* Combined Preview & Controls for Mobile Context */}
                   <PreviewSection isMobile />
                   <ControlsContent />

                </motion.div>
            </AnimatePresence>
        </main>

        {/* Mobile Fixed Bottom Nav */}
        <nav className="fixed bottom-0 left-0 w-full bg-slate-900/90 backdrop-blur-xl border-t border-white/5 flex justify-around items-center px-2 py-2 pb-safe z-50">
            {[
                { id: 1, icon: Scissors, label: "Tách" },
                { id: 2, icon: Shirt, label: "Ghép" },
                { id: 3, icon: ImageIcon, label: "Nền" },
                { id: 4, icon: Video, label: "Video" }
            ].map((tab) => (
                <button 
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as TabId)}
                    className={`flex flex-col items-center justify-center p-2 rounded-xl w-16 h-16 transition-all ${activeTab === tab.id ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    <tab.icon size={24} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
                    <span className="text-[10px] font-medium mt-1">{tab.label}</span>
                </button>
            ))}
        </nav>
      </div>

      {/* --- DESKTOP LAYOUT (>= md) --- */}
      <div className="hidden md:flex w-full h-full relative z-10">
        
        {/* Sidebar */}
        <aside className="w-[380px] lg:w-[420px] h-full flex flex-col border-r border-slate-800/50 bg-slate-900/60 backdrop-blur-2xl shadow-2xl z-20">
            <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
                        <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <h1 className="font-bold text-white text-lg">Phúc Nguyễn AI</h1>
                </div>
                <HeaderControls />
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
                 {/* Desktop Tabs as Accordion or Just Buttons to switch view */}
                 <div className="grid grid-cols-4 gap-2 mb-8 bg-slate-950/50 p-1 rounded-xl">
                    {[1,2,3,4].map(id => (
                        <button 
                            key={id}
                            onClick={() => setActiveTab(id as TabId)}
                            className={`py-2 rounded-lg text-xs font-bold transition-all ${activeTab === id ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                        >
                            Bước {id}
                        </button>
                    ))}
                 </div>

                 <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        transition={{ duration: 0.2 }}
                    >
                         <ControlsContent />
                    </motion.div>
                 </AnimatePresence>

                 {error && <div className="mt-6 p-4 bg-red-950/80 border border-red-500/30 rounded-xl text-red-200 text-xs flex gap-2"><AlertTriangle size={16} /> {error}</div>}
            </div>
        </aside>

        {/* Main Preview Area */}
        <main className="flex-1 flex flex-col min-w-0 bg-[#020617]/50">
            <div className="h-16 border-b border-white/5 flex items-center justify-between px-8 bg-slate-900/30 backdrop-blur-md">
                 <div className="text-sm font-medium text-slate-300 flex items-center gap-2">
                     {loading && <Loader2 className="animate-spin text-indigo-400" size={16} />}
                     {loading ? <span className="animate-pulse">{loadingMsg}</span> : 'Studio Preview'}
                 </div>
            </div>
            
            <div className="flex-1 flex items-center justify-center p-12 relative overflow-hidden">
               <div className="absolute inset-0 z-0" style={CHECKERBOARD_STYLE}></div>
               <PreviewSection />
            </div>
        </main>
      </div>

    </div>
  );
};

export default App;