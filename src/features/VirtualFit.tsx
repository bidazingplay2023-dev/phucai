import React, { useState } from 'react';
import { Upload, X, Layers, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApiKey } from '../context/ApiKeyContext';
import { generateVirtualFit } from '../services/gemini';
import { ProcessingState } from '../types';
import { resizeImage } from '../utils/image';

export const VirtualFit: React.FC = () => {
  const { apiKey } = useApiKey();
  const [productImg, setProductImg] = useState<string | null>(null);
  const [modelImg, setModelImg] = useState<string | null>(null);
  const [resultImg, setResultImg] = useState<string | null>(null);
  const [processing, setProcessing] = useState<ProcessingState>({ isProcessing: false, statusMessage: '' });
  const [sliderPos, setSliderPos] = useState(50);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>, setter: (s: string | null) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const rawBase64 = reader.result as string;
        // Optimization: Resize client-side before setting state
        const resized = await resizeImage(rawBase64);
        setter(resized);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!productImg || !modelImg || !apiKey) return;

    setProcessing({ isProcessing: true, statusMessage: 'Compressing & Uploading...' });
    
    try {
      setProcessing({ isProcessing: true, statusMessage: 'AI Virtual Fitter running...' });
      const result = await generateVirtualFit(productImg, modelImg, apiKey);
      setResultImg(result);
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setProcessing({ isProcessing: false, statusMessage: '' });
    }
  };

  const ImageUploader = ({ label, img, setImg }: { label: string, img: string | null, setImg: any }) => (
    <div className="flex flex-col gap-2 flex-1 w-full">
      <span className="text-xs font-bold text-lumina-muted uppercase tracking-wider">{label}</span>
      <div className={`relative w-full aspect-[3/4] bg-lumina-surface border-2 ${img ? 'border-lumina-primary' : 'border-dashed border-gray-700'} rounded-2xl flex flex-col items-center justify-center overflow-hidden transition-all group hover:border-lumina-accent`}>
        {img ? (
          <>
            <img src={img} alt={label} className="w-full h-full object-cover" />
            <button 
              onClick={() => setImg(null)}
              className="absolute top-2 right-2 p-2 bg-black/50 rounded-full hover:bg-red-500/80 transition-colors z-10"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </>
        ) : (
          <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer p-4 hover:bg-white/5 transition-colors">
            <div className="p-4 bg-gray-800 rounded-full mb-3 group-hover:scale-110 transition-transform">
              <Upload className="w-6 h-6 text-lumina-muted group-hover:text-white" />
            </div>
            <span className="text-xs text-center text-gray-400 font-medium">Upload Image</span>
            <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFile(e, setImg)} />
          </label>
        )}
      </div>
    </div>
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col h-full space-y-6 pb-6"
    >
      <div className="flex items-center justify-between">
         <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Layers className="text-lumina-primary w-6 h-6" />
            Virtual Fitting Room
         </h2>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <ImageUploader label="Garment" img={productImg} setImg={setProductImg} />
        <ImageUploader label="Model" img={modelImg} setImg={setModelImg} />
      </div>

      <AnimatePresence mode="wait">
        {resultImg ? (
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 w-full bg-lumina-surface rounded-2xl overflow-hidden relative border border-gray-700 shadow-2xl"
          >
               <div className="relative w-full h-[500px] select-none cursor-ew-resize touch-pan-x">
                  {/* Background: Result */}
                  <div className="absolute inset-0 w-full h-full bg-black">
                     <img src={resultImg} alt="Result" className="w-full h-full object-contain" />
                  </div>
                  
                  {/* Foreground: Original (Clipped) */}
                  <div 
                      className="absolute inset-0 w-full h-full bg-black overflow-hidden"
                      style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)`}}
                  >
                      <div className="relative w-full h-full">
                        <img src={modelImg!} className="absolute inset-0 w-full h-full object-contain opacity-60" />
                        <div className="absolute top-4 left-4 bg-black/50 text-white text-xs px-2 py-1 rounded">Original</div>
                      </div>
                  </div>
                  
                  {/* Slider Control */}
                  <input 
                      type="range" 
                      min="0" 
                      max="100" 
                      value={sliderPos} 
                      onChange={(e) => setSliderPos(Number(e.target.value))}
                      className="absolute inset-0 w-full h-full opacity-0 z-20 cursor-ew-resize"
                  />
                  
                  {/* Visual Handle */}
                  <div 
                      className="absolute top-0 bottom-0 w-0.5 bg-white z-10 shadow-[0_0_10px_rgba(0,0,0,0.5)]"
                      style={{ left: `${sliderPos}%` }}
                  >
                      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg transform active:scale-95 transition-transform">
                          <Layers className="w-4 h-4 text-lumina-bg" />
                      </div>
                  </div>

                   <button 
                      onClick={() => setResultImg(null)}
                      className="absolute top-4 right-4 z-30 bg-lumina-surface/80 p-2 rounded-full hover:bg-white/20 backdrop-blur transition-all"
                   >
                      <X className="w-5 h-5 text-white" />
                   </button>
               </div>
          </motion.div>
        ) : (
          <motion.button
              whileTap={{ scale: 0.98 }}
              onClick={handleGenerate}
              disabled={!productImg || !modelImg || processing.isProcessing}
              className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-lg shadow-lumina-primary/20 ${
                  !productImg || !modelImg 
                  ? 'bg-gray-800 text-gray-500 cursor-not-allowed' 
                  : 'bg-lumina-primary hover:bg-lumina-accent text-white'
              }`}
          >
              {processing.isProcessing ? (
                  <>
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>{processing.statusMessage}</span>
                  </>
              ) : (
                  <>
                      <Sparkles className="w-5 h-5" />
                      <span>Generate Fit</span>
                  </>
              )}
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  );
};
