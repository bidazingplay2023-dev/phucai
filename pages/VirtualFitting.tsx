import React, { useState, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { processImage, downloadImage } from '../utils/imageProcessor';
import { generateVirtualFit } from '../services/geminiService';
import { ImageAsset, VirtualFitState } from '../types';
import { Upload, X, Wand2, Download, AlertTriangle } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { CountdownTimer } from '../components/ui/CountdownTimer';
import { motion } from 'framer-motion';

export const VirtualFitting = () => {
  const { apiKeyConfig, setIsSettingsOpen } = useApp();
  const [state, setState] = useState<VirtualFitState>({
    productImage: null,
    modelImage: null,
    resultImage: null,
    isProcessing: false,
    error: null,
    retryAfter: null
  });

  const productInputRef = useRef<HTMLInputElement>(null);
  const modelInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'product' | 'model') => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const processed = await processImage(file);
      const asset: ImageAsset = {
        id: crypto.randomUUID(),
        file,
        ...processed
      };
      
      setState(prev => ({
        ...prev,
        [type === 'product' ? 'productImage' : 'modelImage']: asset,
        error: null // Clear error on new upload
      }));
    } catch (err) {
      console.error(err);
      setState(prev => ({ ...prev, error: "Lỗi xử lý hình ảnh. Vui lòng thử lại." }));
    }
  };

  const handleExecute = async () => {
    if (!apiKeyConfig.key) {
      setIsSettingsOpen(true);
      return;
    }
    if (!state.productImage || !state.modelImage) return;

    setState(prev => ({ ...prev, isProcessing: true, error: null, resultImage: null, retryAfter: null }));

    try {
      const resultBase64 = await generateVirtualFit(
        apiKeyConfig.key,
        state.productImage,
        state.modelImage
      );
      
      setState(prev => ({ ...prev, resultImage: resultBase64, isProcessing: false }));
    } catch (err: any) {
      if (err.message === "RATE_LIMIT") {
        setState(prev => ({ ...prev, isProcessing: false, retryAfter: 30 })); // Default 30s
      } else {
        setState(prev => ({ 
          ...prev, 
          isProcessing: false, 
          error: "Quá trình AI thất bại. Vui lòng kiểm tra API Key hoặc thử lại ảnh khác." 
        }));
      }
    }
  };

  const clearImage = (type: 'product' | 'model') => {
     setState(prev => ({
        ...prev,
        [type === 'product' ? 'productImage' : 'modelImage']: null,
        resultImage: null
      }));
      // Reset input value to allow re-uploading same file
      if (type === 'product' && productInputRef.current) productInputRef.current.value = '';
      if (type === 'model' && modelInputRef.current) modelInputRef.current.value = '';
  };

  return (
    <div className="pb-24 md:pb-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Phòng thử đồ ảo AI</h2>
        <p className="text-zinc-400 text-sm">Tải lên ảnh sản phẩm và người mẫu để bắt đầu.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Upload Area */}
        <div className="space-y-6">
          
          {/* Product Upload */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
             <div className="flex justify-between items-center mb-4">
                <span className="text-sm font-semibold text-zinc-300">1. Ảnh Sản Phẩm (Quần áo)</span>
                {state.productImage && (
                    <button onClick={() => clearImage('product')} className="text-zinc-500 hover:text-white"><X size={16}/></button>
                )}
             </div>
             
             {!state.productImage ? (
                <div 
                  onClick={() => productInputRef.current?.click()}
                  className="border-2 border-dashed border-zinc-700 hover:border-blue-500 hover:bg-blue-500/5 rounded-xl h-48 flex flex-col items-center justify-center cursor-pointer transition-colors"
                >
                    <Upload className="w-8 h-8 text-zinc-500 mb-2" />
                    <span className="text-xs text-zinc-400">Chạm để tải ảnh lên</span>
                    <input ref={productInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'product')} />
                </div>
             ) : (
                <div className="relative h-48 rounded-xl overflow-hidden bg-white/5">
                    <img src={state.productImage.previewUrl} alt="Product" className="w-full h-full object-contain" />
                </div>
             )}
          </div>

          {/* Model Upload */}
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
             <div className="flex justify-between items-center mb-4">
                <span className="text-sm font-semibold text-zinc-300">2. Ảnh Người Mẫu</span>
                 {state.modelImage && (
                    <button onClick={() => clearImage('model')} className="text-zinc-500 hover:text-white"><X size={16}/></button>
                )}
             </div>
             
             {!state.modelImage ? (
                <div 
                  onClick={() => modelInputRef.current?.click()}
                  className="border-2 border-dashed border-zinc-700 hover:border-blue-500 hover:bg-blue-500/5 rounded-xl h-48 flex flex-col items-center justify-center cursor-pointer transition-colors"
                >
                    <Upload className="w-8 h-8 text-zinc-500 mb-2" />
                    <span className="text-xs text-zinc-400">Chạm để tải ảnh lên</span>
                    <input ref={modelInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => handleFileUpload(e, 'model')} />
                </div>
             ) : (
                <div className="relative h-48 rounded-xl overflow-hidden bg-white/5">
                    <img src={state.modelImage.previewUrl} alt="Model" className="w-full h-full object-contain" />
                </div>
             )}
          </div>

          {/* Action Button */}
          <Button 
            onClick={handleExecute}
            isLoading={state.isProcessing}
            disabled={!state.productImage || !state.modelImage || state.isProcessing || !!state.retryAfter}
            className="w-full"
            icon={<Wand2 size={20} />}
          >
            {state.isProcessing ? 'Đang xử lý (10-20s)...' : 'Thử đồ ngay'}
          </Button>
          
          {/* Error Handling UI */}
          {state.retryAfter && (
            <CountdownTimer 
              initialSeconds={state.retryAfter} 
              onComplete={() => setState(prev => ({ ...prev, retryAfter: null }))} 
            />
          )}

          {state.error && (
             <div className="p-4 bg-red-900/20 border border-red-800 rounded-xl text-red-400 text-sm flex items-center gap-2">
                <AlertTriangle size={16} />
                {state.error}
             </div>
          )}

        </div>

        {/* Result Area */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 min-h-[400px] flex flex-col">
            <div className="flex justify-between items-center mb-4">
                <span className="text-sm font-semibold text-zinc-300">Kết quả AI</span>
                {state.resultImage && (
                    <button 
                      onClick={() => downloadImage(state.resultImage!, 'phuc-nguyen-ai-result.jpg')} 
                      className="text-blue-400 text-xs hover:underline flex items-center gap-1"
                    >
                        <Download size={14} /> Tải về
                    </button>
                )}
            </div>
            
            <div className="flex-1 rounded-xl bg-zinc-950 flex items-center justify-center overflow-hidden relative border border-zinc-800/50">
                {state.isProcessing ? (
                    <div className="text-center p-6">
                        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                        <p className="text-zinc-400 text-sm animate-pulse">Gemini đang phân tích ánh sáng & vải...</p>
                    </div>
                ) : state.resultImage ? (
                    <motion.img 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        src={state.resultImage} 
                        alt="Result" 
                        className="w-full h-full object-contain" 
                    />
                ) : (
                    <div className="text-zinc-600 text-sm text-center px-6">
                        Kết quả sẽ hiển thị tại đây sau khi xử lý.
                    </div>
                )}
            </div>
        </div>

      </div>
    </div>
  );
};