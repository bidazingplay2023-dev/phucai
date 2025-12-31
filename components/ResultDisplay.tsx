import React, { useState, useEffect } from 'react';
import { Download, RefreshCw, Layers, Plus, Check, ArrowRight } from 'lucide-react';

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
  onReset,
  onSelectForBackground
}) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

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
    <div className="mt-2 animate-fade-in flex flex-col h-full">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          Kết Quả ({results.length})
          <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-normal">Thành công</span>
        </h2>
        <div className="flex gap-2">
           <button 
            onClick={onReset}
            className="px-3 py-1.5 text-sm text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors font-medium"
          >
            Tải ảnh khác
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
        {/* Main Image */}
        <div className="relative w-full rounded-lg overflow-hidden bg-gray-900 aspect-[9/16] shadow-inner group">
           <img 
            src={imageUrl} 
            alt={`Result ${selectedIndex + 1}`} 
            className="w-full h-full object-contain"
          />
        </div>

        {/* Thumbnails */}
        {results.length > 0 && (
          <div className="mt-4 flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {results.map((res, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedIndex(idx)}
                className={`relative flex-shrink-0 w-16 h-24 rounded-lg overflow-hidden border-2 transition-all ${
                  idx === selectedIndex ? 'border-indigo-600 ring-2 ring-indigo-100' : 'border-transparent opacity-60 hover:opacity-100'
                }`}
              >
                <img 
                  src={`data:image/png;base64,${res}`} 
                  className="w-full h-full object-cover" 
                  alt={`Thumb ${idx}`}
                />
                {idx === selectedIndex && (
                  <div className="absolute inset-0 bg-indigo-900/10 flex items-center justify-center">
                    <Check size={16} className="text-white drop-shadow-md" />
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {/* Actions Grid */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button 
            onClick={onRegenerate}
            disabled={isRegenerating}
            className={`
              flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-all active:scale-[0.98]
              ${isRegenerating ? 'opacity-70 cursor-wait' : ''}
            `}
          >
            {isRegenerating ? (
               <RefreshCw size={20} className="animate-spin" />
            ) : (
               <Plus size={20} />
            )}
            {isRegenerating ? 'Đang tạo...' : 'Tạo thêm 1 ảnh'}
          </button>

          <button 
            onClick={handleDownload}
            className="flex items-center justify-center gap-2 bg-indigo-600 text-white py-3 px-4 rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-md active:scale-[0.98]"
          >
            <Download size={20} />
            Tải ảnh này
          </button>

          {/* New Step 2 Button */}
          <button
            onClick={() => onSelectForBackground(currentImageBase64)}
            className="col-span-2 mt-1 flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3.5 px-6 rounded-xl font-bold hover:shadow-lg hover:scale-[1.01] transition-all"
          >
            <Layers size={20} />
            Dùng ảnh này để thay bối cảnh
            <ArrowRight size={18} />
          </button>
        </div>
        
        {isRegenerating && (
          <p className="text-center text-xs text-indigo-600 mt-2 animate-pulse">
            Đang tạo thêm biến thể mới... Vui lòng đợi.
          </p>
        )}
      </div>
    </div>
  );
};