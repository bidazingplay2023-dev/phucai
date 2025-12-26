import React, { useState } from 'react';
import { Upload, X, ArrowRight, Layers, Sparkles } from 'lucide-react';
import { useApiKey } from '../context/ApiKeyContext';
import { generateVirtualFit } from '../services/gemini';
import { ProcessingState } from '../types';

export const VirtualFit: React.FC = () => {
  const { apiKey } = useApiKey();
  const [productImg, setProductImg] = useState<string | null>(null);
  const [modelImg, setModelImg] = useState<string | null>(null);
  const [resultImg, setResultImg] = useState<string | null>(null);
  const [processing, setProcessing] = useState<ProcessingState>({ isProcessing: false, statusMessage: '' });
  const [sliderPos, setSliderPos] = useState(50);

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>, setter: (s: string | null) => void) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setter(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!productImg || !modelImg || !apiKey) return;

    setProcessing({ isProcessing: true, statusMessage: 'Analyzing garments...' });
    
    try {
      // Step 1: Simulated "Chain" message for UX
      setTimeout(() => setProcessing(prev => ({ ...prev, statusMessage: 'Draping fabric on model...' })), 2000);
      
      const result = await generateVirtualFit(productImg, modelImg, apiKey);
      setResultImg(result);
      setProcessing({ isProcessing: false, statusMessage: '' });
    } catch (error: any) {
      alert(`Error: ${error.message}`);
      setProcessing({ isProcessing: false, statusMessage: '' });
    }
  };

  const ImageUploader = ({ label, img, setImg }: { label: string, img: string | null, setImg: any }) => (
    <div className="flex flex-col gap-2 flex-1 w-full">
      <span className="text-sm font-semibold text-lumina-muted uppercase tracking-wider">{label}</span>
      <div className={`relative w-full aspect-[3/4] bg-lumina-surface border-2 ${img ? 'border-lumina-primary' : 'border-dashed border-gray-700'} rounded-2xl flex flex-col items-center justify-center overflow-hidden transition-all group hover:border-lumina-accent`}>
        {img ? (
          <>
            <img src={img} alt={label} className="w-full h-full object-cover" />
            <button 
              onClick={() => setImg(null)}
              className="absolute top-2 right-2 p-2 bg-black/50 rounded-full hover:bg-red-500/80 transition-colors"
            >
              <X className="w-4 h-4 text-white" />
            </button>
          </>
        ) : (
          <label className="flex flex-col items-center justify-center w-full h-full cursor-pointer p-4">
            <div className="p-4 bg-gray-800 rounded-full mb-3 group-hover:scale-110 transition-transform">
              <Upload className="w-6 h-6 text-lumina-muted group-hover:text-white" />
            </div>
            <span className="text-sm text-center text-gray-400 group-hover:text-white">Click to Upload</span>
            <input type="file" className="hidden" accept="image/*" onChange={(e) => handleFile(e, setImg)} />
          </label>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex items-center justify-between">
         <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Layers className="text-lumina-primary" />
            Virtual Fitting Room
         </h2>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <ImageUploader label="Garment" img={productImg} setImg={setProductImg} />
        <ImageUploader label="Model" img={modelImg} setImg={setModelImg} />
      </div>

      {resultImg ? (
        <div className="flex-1 w-full bg-lumina-surface rounded-2xl overflow-hidden relative border border-gray-700 p-1">
            {/* Comparison Slider Implementation */}
             <div className="relative w-full h-full select-none" style={{ minHeight: '400px' }}>
                <img src={modelImg!} alt="Before" className="absolute top-0 left-0 w-full h-full object-contain" />
                <div 
                    className="absolute top-0 left-0 h-full overflow-hidden border-r-2 border-white shadow-xl"
                    style={{ width: `${sliderPos}%` }}
                >
                    <img src={resultImg} alt="After" className="absolute top-0 left-0 w-full max-w-none h-full object-contain" style={{ width: `${10000/sliderPos}%` }} /> 
                    {/* Note: The above inner img width hack is simple; better is distinct containers. Let's do simple overlay. */}
                </div>
                {/* Re-render properly for slider */}
                 <div 
                    className="absolute inset-0 w-full h-full"
                 >
                     {/* Background: Original */}
                     <div className="absolute inset-0 w-full h-full flex justify-center bg-black">
                        <img src={modelImg!} className="h-full object-contain opacity-50" />
                     </div>
                     {/* Foreground: Result masked */}
                     <div 
                        className="absolute inset-0 w-full h-full flex justify-center bg-black"
                        style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)`}}
                     >
                         <img src={resultImg} className="h-full object-contain" />
                     </div>
                     
                     {/* Slider Handle */}
                     <input 
                        type="range" 
                        min="0" 
                        max="100" 
                        value={sliderPos} 
                        onChange={(e) => setSliderPos(Number(e.target.value))}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-ew-resize z-20"
                     />
                     <div 
                        className="absolute top-0 bottom-0 w-1 bg-white z-10 pointer-events-none shadow-[0_0_20px_rgba(0,0,0,0.5)]"
                        style={{ left: `${sliderPos}%` }}
                     >
                        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg">
                            <Layers className="w-4 h-4 text-black" />
                        </div>
                     </div>
                 </div>
                 
                 <div className="absolute bottom-4 left-4 z-20 bg-black/60 backdrop-blur px-3 py-1 rounded text-xs">Result</div>
                 <div className="absolute bottom-4 right-4 z-20 bg-black/60 backdrop-blur px-3 py-1 rounded text-xs">Original</div>
                 
                 <button 
                    onClick={() => setResultImg(null)}
                    className="absolute top-4 right-4 z-30 bg-lumina-surface/80 p-2 rounded-full hover:bg-white/20"
                 >
                    <X className="w-5 h-5" />
                 </button>
             </div>
        </div>
      ) : (
        <button
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
                    <span>Generate Virtual Fit</span>
                </>
            )}
        </button>
      )}
    </div>
  );
};
