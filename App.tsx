
import React, { useState, useEffect, useRef } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { ResultDisplay } from './components/ResultDisplay';
import { BackgroundEditor } from './components/BackgroundEditor';
import { ImagePreviewModal } from './components/ImagePreviewModal';
import { generateTryOnImage, isolateProductImage } from './services/geminiService';
import { saveToDB, loadFromDB, clearKeyFromDB, KEYS, reconstructProcessedImage, prepareImageForStorage, reconstructGeneratedImage, prepareGeneratedImageForStorage } from './services/storage';
import { ProcessedImage, GenerationState, AppConfig, AppStep, GarmentType, GeneratedImage } from './types';
import { Sparkles, Loader2, AlertCircle, Shirt, Image as ImageIcon, Scissors, CheckCircle2, Zap, ChevronDown, ChevronUp, Maximize2, RotateCcw, Download, Trash2 } from 'lucide-react';

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

  // Reset Confirmation State
  const [isResetConfirming, setIsResetConfirming] = useState(false);
  
  // App Reset Key (to force remounting of components)
  const [appResetKey, setAppResetKey] = useState(0);

  // Step 1 Data
  const [productImage, setProductImage] = useState<ProcessedImage | null>(null);
  const [isolatedProduct, setIsolatedProduct] = useState<GeneratedImage | null>(null); 
  const [isIsolating, setIsIsolating] = useState(false);
  const [garmentType, setGarmentType] = useState<GarmentType>('FULL');

  const [modelImage, setModelImage] = useState<ProcessedImage | null>(null);
  const [config, setConfig] = useState<AppConfig>({ enableMannequin: false });
  const [tryOnState, setTryOnState] = useState<GenerationState>({
    isLoading: false,
    results: [],
    error: null,
  });
  
  // Step 2 Data (Input for Background Editor)
  const [step2BaseImage, setStep2BaseImage] = useState<GeneratedImage | null>(null);
  
  // --- PERSISTENCE LOGIC START ---
  
  // 1. Restore data on mount
  useEffect(() => {
    const restoreSession = async () => {
      try {
        const savedData = await loadFromDB(KEYS.APP_SESSION);
        if (savedData) {
          if (savedData.activeTab) setActiveTab(savedData.activeTab);
          
          if (savedData.productImage) {
            setProductImage(reconstructProcessedImage(savedData.productImage));
          }
          
          if (savedData.garmentType) {
            setGarmentType(savedData.garmentType);
          }
          
          if (savedData.isolatedProduct) {
            setIsolatedProduct(reconstructGeneratedImage(savedData.isolatedProduct));
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
          
          if (savedData.tryOnState && savedData.tryOnState.results) {
             const reconstructedResults = savedData.tryOnState.results
                .map(reconstructGeneratedImage)
                .filter(Boolean) as GeneratedImage[];
             
            setTryOnState({
              isLoading: false,
              results: reconstructedResults,
              error: null
            });
          }
          
          if (savedData.step2BaseImage) {
              setStep2BaseImage(reconstructGeneratedImage(savedData.step2BaseImage));
          }
        }
      } catch (e) {
        console.error("Failed to restore session", e);
      } finally {
        setTimeout(() => setIsRestoring(false), 200); 
      }
    };

    restoreSession();
  }, []);

  // Helper to get current state for saving
  const stateRef = useRef({
     activeTab, productImage, isolatedProduct, modelImage, config, tryOnState, step2BaseImage, garmentType
  });
  
  useEffect(() => {
      stateRef.current = { activeTab, productImage, isolatedProduct, modelImage, config, tryOnState, step2BaseImage, garmentType };
  }, [activeTab, productImage, isolatedProduct, modelImage, config, tryOnState, step2BaseImage, garmentType]);

  const performSave = () => {
      if (isRestoring) return;
      const current = stateRef.current;
      const sessionData = {
        activeTab: current.activeTab,
        productImage: prepareImageForStorage(current.productImage),
        isolatedProduct: prepareGeneratedImageForStorage(current.isolatedProduct),
        modelImage: prepareImageForStorage(current.modelImage),
        config: current.config,
        tryOnState: { results: current.tryOnState.results.map(prepareGeneratedImageForStorage) },
        step2BaseImage: prepareGeneratedImageForStorage(current.step2BaseImage),
        garmentType: current.garmentType, 
        timestamp: Date.now()
      };
      saveToDB(KEYS.APP_SESSION, sessionData);
  };

  const saveTimeoutRef = useRef<any>(null);

  useEffect(() => {
    if (isRestoring) return; 

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);

    saveTimeoutRef.current = setTimeout(() => {
      performSave();
    }, 1000); 

    return () => clearTimeout(saveTimeoutRef.current);
  }, [activeTab, productImage, isolatedProduct, modelImage, config, tryOnState.results, step2BaseImage, garmentType, isRestoring]);

  useEffect(() => {
    const handleVisibilityChange = () => {
        if (document.visibilityState === 'hidden') {
            performSave();
        }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isRestoring]);

  const handleFullReset = async () => {
    if (!isResetConfirming) {
        setIsResetConfirming(true);
        setTimeout(() => setIsResetConfirming(false), 3000);
        return;
    }

    try {
        await clearKeyFromDB(KEYS.APP_SESSION);
        await clearKeyFromDB(KEYS.BG_EDITOR_SESSION);

        setActiveTab('TRY_ON');
        setStep1Open(true);
        setStep2Open(false);
        setProductImage(null);
        setIsolatedProduct(null);
        setGarmentType('FULL');
        setModelImage(null);
        setConfig({ enableMannequin: false });
        setTryOnState({ isLoading: false, results: [], error: null });
        setStep2BaseImage(null);
        setGlobalPreviewUrl(null);
        
        setAppResetKey(prev => prev + 1);

        setIsResetConfirming(false);
        
    } catch (e) {
        console.error("Reset failed", e);
        alert("Lỗi khi reset ứng dụng. Vui lòng thử lại.");
    }
  };

  const handleIsolateProduct = async () => {
    if (!productImage) return;
    setIsIsolating(true);
    setTryOnState(prev => ({ ...prev, error: null }));
    try {
      const result = await isolateProductImage(productImage.file, garmentType);
      setIsolatedProduct(result);
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
    link.href = isolatedProduct.previewUrl;
    link.download = `isolated-product-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleGenerateTryOn = async (isRegenerate: boolean = false) => {
    if (!isolatedProduct || !modelImage) {
      setTryOnState(prev => ({ ...prev, error: "Vui lòng hoàn thành bước chuẩn bị sản phẩm và chọn ảnh người mẫu." }));
      return;
    }

    setTryOnState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      const resultImage = await generateTryOnImage(isolatedProduct.blob, modelImage, config);
      setTryOnState(prev => ({
        isLoading: false,
        results: isRegenerate ? [resultImage, ...prev.results] : [resultImage],
        error: null
      }));
      setStep2Open(false); // Collapse Step 2 on success
      window.scrollTo({ top: 100, behavior: 'smooth' });
    } catch (error: any) {
      setTryOnState(prev => ({ 
        ...prev,
        isLoading: false, 
        error: error.message || "Đã xảy ra lỗi không xác định." 
      }));
    }
  };

  const handleSelectForBackground = (image: GeneratedImage) => {
    setStep2BaseImage(image);
    setActiveTab('BACKGROUND_EDIT');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePartialReset = () => {
    setModelImage(null);
    setTryOnState({ isLoading: false, results: [], error: null });
  };

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
          <div className="w-px h-8 bg-gray-200 mx-2 hidden sm:block"></div>
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
      
      <ImagePreviewModal 
        isOpen={!!globalPreviewUrl}
        onClose={() => setGlobalPreviewUrl(null)}
        imageUrl={globalPreviewUrl}
      />

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
                onClick={handleFullReset}
                title="Xóa dữ liệu & Làm mới"
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-200 border
                 ${isResetConfirming 
                    ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100 w-36 justify-center' 
                    : 'bg-transparent text-gray-500 border-transparent hover:text-indigo-600 hover:bg-indigo-50 w-10 justify-center'
                 }`}
              >
                {isResetConfirming ? <Trash2 size={18} /> : <RotateCcw size={20} />}
                {isResetConfirming && <span className="text-xs font-bold whitespace-nowrap">Xác nhận xóa?</span>}
              </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 lg:px-6 py-6 lg:py-8">
        
        <DesktopNav />

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

        <div className={activeTab === 'TRY_ON' ? 'block animate-in fade-in duration-300' : 'hidden'}>
            
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
                
                <div className="lg:col-span-4 space-y-5">
                    
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300">
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
                                            setGlobalPreviewUrl(isolatedProduct.previewUrl);
                                        }}
                                    >
                                        <img src={isolatedProduct.previewUrl} className="w-full h-full object-contain" alt="Mini" />
                                    </div>
                                )}
                                {step1Open ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
                            </div>
                        </div>

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
                                    
                                    {productImage && (
                                      <div className="animate-in fade-in slide-in-from-left-2 duration-300">
                                        <label className="text-xs font-semibold text-gray-500 mb-2 block uppercase tracking-wider">Chọn loại trang phục cần lấy:</label>
                                        <div className="grid grid-cols-3 gap-2">
                                          <button
                                            onClick={() => setGarmentType('TOP')}
                                            className={`py-2 px-1 rounded-lg text-xs font-bold border transition-all ${
                                              garmentType === 'TOP'
                                                ? 'bg-indigo-50 border-indigo-500 text-indigo-700 ring-1 ring-indigo-200'
                                                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                                            }`}
                                          >
                                            Chỉ lấy Áo
                                          </button>
                                          <button
                                            onClick={() => setGarmentType('BOTTOM')}
                                            className={`py-2 px-1 rounded-lg text-xs font-bold border transition-all ${
                                              garmentType === 'BOTTOM'
                                                ? 'bg-indigo-50 border-indigo-500 text-indigo-700 ring-1 ring-indigo-200'
                                                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                                            }`}
                                          >
                                            Chỉ Quần/Váy
                                          </button>
                                          <button
                                            onClick={() => setGarmentType('FULL')}
                                            className={`py-2 px-1 rounded-lg text-xs font-bold border transition-all ${
                                              garmentType === 'FULL'
                                                ? 'bg-indigo-50 border-indigo-500 text-indigo-700 ring-1 ring-indigo-200'
                                                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                                            }`}
                                          >
                                            Lấy Cả Bộ
                                          </button>
                                        </div>
                                      </div>
                                    )}

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
                                                <div className="flex items-center justify-between p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl group transition-colors hover:bg-emerald-50">
                                                    <div 
                                                        className="flex items-center gap-4 cursor-pointer"
                                                        onClick={() => setGlobalPreviewUrl(isolatedProduct.previewUrl)}
                                                    >
                                                        <div className="w-14 h-14 bg-white rounded-lg border border-emerald-100 p-1 relative shadow-sm overflow-hidden flex-shrink-0">
                                                            <img src={isolatedProduct.previewUrl} className="w-full h-full object-contain" alt="Isolated" />
                                                            <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/10">
                                                                <Maximize2 size={16} className="text-white drop-shadow-md" />
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <h4 className="text-sm font-bold text-emerald-900 flex items-center gap-1.5">
                                                                <CheckCircle2 size={16} className="text-emerald-600" />
                                                                Đã tách nền
                                                            </h4>
                                                            <p className="text-xs text-emerald-600/80 font-medium mt-0.5">Sẵn sàng ghép mẫu</p>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2 pl-2">
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleIsolateProduct();
                                                            }}
                                                            disabled={isIsolating}
                                                            title="Làm lại (Tách nền)"
                                                            className="p-2.5 bg-white text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 hover:border-emerald-300 transition-all shadow-sm active:scale-95"
                                                        >
                                                            {isIsolating ? <Loader2 size={18} className="animate-spin" /> : <RotateCcw size={18} />}
                                                        </button>
                                                        
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDownloadIsolated();
                                                            }}
                                                            title="Tải ảnh về"
                                                            className="p-2.5 bg-white text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 hover:border-emerald-300 transition-all shadow-sm active:scale-95"
                                                        >
                                                            <Download size={18} />
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

                    <div className={`bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300 ${!isolatedProduct ? 'opacity-60 pointer-events-none' : 'opacity-100'}`}>
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

            </div>

        </div>

        <div className={activeTab === 'BACKGROUND_EDIT' ? 'block animate-in fade-in duration-300' : 'hidden'}>
           <BackgroundEditor 
            key={`bg-editor-${appResetKey}`}
            initialBaseImage={step2BaseImage}
          />
        </div>

      </main>

      <MobileNav />
    </div>
  );
};

export default App;
