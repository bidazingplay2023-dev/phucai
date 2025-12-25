import React, { useState, useEffect, useRef, useMemo } from 'react';
import ImageUploader from './components/ImageUploader.tsx';
import { isolateProduct, compositeProduct, generateSalesVideo, suggestVideoPrompt, replaceBackground, replaceBackgroundWithImage, suggestBackgroundIdeas } from './services/geminiService.ts';

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

const App: React.FC = () => {
  const [appMode, setAppMode] = useState<AppMode>('standard'); 
  const [activeTab, setActiveTab] = useState<1 | 2 | 3 | 4>(1);
  
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
  const [isSuggestingBg, setIsSuggestingBg] = useState(false);

  const [videoResolution, setVideoResolution] = useState<'720p' | '1080p'>('1080p');
  const [videoAspectRatio, setVideoAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [promptMode, setPromptMode] = useState<'auto' | 'custom'>('auto');
  const [autoStyle, setAutoStyle] = useState<keyof typeof PRESET_STYLES>('cinematic');
  const [customPrompt, setCustomPrompt] = useState<string>("");
  
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");

  const step1Ref = useRef<HTMLDivElement>(null);
  const step2Ref = useRef<HTMLDivElement>(null);
  const step3Ref = useRef<HTMLDivElement>(null);
  const step4Ref = useRef<HTMLDivElement>(null);

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
        setHasApiKey(true); // Fallback for env variables
        return true;
      }
    } catch (e) { return false; }
  };

  const handleOpenKeySelector = async () => {
    if ((window as any).aistudio) {
      await ((window as any).aistudio as AIStudio).openSelectKey();
      // Assume selection successful as per guidelines
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
        setError("⚠️ Lỗi xác thực/Thanh toán: Vui lòng chọn lại API Key có hỗ trợ tính năng này.");
        // Gợi ý mở lại dialog chọn key ngay lập tức nếu lỗi 403
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
      setActiveTab(2);
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
      setActiveTab(3);
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
      setActiveTab(4); 
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

  return (
    <div className="flex flex-col lg:flex-row h-screen bg-[#020617] text-slate-200 overflow-hidden font-sans">
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-[20%] -left-[10%] w-[60%] h-[60%] rounded-full bg-indigo-900/10 blur-[100px]"></div>
        <div className="absolute top-[40%] -right-[10%] w-[50%] h-[50%] rounded-full bg-violet-900/10 blur-[100px]"></div>
      </div>

      <aside className="order-2 lg:order-1 w-full lg:w-[420px] h-[60%] lg:h-full flex-shrink-0 flex flex-col border-t lg:border-t-0 lg:border-r border-slate-800/50 bg-slate-900/60 backdrop-blur-2xl relative z-20 shadow-2xl">
        <div className="hidden lg:flex px-6 py-5 border-b border-white/5 items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-pink-500 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547" /></svg>
            </div>
            <div>
              <h1 className="font-bold text-white text-lg">Phúc Nguyễn AI</h1>
              <div className="flex items-center gap-2">
                <button onClick={() => setAppMode(m => m === 'standard' ? 'premium' : 'standard')} className={`text-[10px] font-bold px-2 py-0.5 rounded ${appMode === 'premium' ? 'bg-indigo-600' : 'bg-slate-800'}`}>{appMode === 'premium' ? 'PRO' : 'FREE'}</button>
              </div>
            </div>
          </div>
          <button onClick={handleOpenKeySelector} className={`flex items-center gap-2 p-2 rounded-lg transition-colors ${hasApiKey ? 'text-emerald-400 bg-emerald-400/10' : 'text-amber-400 bg-amber-400/10'}`}>
             <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" /></svg>
             <span className="text-[10px] font-bold uppercase">{hasApiKey ? 'Đã kết nối' : 'Cần API Key'}</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
          <div className={`rounded-2xl border transition-all ${activeTab === 1 ? 'bg-slate-800/40 border-indigo-500/40' : 'border-white/5'}`}>
            <button onClick={() => setActiveTab(1)} className="w-full p-4 flex items-center justify-between">
              <span className="font-semibold text-sm">1. Tách nền (Clothing Isolation)</span>
              {isolatedImg && <span className="text-emerald-400">✓</span>}
            </button>
            {activeTab === 1 && (
              <div className="px-4 pb-4 space-y-4">
                <ImageUploader id="up-p" label="Ảnh gốc" image={productImg} onUpload={setProductImg} />
                <button onClick={handleIsolate} disabled={!productImg || loading} className="w-full py-3 bg-indigo-600 rounded-xl font-bold disabled:opacity-50">Tách nền</button>
              </div>
            )}
          </div>

          <div className={`rounded-2xl border transition-all ${activeTab === 2 ? 'bg-slate-800/40 border-indigo-500/40' : 'border-white/5'}`}>
            <button onClick={() => setActiveTab(2)} className="w-full p-4 flex items-center justify-between">
              <span className="font-semibold text-sm">2. Thử đồ ảo (Virtual Try-On)</span>
              {finalImg && <span className="text-emerald-400">✓</span>}
            </button>
            {activeTab === 2 && (
              <div className="px-4 pb-4 space-y-4">
                <ImageUploader id="up-s2" label="Sản phẩm" image={step2InputImg} onUpload={setStep2InputImg} compact />
                <ImageUploader id="up-t" label="Người mẫu" image={templateImg} onUpload={setTemplateImg} compact />
                <button onClick={handleComposite} disabled={!step2InputImg || !templateImg || loading} className="w-full py-3 bg-indigo-600 rounded-xl font-bold disabled:opacity-50">Ghép ảnh</button>
              </div>
            )}
          </div>

          <div className={`rounded-2xl border transition-all ${activeTab === 3 ? 'bg-slate-800/40 border-indigo-500/40' : 'border-white/5'}`}>
            <button onClick={() => setActiveTab(3)} className="w-full p-4 flex items-center justify-between">
              <span className="font-semibold text-sm">3. Thay đổi bối cảnh</span>
              {bgReplacedImg && <span className="text-emerald-400">✓</span>}
            </button>
            {activeTab === 3 && (
              <div className="px-4 pb-4 space-y-4">
                <div className="p-4 bg-slate-900/50 rounded-xl space-y-4 border border-white/5">
                  <textarea value={bgPrompt} onChange={e => setBgPrompt(e.target.value)} placeholder="Mô tả bối cảnh..." className="w-full h-20 bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs" />
                  <button onClick={handleReplaceBackground} disabled={loading || !step3InputImg} className="w-full py-3 bg-indigo-600 rounded-xl font-bold">Tạo bối cảnh</button>
                </div>
              </div>
            )}
          </div>

          <div className={`rounded-2xl border transition-all ${activeTab === 4 ? 'bg-slate-800/40 border-indigo-500/40' : 'border-white/5'}`}>
            <button onClick={() => setActiveTab(4)} className="w-full p-4 flex items-center justify-between">
              <span className="font-semibold text-sm">4. Sản xuất Video (Veo)</span>
              {videoUrl && <span className="text-emerald-400">✓</span>}
            </button>
            {activeTab === 4 && (
              <div className="px-4 pb-4 space-y-4">
                <ImageUploader id="up-s4" label="Keyframe" image={step4InputImg} onUpload={setStep4InputImg} compact />
                <button onClick={handleGenerateVideo} disabled={loading || !step4InputImg} className="w-full py-4 bg-gradient-to-r from-pink-600 to-indigo-600 rounded-xl font-bold shadow-lg">Render Video (Veo 3.1)</button>
              </div>
            )}
          </div>
        </div>
        
        {error && <div className="p-4 bg-red-950/80 border-t border-red-500/50 text-red-200 text-[10px] uppercase font-bold tracking-wider">{error}</div>}
      </aside>

      <main className="order-1 lg:order-2 flex-1 relative flex flex-col min-w-0">
        <div className="h-14 border-b border-white/5 flex items-center justify-between px-6 bg-slate-900/30 backdrop-blur-md z-20">
           <div className="text-sm font-medium text-slate-300">
               {loading ? <span className="animate-pulse">{loadingMsg}</span> : 'Studio Preview'}
           </div>
           {preview && <button onClick={() => {
              const link = document.createElement('a');
              link.href = preview.src;
              link.download = `pn-studio-${Date.now()}`;
              link.click();
           }} className="text-xs font-bold px-3 py-1.5 bg-indigo-600 rounded-lg">Tải xuống</button>}
        </div>
        
        <div className="flex-1 relative flex items-center justify-center p-6 lg:p-12">
           <div className="absolute inset-0 z-0" style={CHECKERBOARD_STYLE}></div>
           {preview ? (
             <div className="relative z-10 max-w-full max-h-full shadow-2xl rounded-xl overflow-hidden border border-white/10">
                {preview.type === 'video' ? <video src={preview.src} controls autoPlay loop className="max-h-[75vh]" /> : <img src={preview.src} alt="Preview" className="max-h-[75vh]" />}
             </div>
           ) : (
             <div className="opacity-20 flex flex-col items-center">
                <svg className="w-20 h-20 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                <p className="text-sm">Vui lòng tải ảnh lên để bắt đầu</p>
             </div>
           )}
        </div>
      </main>
    </div>
  );
};

export default App;