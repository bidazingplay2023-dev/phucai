
import React, { useState, useEffect, useRef } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { ResultDisplay } from './components/ResultDisplay';
import { BackgroundEditor } from './components/BackgroundEditor';
import { ApiKeyModal } from './components/ApiKeyModal';
import { generateTryOnImage, isolateProductImage } from './services/geminiService';
import { saveToDB, loadFromDB, clearKeyFromDB, KEYS, reconstructProcessedImage, prepareImageForStorage } from './services/storage';
import { ProcessedImage, GenerationState, AppConfig, AppStep } from './types';
import { Sparkles, Loader2, AlertCircle, Shirt, Image as ImageIcon, Scissors, ArrowRight, CheckCircle2, Download, RotateCcw, XCircle, Save, Key, ArrowDown } from 'lucide-react';

const App: React.FC = () => {
  // Loading State for Restoration
  const [isRestoring, setIsRestoring] = useState(true);

  // Navigation State
  const [activeTab, setActiveTab] = useState<AppStep>('TRY_ON');

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
  
  // API Key Modal State
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
          if (savedData.isolatedProduct) setIsolatedProduct(savedData.isolatedProduct);
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
  // We use a ref to access the latest state inside the event listener without dependencies issues
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
            // User switched tab or minimized browser -> Save immediately
            performSave();
        }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isRestoring]); // Re-bind only if restore state changes

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
    // Requires isolated product AND model image
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

  // Partial Reset: Keeps product, resets model and results
  const handlePartialReset = () => {
    setModelImage(null);
    setTryOnState({ isLoading: false, results: [], error: null });
  };

  // Full Reset: Clears everything AND clears Storage
  const handleFullReset = async () => {
    if (isResetConfirming) {
        // User confirmed, execute reset
        await clearKeyFromDB(KEYS.APP_SESSION); // Clear DB
        await clearKeyFromDB(KEYS.BG_EDITOR_SESSION); // Clear BG Editor DB
        
        setProductImage(null);
        setIsolatedProduct(null); 
        setModelImage(null);
        setTryOnState({ isLoading: false, results: [], error: null });
        setStep2BaseImage(null);
        setActiveTab('TRY_ON');
        setIsResetConfirming(false);
        setResetKey(prev => prev + 1); // IMPORTANT: Increment key to force remount of child components
    } else {
        // First click, show confirmation
        setIsResetConfirming(true);
    }
  };

  if (isRestoring) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white">
        <Loader2 className="animate-spin text-indigo-600 mb-4" size={40} />
        <h2 className="text-gray-700 font-medium">Đang khôi phục dữ liệu cũ...</h2>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 pb-20">
      <ApiKeyModal 
        isOpen={isKeyModalOpen} 
        onClose={() => setIsKeyModalOpen(false)} 
        forceOpen={!localStorage.getItem('GOOGLE_API_KEY')}
      />

      {/* Header - Changed max-w-md to max-w-7xl for desktop wide screen */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm transition-all">
        <div className="max-w-7xl mx-auto px-4 lg:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setActiveTab('TRY_ON')}>
            <div className="bg-indigo-600 p-2 rounded-lg text-white">
              <Sparkles size={20} />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 hidden xs:block">
              Fashion AI
            </h1>
          </div>
          
          <div className="flex items-center gap-2">
              <div className="hidden sm:flex text-[10px] font-bold text-indigo-400 bg-indigo-50 px-2 py-1 rounded-md items-center gap-1">
                 <Save size={10} /> Auto-save
              </div>

              <div className="h-6 w-px bg-gray-200 mx-1 hidden sm:block"></div>

              <button
                onClick={() => setIsKeyModalOpen(true)}
                className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                title="Cài đặt API Key"
              >
                <Key size={18} />
                <span className="hidden sm:inline text-sm font-medium">API Key</span>
              </button>

              <button 
                onClick={handleFullReset}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all duration-300 ${
                    isResetConfirming 
                    ? 'bg-red-100 text-red-600 ring-2 ring-red-200' 
                    : 'text-gray-500 hover:text-red-600 hover:bg-red-50'
                }`}
                title="Làm mới toàn bộ"
              >
                {isResetConfirming ? (
                    <>
                        <XCircle size={18} />
                        <span className="text-xs font-bold whitespace-nowrap">Xác nhận?</span>
                    </>
                ) : (
                    <>
                        <RotateCcw size={18} />
                        <span className="hidden sm:inline text-sm font-medium">Làm mới</span>
                    </>
                )}
              </button>
          </div>
        </div>
      </header>

      {/* Main Container - Changed max-w-md to max-w-7xl */}
      <main className="max-w-7xl mx-auto px-4 lg:px-6 py-6">
        
        {/* Navigation Tabs - Centered with limited width */}
        <div className="max-w-md mx-auto flex p-1 bg-gray-200/50 rounded-xl mb-8 backdrop-blur-sm">
          <button
            onClick={() => setActiveTab('TRY_ON')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-all duration-300 ${
              activeTab === 'TRY_ON' 
                ? 'bg-white shadow-sm text-indigo-600 scale-[1.02]' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Shirt size={18} />
            1. Mặc thử
          </button>
          <button
            onClick={() => setActiveTab('BACKGROUND_EDIT')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-bold transition-all duration-300 ${
              activeTab === 'BACKGROUND_EDIT' 
                ? 'bg-white shadow-sm text-indigo-600 scale-[1.02]' 
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <ImageIcon size={18} />
            2. Đổi bối cảnh
          </button>
        </div>

        {/* Global Error (for Try On tab) */}
        {tryOnState.error && activeTab === 'TRY_ON' && (
          <div className="max-w-3xl mx-auto mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 text-red-700 animate-in fade-in slide-in-from-top-4">
            <AlertCircle className="shrink-0 mt-0.5" size={20} />
            <div className="text-sm">{tryOnState.error}</div>
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
            
            {/* Input View: When no results yet */}
            {tryOnState.results.length === 0 ? (
              /* GRID LAYOUT FOR DESKTOP */
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-10 items-start max-w-6xl mx-auto">
                
                {/* Step 1.1: Product Preparation */}
                <div className="bg-white rounded-2xl p-6 shadow-lg shadow-indigo-100 border border-gray-100 relative overflow-hidden group hover:border-blue-200 transition-colors h-full">
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500"></div>
                  <h3 className="font-bold text-xl text-gray-800 mb-6 flex items-center gap-3">
                    <span className="bg-blue-100 text-blue-700 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-sm">1</span>
                    Chuẩn bị sản phẩm
                  </h3>
                  
                  <div className="flex flex-col sm:flex-row gap-6">
                     {/* Input Original Product */}
                     <div className="w-full sm:w-1/2">
                        <ImageUploader 
                          id="product-upload"
                          label="" 
                          subLabel="Ảnh quần áo gốc"
                          image={productImage}
                          onImageChange={(img) => {
                            setProductImage(img);
                            setIsolatedProduct(null); // Reset isolation if image changes
                          }}
                        />
                     </div>

                     {/* Processing State / Result */}
                     <div className="w-full sm:w-1/2 flex flex-col items-center justify-center min-h-[160px]">
                        {!productImage ? (
                           <div className="text-sm text-gray-400 text-center bg-gray-50 rounded-xl p-6 w-full h-full flex items-center justify-center border-2 border-dashed border-gray-200">
                              Tải ảnh bên trái trước
                           </div>
                        ) : isIsolating ? (
                           <div className="flex flex-col items-center justify-center text-blue-600 gap-3 bg-blue-50 w-full h-full rounded-xl border border-blue-100">
                              <Loader2 className="animate-spin" size={32} />
                              <span className="text-sm font-medium">Đang tách nền...</span>
                           </div>
                        ) : isolatedProduct ? (
                           <div className="relative w-full aspect-[3/4] rounded-xl border-2 border-green-200 bg-white overflow-hidden shadow-sm group-inner">
                              <img src={`data:image/png;base64,${isolatedProduct}`} className="w-full h-full object-contain p-2" alt="Isolated" />
                              
                              <div className="absolute top-2 left-2 bg-green-500 text-white p-1.5 rounded-full shadow-md z-10">
                                 <CheckCircle2 size={16} />
                              </div>

                              <button 
                                onClick={(e) => { e.stopPropagation(); handleDownloadIsolated(); }}
                                className="absolute top-2 right-2 bg-white text-gray-700 hover:text-indigo-600 hover:bg-indigo-50 p-2 rounded-full shadow-md transition-colors z-20 border border-gray-100"
                                title="Tải ảnh tách nền"
                              >
                                 <Download size={16} />
                              </button>

                              <div className="absolute bottom-0 inset-x-0 bg-green-600/95 text-white text-xs py-1.5 text-center font-medium backdrop-blur-sm">
                                Đã tách nền
                              </div>
                           </div>
                        ) : (
                           <button 
                             onClick={handleIsolateProduct}
                             className="flex flex-col items-center gap-3 text-blue-600 bg-blue-50 hover:bg-blue-100 p-4 rounded-xl w-full h-full justify-center transition-all border-2 border-blue-200 border-dashed hover:scale-[1.02] hover:shadow-md"
                           >
                              <Scissors size={28} />
                              <span className="text-sm font-bold text-center">Bấm để<br/>Tách nền ngay</span>
                           </button>
                        )}
                     </div>
                  </div>
                </div>

                {/* Mobile Arrow (Hidden on Desktop) */}
                <div className="lg:hidden flex justify-center -my-4 relative z-10">
                   <div className="bg-gray-100 p-2 rounded-full text-gray-400">
                      <ArrowDown size={20} />
                   </div>
                </div>

                {/* Step 1.2: Model & Generate */}
                <div className={`bg-white rounded-2xl p-6 shadow-lg shadow-purple-100 border border-gray-100 relative overflow-hidden transition-all duration-300 h-full flex flex-col ${!isolatedProduct ? 'opacity-50 grayscale pointer-events-none' : 'opacity-100 hover:border-purple-200'}`}>
                  <div className="absolute top-0 left-0 w-1.5 h-full bg-purple-500"></div>
                  <h3 className="font-bold text-xl text-gray-800 mb-6 flex items-center gap-3">
                    <span className="bg-purple-100 text-purple-700 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shadow-sm">2</span>
                    Chọn mẫu & Mặc thử
                  </h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
                    <ImageUploader 
                      id="model-upload"
                      label="" 
                      subLabel="Ảnh người mẫu"
                      image={modelImage}
                      onImageChange={setModelImage}
                    />
                    
                    {/* Config & Instructions */}
                    <div className="flex flex-col justify-center space-y-4">
                        <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
                            <label className="flex items-center justify-between cursor-pointer group select-none">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-purple-900">Thêm Manocanh</span>
                                <span className="text-[10px] bg-purple-200 text-purple-800 px-1.5 rounded">Beta</span>
                            </div>
                            <div className="relative">
                                <input 
                                type="checkbox" 
                                className="hidden"
                                checked={config.enableMannequin}
                                onChange={(e) => setConfig(prev => ({ ...prev, enableMannequin: e.target.checked }))}
                                />
                                <div className={`w-10 h-6 rounded-full shadow-inner transition-colors ${config.enableMannequin ? 'bg-purple-600' : 'bg-gray-300'}`}></div>
                                <div className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full shadow transition-transform ${config.enableMannequin ? 'translate-x-4' : ''}`}></div>
                            </div>
                            </label>
                            <p className="text-xs text-purple-700 mt-2 leading-relaxed">
                                Bật tùy chọn này để AI tạo thêm một ma-nơ-canh mặc bộ đồ bên cạnh người mẫu.
                            </p>
                        </div>
                    </div>
                  </div>

                  <div className="mt-auto">
                    <button
                        onClick={() => handleGenerateTryOn(false)}
                        disabled={tryOnState.isLoading || !isolatedProduct || !modelImage}
                        className={`
                        w-full py-4 px-6 rounded-xl font-bold text-white shadow-xl
                        flex items-center justify-center gap-3 transition-all duration-300 transform
                        ${tryOnState.isLoading || !isolatedProduct || !modelImage
                            ? 'bg-gray-400 cursor-not-allowed' 
                            : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:scale-[1.02] active:scale-[0.98] hover:shadow-purple-500/25'}
                        `}
                    >
                        {tryOnState.isLoading ? (
                        <>
                            <Loader2 className="animate-spin" size={24} />
                            <span>Đang xử lý (15s)...</span>
                        </>
                        ) : (
                        <>
                            <Sparkles size={24} />
                            <span>Bắt đầu mặc thử</span>
                        </>
                        )}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              /* Result Section */
              <ResultDisplay 
                results={tryOnState.results} 
                isRegenerating={tryOnState.isLoading}
                onRegenerate={() => handleGenerateTryOn(true)}
                onReset={handlePartialReset} 
                onSelectForBackground={handleSelectForBackground}
              />
            )}
        </div>

        {/* TAB 2: BACKGROUND EDIT */}
        <div className={activeTab === 'BACKGROUND_EDIT' ? 'block animate-in fade-in duration-300' : 'hidden'}>
           <BackgroundEditor 
            key={`bg-editor-${resetKey}`}
            initialBaseImage={step2BaseImage}
          />
        </div>

      </main>
    </div>
  );
};

export default App;
