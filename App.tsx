import React, { useState } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { ResultDisplay } from './components/ResultDisplay';
import { BackgroundEditor } from './components/BackgroundEditor';
import { SettingsModal } from './components/SettingsModal';
import { generateTryOnImage, isolateProductImage } from './services/geminiService';
import { ProcessedImage, GenerationState, AppConfig, AppStep } from './types';
import { Sparkles, Settings2, Loader2, AlertCircle, Shirt, Image as ImageIcon, Scissors, ArrowRight, CheckCircle2, User, Layers, Settings } from 'lucide-react';

const App: React.FC = () => {
  // Navigation State
  const [activeTab, setActiveTab] = useState<AppStep>('TRY_ON');
  
  // Settings Modal State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isErrorTriggered, setIsErrorTriggered] = useState(false);

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

  const handleError = (error: any, context: string) => {
    if (error.message === "QUOTA_EXCEEDED") {
        setIsErrorTriggered(true);
        setIsSettingsOpen(true);
        return "Vui lòng nhập API Key để tiếp tục.";
    }
    return context + ": " + error.message;
  };

  // Sub-step 1.1: Isolate Product
  const handleIsolateProduct = async () => {
    if (!productImage) return;
    setIsIsolating(true);
    setTryOnState(prev => ({ ...prev, error: null }));
    try {
      const result = await isolateProductImage(productImage.base64);
      setIsolatedProduct(result);
    } catch (error: any) {
      const msg = handleError(error, "Lỗi tách nền");
      setTryOnState(prev => ({ ...prev, error: msg }));
    } finally {
      setIsIsolating(false);
    }
  };

  // Sub-step 1.2: Try On
  const handleGenerateTryOn = async (isRegenerate: boolean = false) => {
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
      const msg = handleError(error, "Lỗi thử đồ");
      setTryOnState(prev => ({ 
        ...prev,
        isLoading: false, 
        error: msg
      }));
    }
  };

  const handleSelectForBackground = (imageBase64: string) => {
    setStep2BaseImage(imageBase64);
    setActiveTab('BACKGROUND_EDIT');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetTryOn = () => {
    setProductImage(null);
    setIsolatedProduct(null);
    setModelImage(null);
    setTryOnState({ isLoading: false, results: [], error: null });
  };

  const openSettings = () => {
    setIsErrorTriggered(false);
    setIsSettingsOpen(true);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Settings Modal */}
      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        isErrorTrigger={isErrorTriggered}
      />

      {/* Professional Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-lg border-b border-gray-100 pt-safe">
        <div className="max-w-md mx-auto px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-gradient-to-tr from-indigo-600 to-purple-600 p-1.5 rounded-lg text-white shadow-sm">
              <Sparkles size={18} fill="currentColor" />
            </div>
            <h1 className="text-lg font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-900 to-purple-900">
              Fashion Studio
            </h1>
          </div>
          <button 
            onClick={openSettings}
            className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors relative"
          >
            <Settings size={20} />
            {/* Optional dot if user has custom key */}
            {typeof window !== 'undefined' && localStorage.getItem('user_api_key') && (
                <div className="absolute top-2 right-2 w-2 h-2 bg-green-500 rounded-full ring-1 ring-white"></div>
            )}
          </button>
        </div>
      </header>

      {/* Main Content Area - Scrollable */}
      <main className="flex-1 overflow-y-auto pb-32 pt-4 px-4 max-w-md mx-auto w-full no-scrollbar">
        
        {/* Global Error */}
        {tryOnState.error && activeTab === 'TRY_ON' && (
          <div className="mb-6 bg-red-50 border border-red-100 rounded-xl p-4 flex items-start gap-3 text-red-700 animate-in fade-in slide-in-from-top-2 shadow-sm">
            <AlertCircle className="shrink-0 mt-0.5" size={20} />
            <div className="text-sm font-medium">{tryOnState.error}</div>
            <button 
              onClick={() => setTryOnState(prev => ({...prev, error: null}))}
              className="ml-auto text-red-400 hover:text-red-700 p-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* TAB 1: TRY ON */}
        <div className={activeTab === 'TRY_ON' ? 'block animate-in fade-in duration-300' : 'hidden'}>
            {tryOnState.results.length === 0 ? (
              <div className="space-y-6">
                
                {/* Section 1: Product */}
                <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">1</div>
                    <h3 className="font-semibold text-gray-800">Ảnh Sản Phẩm</h3>
                  </div>
                  
                  <div className="flex gap-3 h-40">
                     <div className="flex-1">
                        <ImageUploader 
                          id="product-upload"
                          label="" 
                          subLabel="Ảnh gốc"
                          image={productImage}
                          onImageChange={(img) => {
                            setProductImage(img);
                            setIsolatedProduct(null);
                          }}
                        />
                     </div>

                     <div className="flex-1 flex flex-col items-center justify-center border-l border-gray-100 pl-3">
                        {!productImage ? (
                           <div className="text-xs text-gray-400 text-center px-4">Tải ảnh sản phẩm trước</div>
                        ) : isIsolating ? (
                           <div className="flex flex-col items-center text-blue-600 gap-2">
                              <Loader2 className="animate-spin" size={20} />
                              <span className="text-[10px] font-semibold uppercase tracking-wide">Đang tách nền</span>
                           </div>
                        ) : isolatedProduct ? (
                           <div className="relative w-full h-full rounded-xl border border-green-200 bg-green-50/50 overflow-hidden group">
                              <img src={`data:image/png;base64,${isolatedProduct}`} className="w-full h-full object-contain p-2" alt="Isolated" />
                              <div className="absolute bottom-0 inset-x-0 bg-green-500 text-white text-[9px] py-0.5 text-center font-bold uppercase tracking-wider">
                                Đã tách nền
                              </div>
                           </div>
                        ) : (
                           <button 
                             onClick={handleIsolateProduct}
                             className="flex flex-col items-center gap-2 text-blue-600 bg-blue-50/50 hover:bg-blue-50 active:bg-blue-100 p-2 rounded-xl w-full h-full justify-center transition-all border border-blue-200 border-dashed group"
                           >
                              <Scissors size={20} className="group-hover:scale-110 transition-transform" />
                              <span className="text-xs font-bold text-center">Tách nền<br/>Ngay</span>
                           </button>
                        )}
                     </div>
                  </div>
                </div>

                {/* Section 2: Model */}
                <div className={`bg-white rounded-2xl p-4 shadow-sm border border-gray-100 transition-all duration-300 ${!isolatedProduct ? 'opacity-60 grayscale-[0.5]' : 'opacity-100'}`}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center text-xs font-bold">2</div>
                    <h3 className="font-semibold text-gray-800">Ảnh Người Mẫu</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-1">
                        <ImageUploader 
                        id="model-upload"
                        label="" 
                        subLabel="Chọn mẫu"
                        image={modelImage}
                        onImageChange={setModelImage}
                        />
                    </div>
                    
                    {/* Config & Options */}
                    <div className="col-span-1 flex flex-col justify-center space-y-3">
                        <div className="text-xs text-gray-500 mb-1">Tuỳ chọn:</div>
                        <label className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${config.enableMannequin ? 'border-purple-200 bg-purple-50' : 'border-gray-200 bg-gray-50'}`}>
                            <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${config.enableMannequin ? 'bg-purple-600 border-purple-600' : 'bg-white border-gray-300'}`}>
                                {config.enableMannequin && <CheckCircle2 size={12} className="text-white" />}
                            </div>
                            <input 
                            type="checkbox" 
                            className="hidden"
                            checked={config.enableMannequin}
                            onChange={(e) => setConfig(prev => ({ ...prev, enableMannequin: e.target.checked }))}
                            />
                            <div className="flex flex-col">
                                <span className={`text-xs font-bold ${config.enableMannequin ? 'text-purple-700' : 'text-gray-600'}`}>+ Manocanh</span>
                            </div>
                        </label>
                    </div>
                  </div>
                </div>
                
                {/* Spacer for Floating Button */}
                <div className="h-20"></div>
              </div>
            ) : (
              <ResultDisplay 
                results={tryOnState.results} 
                isRegenerating={tryOnState.isLoading}
                onRegenerate={() => handleGenerateTryOn(true)}
                onReset={resetTryOn} 
                onSelectForBackground={handleSelectForBackground}
              />
            )}
        </div>

        {/* TAB 2: BACKGROUND EDIT */}
        <div className={activeTab === 'BACKGROUND_EDIT' ? 'block animate-in fade-in duration-300' : 'hidden'}>
           <BackgroundEditor 
            initialBaseImage={step2BaseImage}
          />
        </div>

      </main>

      {/* Floating Action Button for Try On (Only visible in Try On tab with no results) */}
      {activeTab === 'TRY_ON' && tryOnState.results.length === 0 && (
          <div className="fixed bottom-[88px] left-0 right-0 px-6 max-w-md mx-auto z-30">
            <button
                onClick={() => handleGenerateTryOn(false)}
                disabled={tryOnState.isLoading || !isolatedProduct || !modelImage}
                className={`
                w-full py-4 rounded-2xl font-bold text-white shadow-xl shadow-purple-900/20
                flex items-center justify-center gap-3 transition-all duration-300 border border-white/20 backdrop-blur-sm
                ${tryOnState.isLoading || !isolatedProduct || !modelImage
                    ? 'bg-gray-800/80 cursor-not-allowed text-gray-400' 
                    : 'bg-gray-900 hover:bg-black active:scale-[0.98]'}
                `}
            >
                {tryOnState.isLoading ? (
                <>
                    <Loader2 className="animate-spin" size={20} />
                    <span>Đang xử lý (15s)...</span>
                </>
                ) : (
                <>
                    <Sparkles size={20} className="text-yellow-300" />
                    <span>Bắt đầu mặc thử</span>
                </>
                )}
            </button>
          </div>
      )}

      {/* Professional Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 px-6 pb-safe pt-2 z-50 shadow-[0_-5px_20px_rgba(0,0,0,0.03)]">
        <div className="max-w-md mx-auto flex justify-between items-center h-16">
          <button
            onClick={() => setActiveTab('TRY_ON')}
            className={`flex flex-col items-center gap-1 w-1/2 transition-all duration-300 ${
              activeTab === 'TRY_ON' ? 'text-indigo-600 -translate-y-1' : 'text-gray-400'
            }`}
          >
            <div className={`p-1.5 rounded-xl transition-colors ${activeTab === 'TRY_ON' ? 'bg-indigo-50' : 'bg-transparent'}`}>
                <Shirt size={24} strokeWidth={activeTab === 'TRY_ON' ? 2.5 : 2} />
            </div>
            <span className="text-[10px] font-bold">Mặc Thử</span>
          </button>

          <div className="w-px h-8 bg-gray-100"></div>

          <button
            onClick={() => setActiveTab('BACKGROUND_EDIT')}
            className={`flex flex-col items-center gap-1 w-1/2 transition-all duration-300 ${
              activeTab === 'BACKGROUND_EDIT' ? 'text-purple-600 -translate-y-1' : 'text-gray-400'
            }`}
          >
             <div className={`p-1.5 rounded-xl transition-colors ${activeTab === 'BACKGROUND_EDIT' ? 'bg-purple-50' : 'bg-transparent'}`}>
                <Layers size={24} strokeWidth={activeTab === 'BACKGROUND_EDIT' ? 2.5 : 2} />
            </div>
            <span className="text-[10px] font-bold">Đổi Bối Cảnh</span>
          </button>
        </div>
      </nav>
    </div>
  );
};

export default App;