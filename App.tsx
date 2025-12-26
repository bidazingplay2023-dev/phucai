import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  Loader2,
  Settings,
  X,
  Play,
  Wand2,
  Type,
  Upload,
  RectangleHorizontal,
  RectangleVertical,
  Square,
  Monitor
} from 'lucide-react';
import ImageUploader from './components/ImageUploader.tsx';
import { 
  isolateAndCompositeProduct, 
  generateSalesVideo, 
  replaceBackground, 
  replaceBackgroundWithImage,
  suggestBackgrounds,
  getStoredApiKey,
  setStoredApiKey,
  validateApiKey
} from './services/geminiService.ts';

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
// Consolidated Tabs: 1 = Try-On (Isolate+Composite), 2 = Background, 3 = Video
type TabId = 1 | 2 | 3;

// Supported Aspect Ratios for Gemini
type AspectRatio = '9:16' | '1:1' | '4:3' | '16:9';

const App: React.FC = () => {
  const [appMode, setAppMode] = useState<AppMode>('standard'); 
  const [activeTab, setActiveTab] = useState<TabId>(1);
  const [showSettings, setShowSettings] = useState(false);
  
  // Inputs
  const [productImg, setProductImg] = useState<string | null>(null); 
  const [modelImg, setModelImg] = useState<string | null>(null);

  // Step 1: Aspect Ratio
  const [tryOnAspectRatio, setTryOnAspectRatio] = useState<AspectRatio>('9:16');

  // Outputs / Intermediates
  const [tryOnResult, setTryOnResult] = useState<string | null>(null); // Result of merged step 1 & 2
  const [bgReplacedImg, setBgReplacedImg] = useState<string | null>(null); 
  const [videoUrl, setVideoUrl] = useState<string | null>(null); 

  // Derived inputs for subsequent steps
  const [step2InputImg, setStep2InputImg] = useState<string | null>(null);
  const [step3InputImg, setStep3InputImg] = useState<string | null>(null);

  useEffect(() => { if (tryOnResult) setStep2InputImg(tryOnResult); }, [tryOnResult]);
  useEffect(() => { if (bgReplacedImg) setStep3InputImg(bgReplacedImg); }, [bgReplacedImg]);

  const [bgInputMode, setBgInputMode] = useState<'text' | 'image'>('text');
  const [customBgFile, setCustomBgFile] = useState<string | null>(null);
  const [bgAspectRatio, setBgAspectRatio] = useState<AspectRatio>('1:1');
  const [bgPrompt, setBgPrompt] = useState<string>("");
  
  // Suggestion State
  const [bgSuggestions, setBgSuggestions] = useState<string[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [hasSuggested, setHasSuggested] = useState(false);

  // Auto-suggest when entering step 2 with a new image
  useEffect(() => {
    const fetchSuggestions = async () => {
        if (!step2InputImg || hasSuggested || !getStoredApiKey()) return;
        
        setIsSuggesting(true);
        try {
            const suggestions = await suggestBackgrounds(step2InputImg);
            setBgSuggestions(suggestions);
            setHasSuggested(true);
        } catch (e) { 
            console.error(e); 
        } finally { 
            setIsSuggesting(false); 
        }
    };
    
    if (activeTab === 2 && step2InputImg && !hasSuggested) {
        fetchSuggestions();
    }
  }, [step2InputImg, activeTab, hasSuggested]);
  
  // Reset suggestions if step 1 result changes
  useEffect(() => {
      setHasSuggested(false);
      setBgSuggestions([]);
  }, [step2InputImg]);


  const [videoResolution, setVideoResolution] = useState<'720p' | '1080p'>('1080p');
  const [videoAspectRatio, setVideoAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [promptMode, setPromptMode] = useState<'auto' | 'custom'>('auto');
  const [autoStyle, setAutoStyle] = useState<keyof typeof PRESET_STYLES>('cinematic');
  const [customPrompt, setCustomPrompt] = useState<string>("");
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingMsg, setLoadingMsg] = useState("");

  const ensureApiKey = (): boolean => {
    const key = getStoredApiKey();
    if (!key) {
      setShowSettings(true);
      setError("Vui lòng nhập API Key để tiếp tục.");
      return false;
    }
    return true;
  };

  const handleError = async (err: any) => {
    console.error("Error details:", err);
    let msg = "";
    if (err.error && err.error.message) msg = err.error.message;
    else if (err.message) msg = err.message;
    else msg = "Unknown error";

    if (msg.includes("429") || msg.includes("quota")) {
        setError("⚠️ Quá tải: Vui lòng thử lại sau giây lát.");
    } else if (msg.includes("API Key missing") || msg.includes("403")) {
        setShowSettings(true);
        setError("⚠️ Key thiếu hoặc không hợp lệ.");
    } else {
       setError(`Lỗi: ${msg.substring(0, 100)}...`);
    }
  };

  // --- Combined Handler ---
  const handleTryOn = async () => {
    if (!productImg || !modelImg) return;
    if (!ensureApiKey()) return;
    
    setLoading(true); 
    setLoadingMsg("AI đang tách & ghép đồ (2-in-1)..."); 
    setError(null);
    
    try {
      const result = await isolateAndCompositeProduct(productImg, modelImg, appMode, tryOnAspectRatio);
      setTryOnResult(result); 
      setStep2InputImg(result);
      if (window.innerWidth >= 768) setActiveTab(2); 
    } catch (err: any) { handleError(err); } finally { setLoading(false); }
  };

  const handleReplaceBackground = async () => {
    if (!step2InputImg) return;
    if (!ensureApiKey()) return;
    setLoading(true); setLoadingMsg("AI đang tạo bối cảnh..."); setError(null);
    try {
      let result = "";
      if (bgInputMode === 'image' && customBgFile) {
         result = await replaceBackgroundWithImage(step2InputImg, customBgFile, appMode, bgAspectRatio);
      } else {
         result = await replaceBackground(step2InputImg, bgPrompt, appMode, bgAspectRatio);
      }
      setBgReplacedImg(result);
      setStep3InputImg(result);
      if (window.innerWidth >= 768) setActiveTab(3); 
    } catch (err: any) { handleError(err); } finally { setLoading(false); }
  };

  const handleGenerateVideo = async () => {
    if (!step3InputImg) return;
    if (!ensureApiKey()) return;
    setLoading(true); setLoadingMsg("Đang render video (Veo)..."); setError(null);
    const finalPrompt = promptMode === 'auto' ? PRESET_STYLES[autoStyle] : customPrompt;
    try {
      const url = await generateSalesVideo(
        { base64: step3InputImg, mimeType: 'image/png' },
        { resolution: videoResolution, aspectRatio: videoAspectRatio, mode: appMode, prompt: finalPrompt }
      );
      setVideoUrl(url);
    } catch (err: any) { handleError(err); } finally { setLoading(false); }
  };

  const preview = useMemo(() => {
    if (activeTab === 3) return videoUrl ? { type: 'video', src: videoUrl } : (step3InputImg ? { type: 'image', src: step3InputImg } : null);
    if (activeTab === 2) return bgReplacedImg ? { type: 'image', src: bgReplacedImg } : (step2InputImg ? { type: 'image', src: step2InputImg } : null);
    if (activeTab === 1) return tryOnResult ? { type: 'image', src: tryOnResult } : (productImg ? { type: 'image', src: productImg } : null);
    return null;
  }, [activeTab, videoUrl, bgReplacedImg, tryOnResult, productImg, step2InputImg, step3InputImg]);

  // --- SETTINGS MODAL (BYOK) ---
  const SettingsModal = () => {
    const [tempKey, setTempKey] = useState(getStoredApiKey() || "");
    const [status, setStatus] = useState<'idle' | 'testing' | 'success' | 'invalid'>('idle');

    const handleSave = async () => {
      setStatus('testing');
      const isValid = await validateApiKey(tempKey);
      if (isValid) {
        setStoredApiKey(tempKey);
        setStatus('success');
        setTimeout(() => setShowSettings(false), 800);
      } else {
        setStatus('invalid');
      }
    };

    return (
        <AnimatePresence>
            {showSettings && (
                <>
                <motion.div 
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
                    onClick={() => setShowSettings(false)}
                />
                <motion.div 
                    initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="fixed bottom-0 left-0 right-0 md:top-1/2 md:left-1/2 md:bottom-auto md:-translate-x-1/2 md:-translate-y-1/2 md:w-[480px] bg-slate-900 border-t md:border border-slate-700 rounded-t-2xl md:rounded-2xl p-6 z-50 shadow-2xl"
                >
                    <div className="flex justify-between items-center mb-6">
                        <h2 className="text-xl font-bold text-white flex items-center gap-2"><Settings size={20} /> Cài đặt hệ thống</h2>
                        <button onClick={() => setShowSettings(false)} className="p-2 hover:bg-white/10 rounded-full"><X size={20} /></button>
                    </div>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Gemini API Key</label>
                            <input 
                                type="password" 
                                value={tempKey}
                                onChange={(e) => setTempKey(e.target.value)}
                                placeholder="sk-..."
                                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-4 text-sm text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                            />
                            <p className="text-[10px] text-slate-500 mt-2">Key được lưu mã hóa an toàn trong trình duyệt của bạn (localStorage).</p>
                        </div>

                        <div className="flex gap-3 pt-2">
                             <button 
                                onClick={handleSave}
                                disabled={status === 'testing' || !tempKey}
                                className={`flex-1 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all ${status === 'success' ? 'bg-emerald-600 text-white' : status === 'invalid' ? 'bg-red-600 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-500'}`}
                             >
                                {status === 'testing' && <Loader2 className="animate-spin" size={18} />}
                                {status === 'success' && <Check size={18} />}
                                {status === 'invalid' && <AlertTriangle size={18} />}
                                {status === 'idle' && "Kiểm tra & Lưu"}
                                {status === 'success' && "Đã lưu!"}
                                {status === 'invalid' && "Key không hợp lệ"}
                             </button>
                        </div>
                        
                        <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="block text-center text-xs text-indigo-400 hover:text-indigo-300 py-2">
                            Lấy API Key tại đây &rarr;
                        </a>
                    </div>
                </motion.div>
                </>
            )}
        </AnimatePresence>
    );
  };

  const HeaderControls = () => (
    <div className="flex items-center gap-3">
        <button onClick={() => setAppMode(m => m === 'standard' ? 'premium' : 'standard')} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${appMode === 'premium' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-500/30' : 'bg-slate-800 text-slate-400'}`}>
            <Sparkles size={12} />
            {appMode === 'premium' ? 'PRO' : 'FREE'}
        </button>
        <button onClick={() => setShowSettings(true)} className={`p-2 rounded-full transition-colors bg-slate-800/50 hover:bg-slate-700 text-slate-300`}>
             <Settings size={20} />
        </button>
    </div>
  );

  const AspectRatioButton = ({ 
    ratio, 
    current, 
    onChange 
  }: { 
    ratio: AspectRatio, 
    current: AspectRatio, 
    onChange: (r: AspectRatio) => void 
  }) => {
     let Icon = Square;
     if (ratio === '9:16') Icon = RectangleVertical;
     if (ratio === '16:9') Icon = RectangleHorizontal;
     if (ratio === '4:3') Icon = Monitor;

     return (
        <button 
           onClick={() => onChange(ratio)}
           className={`flex flex-col items-center justify-center p-2 rounded-lg transition-all border ${
              current === ratio 
              ? 'bg-indigo-600 border-indigo-500 text-white shadow-md' 
              : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'
           }`}
        >
           <Icon size={18} className="mb-1" />
           <span className="text-[10px] font-bold">{ratio}</span>
        </button>
     );
  };

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
             
             <a 
                href={preview.src} 
                download={`pn-studio-${Date.now()}`}
                className="absolute top-2 right-2 z-20 w-[44px] h-[44px] flex items-center justify-center bg-black/60 backdrop-blur-md rounded-xl text-white hover:bg-indigo-600 transition-colors"
             >
                <Download size={20} />
             </a>
        </div>
    );
  };

  const ControlsContent = () => (
    <div className="space-y-6 pb-6">
        {activeTab === 1 && (
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider">Thử đồ (2-trong-1)</h3>
                    {tryOnResult && <Check size={16} className="text-emerald-400" />}
                </div>
                <div className="grid grid-cols-2 gap-3">
                    <ImageUploader id="up-p" label="1. Quần áo" image={productImg} onUpload={setProductImg} compact />
                    <ImageUploader id="up-m" label="2. Người mẫu" image={modelImg} onUpload={setModelImg} compact />
                </div>
                
                {/* Aspect Ratio Selector */}
                <div>
                   <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 pl-1">Tỉ lệ khung hình</label>
                   <div className="grid grid-cols-4 gap-2">
                       <AspectRatioButton ratio="9:16" current={tryOnAspectRatio} onChange={setTryOnAspectRatio} />
                       <AspectRatioButton ratio="1:1" current={tryOnAspectRatio} onChange={setTryOnAspectRatio} />
                       <AspectRatioButton ratio="4:3" current={tryOnAspectRatio} onChange={setTryOnAspectRatio} />
                       <AspectRatioButton ratio="16:9" current={tryOnAspectRatio} onChange={setTryOnAspectRatio} />
                   </div>
                </div>

                <button 
                    onClick={handleTryOn} 
                    disabled={!productImg || !modelImg || loading} 
                    className="w-full h-[52px] bg-indigo-600 rounded-xl font-bold text-base disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-500 transition-all flex items-center justify-center gap-2 touch-manipulation shadow-lg shadow-indigo-500/20"
                >
                    {loading ? <Loader2 className="animate-spin" /> : <Shirt size={20} />}
                    <span>Bắt đầu Thử Đồ</span>
                </button>
            </div>
        )}

        {activeTab === 2 && (
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-indigo-400 uppercase tracking-wider">Tạo Bối Cảnh</h3>
                    {bgReplacedImg && <Check size={16} className="text-emerald-400" />}
                </div>
                
                <div className="p-4 bg-slate-900/50 rounded-xl space-y-4 border border-white/5">
                    {/* Tab Switcher for Background Source */}
                    <div className="flex bg-slate-950 p-1 rounded-lg mb-2">
                        <button 
                            onClick={() => setBgInputMode('text')}
                            className={`flex-1 py-2 rounded-md text-xs font-bold flex items-center justify-center gap-2 transition-all ${bgInputMode === 'text' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            <Type size={14} /> Prompt AI
                        </button>
                        <button 
                            onClick={() => setBgInputMode('image')}
                            className={`flex-1 py-2 rounded-md text-xs font-bold flex items-center justify-center gap-2 transition-all ${bgInputMode === 'image' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'}`}
                        >
                            <Upload size={14} /> Upload Ảnh
                        </button>
                    </div>

                    {bgInputMode === 'text' ? (
                        <>
                            <textarea 
                                value={bgPrompt} 
                                onChange={e => setBgPrompt(e.target.value)} 
                                placeholder="Mô tả bối cảnh (Ví dụ: Studio hiện đại, ánh sáng ấm...)" 
                                className="w-full h-24 bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm focus:ring-2 focus:ring-indigo-500 outline-none transition-all placeholder:text-slate-600" 
                            />
                            
                            {/* Suggestions Area */}
                            {step2InputImg && (
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-[10px] font-bold text-indigo-300 uppercase tracking-wider">
                                        <Wand2 size={12} />
                                        <span>Gợi ý thông minh {isSuggesting && "..."}</span>
                                    </div>
                                    <div className="flex flex-wrap gap-2 max-h-[120px] overflow-y-auto custom-scrollbar">
                                        {isSuggesting && bgSuggestions.length === 0 ? (
                                            <div className="text-xs text-slate-500 animate-pulse italic">Đang phân tích ảnh để gợi ý...</div>
                                        ) : (
                                            bgSuggestions.map((sug, idx) => (
                                                <button 
                                                    key={idx}
                                                    onClick={() => setBgPrompt(sug)}
                                                    className="text-left px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 hover:border-indigo-500/40 text-indigo-200 text-xs rounded-lg transition-colors"
                                                >
                                                    {sug}
                                                </button>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <ImageUploader 
                            id="bg-upload" 
                            label="Tải ảnh nền lên" 
                            image={customBgFile} 
                            onUpload={setCustomBgFile} 
                            compact 
                        />
                    )}

                    <button 
                        onClick={handleReplaceBackground} 
                        disabled={loading || !step2InputImg || (bgInputMode === 'image' && !customBgFile)} 
                        className="w-full h-[52px] bg-indigo-600 rounded-xl font-bold text-base disabled:opacity-50 flex items-center justify-center gap-2 touch-manipulation shadow-lg mt-2"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : <ImageIcon size={20} />}
                        <span>{bgInputMode === 'text' ? "Tạo bối cảnh AI" : "Ghép vào nền"}</span>
                    </button>
                </div>
            </div>
        )}

        {activeTab === 3 && (
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-pink-400 uppercase tracking-wider">Video Cinematic</h3>
                    {videoUrl && <Check size={16} className="text-emerald-400" />}
                </div>
                <div className="p-4 bg-slate-900/50 rounded-xl space-y-4 border border-pink-500/10">
                    <div className="flex gap-2">
                        {Object.keys(PRESET_STYLES).map(style => (
                            <button 
                                key={style}
                                onClick={() => { setAutoStyle(style as any); setPromptMode('auto'); }}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold capitalize transition-all ${autoStyle === style && promptMode === 'auto' ? 'bg-pink-600 text-white' : 'bg-slate-800 text-slate-400'}`}
                            >
                                {style}
                            </button>
                        ))}
                    </div>
                    <button 
                        onClick={handleGenerateVideo} 
                        disabled={loading || !step3InputImg} 
                        className="w-full h-[52px] bg-gradient-to-r from-pink-600 to-indigo-600 rounded-xl font-bold text-base shadow-lg disabled:opacity-50 flex items-center justify-center gap-2 touch-manipulation"
                    >
                        {loading ? <Loader2 className="animate-spin" /> : <Video size={20} />}
                        <span>Render Video (Veo)</span>
                    </button>
                </div>
            </div>
        )}
    </div>
  );

  return (
    <div className="flex h-screen bg-[#020617] text-slate-200 overflow-hidden font-sans">
      <SettingsModal />
      
      {/* Background Ambience */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-indigo-900/10 blur-[100px]"></div>
        <div className="absolute top-[40%] -right-[10%] w-[50%] h-[50%] rounded-full bg-violet-900/10 blur-[100px]"></div>
      </div>

      {/* --- MOBILE LAYOUT (< md) --- */}
      <div className="md:hidden flex flex-col w-full h-full relative z-10">
        <header className="h-16 flex items-center justify-between px-4 border-b border-white/5 bg-slate-900/80 backdrop-blur-md">
            <div className="font-bold text-white text-base tracking-tight">Phúc Nguyễn AI</div>
            <HeaderControls />
        </header>

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
                   <PreviewSection isMobile />
                   <ControlsContent />
                </motion.div>
            </AnimatePresence>
        </main>

        {/* Mobile Sticky Bottom Nav */}
        <nav className="fixed bottom-0 left-0 w-full bg-slate-900/95 backdrop-blur-xl border-t border-white/10 flex justify-around items-center px-2 py-1 pb-safe z-40 shadow-[0_-5px_20px_rgba(0,0,0,0.3)]">
            {[
                { id: 1, icon: Shirt, label: "Thử Đồ" },
                { id: 2, icon: ImageIcon, label: "Bối Cảnh" },
                { id: 3, icon: Video, label: "Video" }
            ].map((tab) => (
                <button 
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as TabId)}
                    className={`flex flex-col items-center justify-center rounded-xl w-full h-[60px] transition-all relative ${activeTab === tab.id ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
                >
                    {activeTab === tab.id && (
                        <motion.div layoutId="bubble" className="absolute inset-x-4 top-1 bottom-1 bg-indigo-500/10 rounded-lg -z-10" />
                    )}
                    <tab.icon size={24} strokeWidth={activeTab === tab.id ? 2.5 : 2} />
                    <span className="text-[10px] font-medium mt-1">{tab.label}</span>
                </button>
            ))}
        </nav>
      </div>

      {/* --- DESKTOP LAYOUT (>= md) --- */}
      <div className="hidden md:flex w-full h-full relative z-10">
        <aside className="w-[400px] h-full flex flex-col border-r border-slate-800/50 bg-slate-900/60 backdrop-blur-2xl shadow-2xl z-20">
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
                 <div className="grid grid-cols-3 gap-2 mb-8 bg-slate-950/50 p-1 rounded-xl">
                    {[
                        { id: 1, label: "1. Thử Đồ" },
                        { id: 2, label: "2. Bối Cảnh" },
                        { id: 3, label: "3. Video" }
                    ].map(tab => (
                        <button 
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id as TabId)}
                            className={`py-2 rounded-lg text-xs font-bold transition-all ${activeTab === tab.id ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
                        >
                            {tab.label}
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