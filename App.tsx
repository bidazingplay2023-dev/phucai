import React, { useState, useEffect } from 'react';
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
  Loader2,
  Settings,
  X,
  ShieldCheck,
  Zap,
  ExternalLink,
  Maximize2
} from 'lucide-react';
import ImageUploader from './components/ImageUploader.tsx';
import { isolateProduct, compositeProduct, generateSalesVideo, replaceBackground, replaceBackgroundWithImage } from './services/geminiService.ts';
import { GoogleGenAI } from "@google/genai";

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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
  
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
        const keyExists = !!process.env.API_KEY;
        setHasApiKey(keyExists);
        return keyExists;
      }
    } catch (e) { 
      return false; 
    }
  };

  const handleOpenKeySelector = async () => {
    if ((window as any).aistudio) {
      try {
        await ((window as any).aistudio as AIStudio).openSelectKey();
        // Assume key selection was successful after triggering dialog as per guidelines
        setHasApiKey(true);
        setError(null);
      } catch (e) {
        setError("Không thể mở hộp thoại chọn Key.");
      }
    }
  };

  const ensureApiKey = async () => {
    const active = await checkApiKey();
    if (!active) {
      setIsSettingsOpen(true);
      setError("Vui lòng chọn API Key để tiếp tục.");
      return false; 
    }
    return true;
  };

  const handleTestConnection = async () => {
    setTestStatus('testing');
    try {
      // Use process.env.API_KEY directly as per guidelines
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: 'Ping',
      });
      // Correct property access for text
      if (response.text) setTestStatus('success');
      else setTestStatus('error');
    } catch (e) {
      setTestStatus('error');
    }
  };

  const handleError = async (err: any, isVideo = false) => {
    console.error(err);
    let msg = err.message || "Unknown error";
    if (msg.includes("429") || msg.includes("quota")) {
        setError("⚠️ Quá tải: Vui lòng thử lại sau giây lát.");
    } else if (msg.includes("403") || msg.includes("PERMISSION_DENIED") || msg.includes("Requested entity was not found")) {
        setHasApiKey(false);
        setError("⚠️ Lỗi xác thực: Vui lòng kiểm tra lại API Key.");
        setIsSettingsOpen(true);
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
      if (window.innerWidth >= 768) setActiveTab(2); 
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
    setLoading(true); setLoadingMsg("AI đang tạo bối cảnh..."); setError(null);
    try {
      let result;
      if (bgInputMode === 'text') {
        result = await replaceBackground(step3InputImg, bgPrompt || "Professional studio background", appMode, bgAspectRatio);
      } else {
        if (!customBgFile) throw new Error("Vui lòng chọn ảnh nền.");
        result = await replaceBackgroundWithImage(step3InputImg, customBgFile, appMode, bgAspectRatio);
      }
      setBgReplacedImg(result);
      setStep4InputImg(result);
      if (window.innerWidth >= 768) setActiveTab(4);
    } catch (err: any) { handleError(err); } finally { setLoading(false); }
  };

  const handleVideoGenerate = async () => {
    if (!step4InputImg) return;
    if (!await ensureApiKey()) return;
    setLoading(true); setLoadingMsg("Đang khởi tạo video (có thể mất 1-2 phút)..."); setError(null);
    try {
      const prompt = promptMode === 'auto' ? PRESET_STYLES[autoStyle] : customPrompt;
      const url = await generateSalesVideo(
        { base64: step4InputImg, mimeType: 'image/png' },
        { resolution: videoResolution, aspectRatio: videoAspectRatio, mode: appMode, prompt }
      );
      setVideoUrl(url);
    } catch (err: any) { handleError(err, true); } finally { setLoading(false); }
  };

  const renderTabs = () => (
    <div className="flex overflow-x-auto no-scrollbar bg-slate-900/40 p-1.5 rounded-2xl border border-white/5 mb-8">
      {[
        { id: 1, label: 'Tách Nền', icon: Scissors, color: 'text-indigo-400' },
        { id: 2, label: 'Thử Đồ', icon: Shirt, color: 'text-emerald-400' },
        { id: 3, label: 'Phông Nền', icon: ImageIcon, color: 'text-purple-400' },
        { id: 4, label: 'Video QC', icon: Video, color: 'text-amber-400' }
      ].map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id as TabId)}
          className={`flex-1 flex items-center justify-center space-x-2 py-3 px-4 rounded-xl transition-all ${
            activeTab === tab.id 
            ? 'bg-slate-800 text-white shadow-xl' 
            : 'text-slate-500 hover:text-slate-300'
          }`}
        >
          <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? tab.color : ''}`} />
          <span className="text-sm font-bold whitespace-nowrap">{tab.label}</span>
        </button>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 selection:bg-indigo-500/30">
      <header className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-white/5 h-16 flex items-center justify-between px-6">
        <div className="flex items-center space-x-2">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
            <Sparkles className="text-white w-6 h-6" />
          </div>
          <h1 className="text-lg font-black tracking-tight">VIRTUAL STUDIO AI</h1>
        </div>
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => setIsSettingsOpen(true)}
            className="p-2.5 rounded-xl bg-slate-900 border border-white/5 hover:bg-slate-800 transition-colors"
          >
            <Settings className="w-5 h-5 text-slate-400" />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 pt-24 pb-12">
        <div className="max-w-4xl mx-auto">
          {renderTabs()}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {activeTab === 1 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4 bg-slate-900/40 p-6 rounded-3xl border border-white/5">
                    <ImageUploader label="Ảnh sản phẩm gốc" id="p-in" image={productImg} onUpload={(b64) => setProductImg(b64)} />
                    <button onClick={handleIsolate} disabled={loading || !productImg} className="w-full h-14 bg-indigo-600 text-white font-bold rounded-2xl flex items-center justify-center space-x-2">
                      {loading ? <Loader2 className="animate-spin" /> : <Sparkles />}
                      <span>TÁCH NỀN SẢN PHẨM</span>
                    </button>
                  </div>
                  <div className="relative aspect-square rounded-3xl overflow-hidden bg-slate-900 border border-white/5 flex items-center justify-center">
                    <div className="absolute inset-0" style={CHECKERBOARD_STYLE} />
                    {isolatedImg ? <img src={isolatedImg} className="max-w-full max-h-full p-4 relative z-10" /> : <Maximize2 className="opacity-10 w-12 h-12" />}
                  </div>
                </div>
              )}

              {activeTab === 2 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4 bg-slate-900/40 p-6 rounded-3xl border border-white/5">
                    <ImageUploader label="Sản phẩm" id="s2-p" image={step2InputImg} onUpload={(b64) => setStep2InputImg(b64)} compact />
                    <ImageUploader label="Người mẫu" id="s2-t" image={templateImg} onUpload={(b64) => setTemplateImg(b64)} compact />
                    <button onClick={handleComposite} disabled={loading || !step2InputImg || !templateImg} className="w-full h-14 bg-emerald-600 text-white font-bold rounded-2xl flex items-center justify-center space-x-2">
                      {loading ? <Loader2 className="animate-spin" /> : <Sparkles />}
                      <span>MẶC THỬ ĐỒ VIRTUAL</span>
                    </button>
                  </div>
                  <div className="relative aspect-square rounded-3xl overflow-hidden bg-slate-900 border border-white/5 flex items-center justify-center">
                    {finalImg ? <img src={finalImg} className="w-full h-full object-contain" /> : <ImageIcon className="opacity-10 w-12 h-12" />}
                  </div>
                </div>
              )}

              {activeTab === 3 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4 bg-slate-900/40 p-6 rounded-3xl border border-white/5">
                    <ImageUploader label="Ảnh chủ thể" id="s3-i" image={step3InputImg} onUpload={(b64) => setStep3InputImg(b64)} compact />
                    <textarea placeholder="Mô tả bối cảnh..." value={bgPrompt} onChange={(e) => setBgPrompt(e.target.value)} className="w-full bg-slate-800 p-3 rounded-xl min-h-[100px]" />
                    <button onClick={handleReplaceBackground} disabled={loading || !step3InputImg} className="w-full h-14 bg-purple-600 text-white font-bold rounded-2xl flex items-center justify-center space-x-2">
                      {loading ? <Loader2 className="animate-spin" /> : <Sparkles />}
                      <span>TẠO PHÔNG NỀN</span>
                    </button>
                  </div>
                  <div className="relative aspect-square rounded-3xl overflow-hidden bg-slate-900 border border-white/5 flex items-center justify-center">
                    {bgReplacedImg ? <img src={bgReplacedImg} className="w-full h-full object-contain" /> : <ImageIcon className="opacity-10 w-12 h-12" />}
                  </div>
                </div>
              )}

              {activeTab === 4 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4 bg-slate-900/40 p-6 rounded-3xl border border-white/5">
                    <ImageUploader label="Ảnh đầu vào" id="s4-i" image={step4InputImg} onUpload={(b64) => setStep4InputImg(b64)} compact />
                    <button onClick={handleVideoGenerate} disabled={loading || !step4InputImg} className="w-full h-14 bg-amber-600 text-white font-bold rounded-2xl flex items-center justify-center space-x-2">
                      {loading ? <Loader2 className="animate-spin" /> : <Video />}
                      <span>TẠO VIDEO QUẢNG CÁO</span>
                    </button>
                  </div>
                  <div className="relative aspect-square rounded-3xl overflow-hidden bg-slate-900 border border-white/5 flex items-center justify-center">
                    {videoUrl ? <video src={videoUrl} controls autoPlay loop muted className="w-full h-full object-contain" /> : <Video className="opacity-10 w-12 h-12" />}
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* API Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setIsSettingsOpen(false)} className="absolute inset-0 bg-slate-950/90" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="relative w-full max-w-md bg-slate-900 border border-white/10 p-8 rounded-[2rem]">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-black">Google AI API</h2>
                <button onClick={() => setIsSettingsOpen(false)}><X className="text-slate-500" /></button>
              </div>
              <div className="space-y-6">
                <div className="p-4 bg-slate-800/50 rounded-2xl border border-white/5">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-xs font-bold text-slate-500 uppercase">Trạng thái API Key</span>
                    {hasApiKey ? <span className="text-[10px] text-emerald-400 font-black uppercase">Đã chọn</span> : <span className="text-[10px] text-red-500 font-black uppercase">Chưa có</span>}
                  </div>
                  <button onClick={handleOpenKeySelector} className="w-full py-3 bg-white text-black font-black text-xs rounded-xl flex items-center justify-center space-x-2 uppercase tracking-tighter">
                    <ExternalLink className="w-4 h-4" />
                    <span>{hasApiKey ? 'Thay đổi API Key' : 'Chọn API Key'}</span>
                  </button>
                  <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" className="block text-center mt-3 text-[10px] text-slate-500 underline">Billing & Docs</a>
                </div>
                <button onClick={handleTestConnection} disabled={testStatus === 'testing' || !hasApiKey} className="w-full py-3 bg-slate-800 rounded-xl text-xs font-black flex items-center justify-center space-x-2 uppercase tracking-tighter">
                  {testStatus === 'testing' ? <Loader2 className="animate-spin w-4 h-4" /> : <ShieldCheck className="w-4 h-4" />}
                  <span>Kiểm tra kết nối</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Global Loading Overlay */}
      <AnimatePresence>
        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-xl">
            <Loader2 className="w-12 h-12 text-indigo-500 animate-spin mb-4" />
            <p className="text-lg font-black uppercase tracking-widest">{loadingMsg}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
