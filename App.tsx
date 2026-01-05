
import React, { useState, useEffect, useRef } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { ResultDisplay } from './components/ResultDisplay';
import { BackgroundEditor } from './components/BackgroundEditor';
import { ApiKeyModal } from './components/ApiKeyModal';
import { ImagePreviewModal } from './components/ImagePreviewModal';
import { generateTryOnImage, isolateProductImage } from './services/geminiService';
import { saveToDB, loadFromDB, clearKeyFromDB, KEYS, reconstructProcessedImage, prepareImageForStorage } from './services/storage';
import { ProcessedImage, GenerationState, AppConfig, AppStep } from './types';
import { Sparkles, Loader2, AlertCircle, Shirt, Image as ImageIcon, Scissors, Key, RotateCcw, XCircle, CheckCircle2, Zap, ChevronDown, ChevronUp, Maximize2 } from 'lucide-react';

const App: React.FC = () => {
  // Loading State for Restoration
  const [isRestoring, setIsRestoring] = useState(true);

  // Navigation State
  const [activeTab, setActiveTab] = useState<AppStep>('TRY_ON');

  // Accordion State
  const [step1Open, setStep1Open] = useState(true);
  const [step2Open, setStep2Open] = useState(false);

  // Global Preview State (For Header Thumbnails)
  const [globalPreviewUrl, setGlobalPreviewUrl] = useState<string | null>(null);

  // Step 1 Data
  const [productImage, setProductImage] = useState<ProcessedImage | null>(null);
  const [isolatedProduct, setIsolatedProduct] = useState<string | null>(null); 
  const [isIsolating, setIsIsolating] = useState(false);

  const [modelImage, setModelImage] = useState<ProcessedImage | null>(null);
  const [config, setConfig] = useState<AppConfig>({ enableMannequin: false });
  const [tryOnState, setTryOnState] = useState<GenerationState>({
    isLoading: false,
    results: [],
    error: null,
  });
  
  // Step 2 Data
  const [step2BaseImage, setStep2BaseImage] = useState<string | null>(null);

  // Reset Confirmation State
  const [isResetConfirming, setIsResetConfirming] = useState(false);
  
  // Api Key Modal State
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  
  // Reset Key: Used to force re-mounting of components to clear internal state
  const [resetKey, setResetKey] = useState(0);

  // --- PERSISTENCE LOGIC START ---
  
  // 1. Restore data on mount AND check API Key
  useEffect(() => {
    // Check API Key
    const hasKey = localStorage.getItem('GOOGLE_API_KEY');
    if (!hasKey) {
        setIsKeyModalOpen(true);
    }

    const restoreSession = async () => {
      try {
        const savedData = await loadFromDB(KEYS.APP_SESSION);
        if (savedData) {
          if (savedData.activeTab) setActiveTab(savedData.activeTab);
          
          if (savedData.productImage) {
            setProductImage(reconstructProcessedImage(savedData.productImage));
          }
          
          if (savedData.isolatedProduct) {
            setIsolatedProduct(savedData.isolatedProduct);
            // Accordion Logic: If Step 1 is done, close it and open Step 2
            setStep1Open(false);
            setStep2Open(true);
          } else {
            setStep1Open(true);
            setStep2Open(false);
          }

          if (savedData.modelImage) {
            setModelImage(reconstructProcessedImage(savedData.modelImage));
          }
          if (savedData.config) setConfig(savedData.config);
          
          if (savedData.tryOnState) {
            // Restore results but reset loading state/error to clean slate
            setTryOnState({
              isLoading: false,
              results: savedData.tryOnState.results || [],
              error: null
            });
          }
          
          if (savedData.step2BaseImage) setStep2BaseImage(savedData.step2BaseImage);
        }
      } catch (e) {
        console.error("Failed to restore session", e);
      } finally {
        // Short timeout to smooth out the transition
        setTimeout(() => setIsRestoring(false), 200); // Faster restoration visual
      }
    };

    restoreSession();
  }, []);

  // Helper to get current state for saving
  const stateRef = useRef({
     activeTab, productImage, isolatedProduct, modelImage, config, tryOnState, step2BaseImage
  });
  
  useEffect(() => {
      stateRef.current = { activeTab, productImage, isolatedProduct, modelImage, config, tryOnState, step2BaseImage };
  }, [activeTab, productImage, isolatedProduct, modelImage, config, tryOnState, step2BaseImage]);

  const performSave = () => {
      if (isRestoring) return;
      const current = stateRef.current;
      const sessionData = {
        activeTab: current.activeTab,
        productImage: prepareImageForStorage(current.productImage),
        isolatedProduct: current.isolatedProduct,
        modelImage: prepareImageForStorage(current.modelImage),
        config: current.config,
        tryOnState: { results: current.tryOnState.results },
        step2BaseImage: current.step2BaseImage,
        timestamp: Date.now()
      };
      saveToDB(KEYS.APP_SESSION, sessionData);
  };

  // 2. Auto-save when state changes (Debounced)
  const saveTimeoutRef = useRef<any>(null);

  useEffect(() => {
    if (isRestoring) return; // Don't save while restoring

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(() => {
      performSave();
    }, 1000); // Save after 1 second of inactivity

    return () => clearTimeout(saveTimeoutRef.current);
  }, [activeTab, productImage, isolatedProduct, modelImage, config, tryOnState.results, step2BaseImage, isRestoring]);

  // 3. FORCE SAVE on Visibility Change (Tab Switch/Mobile Home Screen)
  useEffect(() => {
    const handleVisibilityChange = () => {
        if (document.visibilityState === 'hidden') {
            performSave();
        }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isRestoring]);

  // Auto hide reset confirmation after 3 seconds
  useEffect(() => {
    let timer: any;
    if (isResetConfirming) {
      timer = setTimeout(() => {
        setIsResetConfirming(false);
      }, 3000);
    }
    return () => clearTimeout(timer);
  }, [isResetConfirming]);

  // Sub-step 1.1: Isolate Product
  const handleIsolateProduct = async () => {
    if (!productImage) return;
    setIsIsolating(true);
    setTryOnState(prev => ({ ...prev, error: null }));
    try {
      const result = await isolateProductImage(productImage.base64);
      setIsolatedProduct(result);
      // Auto Advance Accordion: Close 1, Open 2
      setStep1Open(false);
      setStep2Open(true);
    } catch (error: any) {
      setTryOnState(prev => ({ ...prev, error: "Lỗi tách nền: " + error.message }));
    } finally {
      setIsIsolating(false);
    }
  };

  const handleDownloadIsolated = () => {
    if (!isolatedProduct) return;
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${isolatedProduct}`;
    link.download = `isolated-product-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Sub-step 1.2: Try On
  const handleGenerateTryOn = async (isRegenerate: boolean = false) => {
    // DEBUG: Verify inputs before sending to API
    console.log("Generating with:", { isolatedProduct: !!isolatedProduct, modelImage: !!modelImage });

    if (!isolatedProduct || !modelImage) {
      setTryOnState(prev => ({ ...prev, error: "Vui lòng hoàn thành bước chuẩn bị sản phẩm và chọn ảnh người mẫu." }));
      return;
    }

    setTryOnState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const resultBase64 = await generateTryOnImage(isolatedProduct, modelImage, config);
      setTryOnState(prev => ({
        isLoading: false,
        results: isRegenerate ? [resultBase64, ...prev.results] : [resultBase64],
        error: null
      }));
      // On mobile, maybe scroll to result?
      window.scrollTo({ top: 300, behavior: 'smooth' });
    } catch (error: any) {
      setTryOnState(prev => ({ 
        ...prev,
        isLoading: false, 
        error: error.message || "Đã xảy ra lỗi không xác định." 
      }));
    }
  };

  const handleSelectForBackground = (imageBase64: string) => {
    setStep2BaseImage(imageBase64);
    setActiveTab('BACKGROUND_EDIT');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Partial Reset
  const handlePartialReset = () => {
    setModelImage(null);
    setTryOnState({ isLoading: false, results: [], error: null });
  };

  // Full Reset
  const handleFullReset = async () => {
    if (isResetConfirming) {
        await clearKeyFromDB(KEYS.APP_SESSION);
        await clearKeyFromDB(KEYS.BG_EDITOR_SESSION);
        
        setProductImage(null);
        setIsolatedProduct(null); 
        setModelImage(null);
        setTryOnState({ isLoading: false, results: [], error: null });
        setStep2BaseImage(null);
        setActiveTab('TRY_ON');
        setIsResetConfirming(false);
        setStep1Open(true);
        setStep2Open(false);
        setResetKey(prev => prev + 1);
    } else {
        setIsResetConfirming(true);
    }
  };

  // --- MOBILE NAVIGATION COMPONENT ---
  const MobileNav = () => (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 lg:hidden pb-safe">
       <div className="flex justify-around items-center h-16">
          <button 
             onClick={() => setActiveTab('TRY_ON')}
             className={`flex flex-col items-center justify-center w-full h-full transition-colors ${activeTab === 'TRY_ON' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
             <Shirt size={24} strokeWidth={activeTab === 'TRY_ON' ? 2.5 : 2} />
             <span className="text-[10px] font-semibold mt-1">Mặc thử</span>
          </button>
          <div className="w-px h-8 bg-gray-200"></div>
          <button 
             onClick={() => setActiveTab('BACKGROUND_EDIT')}
             className={`flex flex-col items-center justify-center w-full h-full transition-colors ${activeTab === 'BACKGROUND_EDIT' ? 'text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
          >
             <ImageIcon size={24} strokeWidth={activeTab === 'BACKGROUND_EDIT' ? 2.5 : 2} />
             <span className="text-[10px] font-semibold mt-1">Đổi bối cảnh</span>
          </button>
       </div>
    </div>
  );

  // --- DESKTOP NAVIGATION COMPONENT ---
  const DesktopNav = () => (
    <div className="hidden lg:flex justify-center mb-8">
        <div className="inline-flex bg-white p-1.5 rounded-2xl shadow-sm border border-gray-200">
            <button
                onClick={() => setActiveTab('TRY_ON')}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${
                activeTab === 'TRY_ON' 
                    ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
            >
                <Shirt size={18} />
                1. Mặc thử
            </button>
            <button
                onClick={() => setActiveTab('BACKGROUND_EDIT')}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${
                activeTab === 'BACKGROUND_EDIT' 
                    ? 'bg-indigo-50 text-indigo-700 shadow-sm ring-1 ring-indigo-200' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
            >
                <ImageIcon size={18} />
                2. Đổi bối cảnh
            </button>
        </div>
    </div>
  );

  if (isRestoring) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white">
        <Loader2 className="animate-spin text-indigo-600 mb-4" size={40} />
        <h2 className="text-gray-700 font-medium">Đang khôi phục dữ liệu cũ...</h2>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24 lg:pb-10 font-sans text-slate-800">
      <ApiKeyModal 
        isOpen={isKeyModalOpen} 
        onClose={() => setIsKeyModalOpen(false)} 
        forceOpen={!localStorage.getItem('GOOGLE_API_KEY')}
      />
      
      {/* Global Image Preview Modal */}
      <ImagePreviewModal 
        isOpen={!!globalPreviewUrl}
        onClose={() => setGlobalPreviewUrl(null)}
        imageUrl={globalPreviewUrl}
      />

      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab('TRY_ON')}>
            <div className="bg-gradient-to-tr from-indigo-600 to-purple-600 p-2 rounded-lg text-white shadow-lg shadow-indigo-200">
              <Sparkles size={20} fill="currentColor" className="text-white" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-700 to-purple-700">
              Fashion AI
            </h1>
          </div>
          
          <div className="flex items-center gap-2">
              <div className="hidden sm:flex text-[10px] font-bold text-indigo-500 bg-indigo-50 border border-indigo-100 px-3 py-1.5 rounded-full items-center gap-1.5">
                 <Zap size={12} fill="currentColor" /> Auto-save
              </div>

              <div className="h-6 w-px bg-gray-200 mx-2 hidden sm:block"></div>

              <button
                onClick={() => setIsKeyModalOpen(true)}
                className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
              >
                <Key size={20} />
              </button>

              <button 
                onClick={handleFullReset}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-300 ${
                    isResetConfirming 
                    ? 'bg-red-50 text-red-600 ring-1 ring-red-200' 
                    : 'text-gray-500 hover:text-red-600 hover:bg-red-50'
                }`}
              >
                {isResetConfirming ? (
                    <XCircle size={20} />
                ) : (
                    <RotateCcw size={20} />
                )}
              </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 lg:px-6 py-6 lg:py-8">
        
        <DesktopNav />

        {/* Global Error */}
        {tryOnState.error && activeTab === 'TRY_ON' && (
          <div className="max-w-3xl mx-auto mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 text-red-700 animate-in fade-in slide-in-from-top-4 shadow-sm">
            <AlertCircle className="shrink-0 mt-0.5" size={20} />
            <div className="text-sm font-medium">{tryOnState.error}</div>
            <button 
              onClick={() => setTryOnState(prev => ({...prev, error: null}))}
              className="ml-auto text-red-500 hover:text-red-800"
            >
              ✕
            </button>
          </div>
        )}

        {/* TAB 1: TRY ON */}
        <div className={activeTab === 'TRY_ON' ? 'block animate-in fade-in duration-300' : 'hidden'}>
            
            {/* 2-COLUMN LAYOUT START */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
                
                {/* LEFT COLUMN: CONTROLS (35%) */}
                <div className="lg:col-span-4 space-y-5">
                    
                    {/* Card 1: Product Input - ACCORDION */}
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300">
                        {/* Header */}
                        <div 
                            onClick={() => setStep1Open(!step1Open)}
                            className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors select-none"
                        >
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">1</div>
                                <div>
                                    <h3 className="font-bold text-gray-800">Chuẩn bị sản phẩm</h3>
                                    {!step1Open && isolatedProduct && (
                                        <div className="flex items-center gap-1.5 mt-0.5 animate-in fade-in">
                                            <CheckCircle2 size={12} className="text-green-600" />
                                            <span className="text-xs text-green-700 font-medium">Đã xong</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                {!step1Open && isolatedProduct && (
                                    <div 
                                        className="w-10 h-10 bg-white rounded border border-gray-200 p-0.5 animate-in zoom-in hover:border-indigo-300 transition-colors cursor-pointer"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setGlobalPreviewUrl(`data:image/png;base64,${isolatedProduct}`);
                                        }}
                                    >
                                        <img src={`data:image/png;base64,${isolatedProduct}`} className="w-full h-full object-contain" alt="Mini" />
                                    </div>
                                )}
                                {step1Open ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
                            </div>
                        </div>

                        {/* Body */}
                        {step1Open && (
                            <div className="p-5 border-t border-gray-100 animate-in slide-in-from-top-1 duration-200">
                                <div className="space-y-4">
                                    <ImageUploader 
                                        id="product-upload"
                                        label="" 
                                        subLabel="Ảnh trang phục gốc"
                                        image={productImage}
                                        onImageChange={(img) => {
                                            setProductImage(img);
                                            setIsolatedProduct(null);
                                        }}
                                    />

                                    {/* Isolation Controls */}
                                    {productImage && (
                                        <div className="mt-3">
                                            {!isolatedProduct ? (
                                                <button 
                                                    onClick={handleIsolateProduct}
                                                    disabled={isIsolating}
                                                    className="w-full py-3 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold rounded-xl border border-blue-200 flex items-center justify-center gap-2 transition-all disabled:opacity-70"
                                                >
                                                    {isIsolating ? <Loader2 className="animate-spin" size={18} /> : <Scissors size={18} />}
                                                    {isIsolating ? 'Đang tách nền...' : 'Tách nền ngay'}
                                                </button>
                                            ) : (
                                                <div 
                                                    className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl cursor-pointer hover:bg-green-100 transition-colors group"
                                                    onClick={() => setGlobalPreviewUrl(`data:image/png;base64,${isolatedProduct}`)}
                                                >
                                                    <div className="w-12 h-12 bg-white rounded-lg border border-green-100 p-1 shrink-0 relative group-hover:scale-105 transition-transform">
                                                        <img src={`data:image/png;base64,${isolatedProduct}`} className="w-full h-full object-contain" alt="Isolated" />
                                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/10 rounded-lg">
                                                            <Maximize2 size={16} className="text-white drop-shadow-md" />
                                                        </div>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-bold text-green-800 flex items-center gap-1">
                                                            <CheckCircle2 size={14} /> Đã tách nền
                                                        </p>
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDownloadIsolated();
                                                            }}
                                                            className="text-xs text-green-600 underline hover:text-green-800 truncate"
                                                        >
                                                            Tải ảnh tách nền
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Card 2: Model Input - ACCORDION */}
                    <div className={`bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300 ${!isolatedProduct ? 'opacity-60 pointer-events-none' : 'opacity-100'}`}>
                        {/* Header */}
                        <div 
                            onClick={() => isolatedProduct && setStep2Open(!step2Open)}
                            className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors select-none"
                        >
                             <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-sm">2</div>
                                <div>
                                    <h3 className="font-bold text-gray-800">Chọn mẫu & Mặc thử</h3>
                                    {!step2Open && modelImage && (
                                        <div className="flex items-center gap-1.5 mt-0.5 animate-in fade-in">
                                            <CheckCircle2 size={12} className="text-green-600" />
                                            <span className="text-xs text-green-700 font-medium">Đã chọn</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                {!step2Open && modelImage && (
                                    <div 
                                        className="w-10 h-10 bg-white rounded border border-gray-200 p-0.5 animate-in zoom-in hover:border-indigo-300 transition-colors"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setGlobalPreviewUrl(modelImage.previewUrl);
                                        }}
                                    >
                                        <img src={modelImage.previewUrl} className="w-full h-full object-contain" alt="Mini Model" />
                                    </div>
                                )}
                                {step2Open ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
                            </div>
                        </div>

                        {/* Body */}
                        {step2Open && (
                            <div className="p-5 border-t border-gray-100 animate-in slide-in-from-top-1 duration-200">
                                <div className="space-y-4">
                                    <ImageUploader 
                                        id="model-upload"
                                        label="" 
                                        subLabel="Ảnh người mẫu"
                                        image={modelImage}
                                        onImageChange={setModelImage}
                                    />
                                    
                                    {/* Mannequin Toggle */}
                                    <div className="flex items-center justify-between bg-gray-50 p-3 rounded-xl border border-gray-100">
                                        <div className="flex flex-col">
                                            <span className="text-sm font-semibold text-gray-700">Thêm Manocanh</span>
                                            <span className="text-[10px] text-gray-400">Tạo thêm 1 ma nơ canh bên cạnh</span>
                                        </div>
                                        <div className="relative cursor-pointer" onClick={() => setConfig(p => ({...p, enableMannequin: !p.enableMannequin}))}>
                                            <div className={`w-11 h-6 rounded-full transition-colors ${config.enableMannequin ? 'bg-purple-600' : 'bg-gray-300'}`}></div>
                                            <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full shadow transition-transform ${config.enableMannequin ? 'translate-x-5' : ''}`}></div>
                                        </div>
                                    </div>

                                    {/* Generate Action Button - Moved Inside Accordion */}
                                    <button
                                        onClick={() => handleGenerateTryOn(false)}
                                        disabled={tryOnState.isLoading || !isolatedProduct || !modelImage}
                                        className={`
                                        w-full h-14 rounded-xl font-bold text-lg text-white shadow-lg shadow-indigo-200
                                        flex items-center justify-center gap-3 transition-all duration-300 transform mt-2
                                        ${tryOnState.isLoading || !isolatedProduct || !modelImage
                                            ? 'bg-gray-300 cursor-not-allowed shadow-none' 
                                            : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:scale-[1.02] active:scale-[0.98]'}
                                        `}
                                    >
                                        {tryOnState.isLoading ? (
                                            <>
                                                <Loader2 className="animate-spin" size={24} />
                                                <span>Đang xử lý...</span>
                                            </>
                                        ) : (
                                            <>
                                                <Sparkles size={22} fill="currentColor" className="text-white/20" />
                                                <span>Bắt đầu mặc thử</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
                {/* END LEFT COLUMN */}

                {/* RIGHT COLUMN: PREVIEW (65%) */}
                <div className="lg:col-span-8 h-full">
                    
                    {tryOnState.results.length === 0 ? (
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 h-full min-h-[500px] flex flex-col items-center justify-center text-center p-8">
                            <div className="relative mb-6">
                                <div className="absolute inset-0 bg-indigo-100 rounded-full blur-2xl opacity-60 animate-pulse"></div>
                                <div className="relative bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                                    <img src="https://cdn-icons-png.flaticon.com/512/3358/3358946.png" className="w-20 h-20 opacity-90" alt="Placeholder" />
                                </div>
                            </div>
                            <h3 className="text-xl font-bold text-gray-800 mb-2">Sẵn sàng sáng tạo</h3>
                            <p className="text-gray-500 max-w-sm text-sm leading-relaxed">
                                Vui lòng tải lên <strong>Ảnh trang phục</strong> và <strong>Ảnh người mẫu</strong> ở cột bên trái, sau đó nhấn nút Bắt đầu.
                            </p>
                        </div>
                    ) : (
                        <ResultDisplay 
                            results={tryOnState.results} 
                            isRegenerating={tryOnState.isLoading}
                            onRegenerate={() => handleGenerateTryOn(true)}
                            onReset={handlePartialReset} 
                            onSelectForBackground={handleSelectForBackground}
                        />
                    )}

                </div>
                {/* END RIGHT COLUMN */}

            </div>
            {/* 2-COLUMN LAYOUT END */}

        </div>

        {/* TAB 2: BACKGROUND EDIT */}
        <div className={activeTab === 'BACKGROUND_EDIT' ? 'block animate-in fade-in duration-300' : 'hidden'}>
           <BackgroundEditor 
            key={`bg-editor-${resetKey}`}
            initialBaseImage={step2BaseImage}
          />
        </div>

      </main>

      <MobileNav />
    </div>
  );
};

export default App;
