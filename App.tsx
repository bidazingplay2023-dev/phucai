import React, { useState } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { ResultDisplay } from './components/ResultDisplay';
import { BackgroundEditor } from './components/BackgroundEditor';
import { generateTryOnImage, isolateProductImage } from './services/geminiService';
import { ProcessedImage, GenerationState, AppConfig, AppStep } from './types';
import { Sparkles, Settings2, Loader2, AlertCircle, Shirt, Image as ImageIcon, Scissors, ArrowRight, CheckCircle2 } from 'lucide-react';

const App: React.FC = () => {
  // Navigation State
  const [activeTab, setActiveTab] = useState<AppStep>('TRY_ON');

  // Step 1 Data
  const [productImage, setProductImage] = useState<ProcessedImage | null>(null);
  const [isolatedProduct, setIsolatedProduct] = useState<string | null>(null); // New state for isolated product
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

  const resetTryOn = () => {
    setProductImage(null);
    setIsolatedProduct(null); // Reset isolation
    setModelImage(null);
    setTryOnState({ isLoading: false, results: [], error: null });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 pb-20">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-100 shadow-sm">
        <div className="max-w-md mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2" role="button" onClick={() => setActiveTab('TRY_ON')}>
            <div className="bg-indigo-600 p-2 rounded-lg text-white">
              <Sparkles size={20} />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
              Fashion AI
            </h1>
          </div>
          <div className="text-xs font-medium text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
            Gemini 2.5
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-4">
        
        {/* Navigation Tabs */}
        <div className="flex p-1 bg-gray-200/50 rounded-xl mb-6 backdrop-blur-sm">
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
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3 text-red-700 animate-in fade-in slide-in-from-top-4">
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
            {/* Workflow Container */}
            {tryOnState.results.length === 0 ? (
              <div className="space-y-8">
                
                {/* Step 1.1: Product Preparation */}
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>
                  <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <span className="bg-blue-100 text-blue-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">1</span>
                    Chuẩn bị sản phẩm
                  </h3>
                  
                  <div className="flex gap-4">
                     {/* Input Original Product */}
                     <div className="w-1/2">
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

                     {/* Arrow or Result */}
                     <div className="w-1/2 flex flex-col items-center justify-center">
                        {!productImage ? (
                           <div className="text-xs text-gray-400 text-center">Tải ảnh bên trái trước</div>
                        ) : isIsolating ? (
                           <div className="flex flex-col items-center text-blue-600 gap-2">
                              <Loader2 className="animate-spin" />
                              <span className="text-xs font-medium">Đang tách nền...</span>
                           </div>
                        ) : isolatedProduct ? (
                           <div className="relative w-full aspect-[3/4] rounded-xl border-2 border-green-200 bg-green-50 overflow-hidden group">
                              <img src={`data:image/png;base64,${isolatedProduct}`} className="w-full h-full object-contain p-2" alt="Isolated" />
                              <div className="absolute top-2 right-2 bg-green-500 text-white p-1 rounded-full shadow-md">
                                 <CheckCircle2 size={12} />
                              </div>
                              <div className="absolute bottom-0 inset-x-0 bg-green-600/90 text-white text-[10px] py-1 text-center font-medium">
                                Đã tách nền
                              </div>
                           </div>
                        ) : (
                           <button 
                             onClick={handleIsolateProduct}
                             className="flex flex-col items-center gap-2 text-blue-600 bg-blue-50 hover:bg-blue-100 p-4 rounded-xl w-full h-full justify-center transition-colors border border-blue-200 border-dashed"
                           >
                              <Scissors size={24} />
                              <span className="text-xs font-bold text-center">Tách nền<br/>Sản phẩm</span>
                           </button>
                        )}
                     </div>
                  </div>
                </div>

                {/* Arrow Connector */}
                <div className="flex justify-center -my-4 relative z-10">
                   <div className="bg-gray-100 p-2 rounded-full text-gray-400">
                      <ArrowRight size={20} className="rotate-90" />
                   </div>
                </div>

                {/* Step 1.2: Model & Generate */}
                <div className={`bg-white rounded-2xl p-5 shadow-sm border border-gray-100 relative overflow-hidden transition-opacity duration-300 ${!isolatedProduct ? 'opacity-50 grayscale pointer-events-none' : 'opacity-100'}`}>
                  <div className="absolute top-0 left-0 w-1 h-full bg-purple-500"></div>
                  <h3 className="font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <span className="bg-purple-100 text-purple-700 w-6 h-6 rounded-full flex items-center justify-center text-xs">2</span>
                    Chọn người mẫu & Mặc thử
                  </h3>

                  <div className="mb-4">
                    <ImageUploader 
                      id="model-upload"
                      label="" 
                      subLabel="Ảnh người mẫu"
                      image={modelImage}
                      onImageChange={setModelImage}
                    />
                  </div>

                  {/* Config Section */}
                  <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 shadow-sm mb-4">
                    <label className="flex items-center justify-between cursor-pointer group">
                      <div className="flex items-center gap-2">
                         <span className="text-xs font-bold text-gray-700">Thêm Manocanh (Beta)</span>
                      </div>
                      <div className="relative">
                        <input 
                          type="checkbox" 
                          className="hidden"
                          checked={config.enableMannequin}
                          onChange={(e) => setConfig(prev => ({ ...prev, enableMannequin: e.target.checked }))}
                        />
                        <div className={`w-8 h-5 rounded-full shadow-inner transition-colors ${config.enableMannequin ? 'bg-purple-600' : 'bg-gray-300'}`}></div>
                        <div className={`absolute top-1 left-1 bg-white w-3 h-3 rounded-full shadow transition-transform ${config.enableMannequin ? 'translate-x-3' : ''}`}></div>
                      </div>
                    </label>
                  </div>

                  <button
                    onClick={() => handleGenerateTryOn(false)}
                    disabled={tryOnState.isLoading || !isolatedProduct || !modelImage}
                    className={`
                      w-full py-4 px-6 rounded-xl font-bold text-white shadow-lg
                      flex items-center justify-center gap-3 transition-all duration-300
                      ${tryOnState.isLoading || !isolatedProduct || !modelImage
                        ? 'bg-gray-400 cursor-not-allowed' 
                        : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:scale-[1.02] active:scale-[0.98]'}
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
            ) : (
              /* Result Section */
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
    </div>
  );
};

export default App;