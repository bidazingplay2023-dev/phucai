
import React, { useState, useEffect } from 'react';
import { Download, RefreshCw, Layers, Plus, ArrowRight, Maximize2 } from 'lucide-react';
import { ImagePreviewModal } from './ImagePreviewModal';

interface ResultDisplayProps {
  results: string[];
  isRegenerating: boolean;
  onRegenerate: () => void;
  onReset: () => void;
  onSelectForBackground: (imageBase64: string) => void;
}

export const ResultDisplay: React.FC<ResultDisplayProps> = ({ 
  results, 
  isRegenerating,
  onRegenerate, 
  onSelectForBackground
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  // Reset selected index when a new result is added
  useEffect(() => {
    setSelectedIndex(0);
  }, [results.length]);

  if (results.length === 0) return null;

  const currentImageBase64 = results[selectedIndex];
  const imageUrl = `data:image/png;base64,${currentImageBase64}`;

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `ai-try-on-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 h-full p-4 flex flex-col">
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
        <h2 className="font-bold text-gray-800 flex items-center gap-3">
          Kết Quả
          <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold">
            {results.length} Ảnh
          </span>
        </h2>
      </div>

      <div className="flex-1 flex flex-col gap-6">
        
        {/* Main Image with Preview Click */}
        <div 
          className="relative w-full aspect-[9/16] max-h-[70vh] rounded-xl overflow-hidden shadow-sm bg-gray-50 border border-gray-100 group cursor-zoom-in mx-auto"
          onClick={() => setIsPreviewOpen(true)}
        >
            <img 
                src={imageUrl} 
                alt={`Result ${selectedIndex + 1}`} 
                className="w-full h-full object-contain"
            />
             {/* View Hint */}
             <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center pointer-events-none">
                <Maximize2 className="text-white opacity-0 group-hover:opacity-70 transition-opacity drop-shadow-md" size={40} />
            </div>
        </div>

        {/* Thumbnails */}
        {results.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide py-1">
                {results.map((res, idx) => (
                    <button
                        key={idx}
                        onClick={() => setSelectedIndex(idx)}
                        className={`relative flex-shrink-0 w-12 h-16 rounded-md overflow-hidden border-2 transition-all ${
                            idx === selectedIndex 
                            ? 'border-indigo-600 ring-2 ring-indigo-100 z-10' 
                            : 'border-transparent opacity-60 hover:opacity-100 hover:bg-gray-100'
                        }`}
                    >
                        <img 
                            src={`data:image/png;base64,${res}`} 
                            className="w-full h-full object-cover" 
                            alt={`Thumb ${idx}`}
                        />
                    </button>
                ))}
            </div>
        )}

        {/* Actions Area - Bottom */}
        <div className="mt-auto space-y-3">
            
            <button
                onClick={() => onSelectForBackground(currentImageBase64)}
                className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3.5 px-6 rounded-xl font-bold shadow-md shadow-indigo-200 hover:shadow-lg hover:scale-[1.01] transition-all group"
            >
                <Layers size={20} />
                <span>Dùng ảnh để thay bối cảnh</span>
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
            </button>

            <div className="grid grid-cols-2 gap-3">
                <button 
                    onClick={onRegenerate}
                    disabled={isRegenerating}
                    className={`
                    flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-all active:scale-[0.98] text-sm
                    ${isRegenerating ? 'opacity-70 cursor-wait' : ''}
                    `}
                >
                    {isRegenerating ? (
                    <RefreshCw size={16} className="animate-spin" />
                    ) : (
                    <Plus size={16} />
                    )}
                    {isRegenerating ? 'Đang tạo...' : 'Tạo thêm'}
                </button>

                <button 
                    onClick={handleDownload}
                    className="flex items-center justify-center gap-2 bg-gray-800 text-white py-3 px-4 rounded-xl font-semibold hover:bg-gray-900 transition-all shadow-sm active:scale-[0.98] text-sm"
                >
                    <Download size={16} />
                    Tải ảnh
                </button>
            </div>
        </div>
      </div>
      
      {/* Modal */}
      <ImagePreviewModal 
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        imageUrl={imageUrl}
        altText="Kết quả"
      />
    </div>
  );
};
