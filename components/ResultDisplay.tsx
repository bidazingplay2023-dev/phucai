
import React, { useState, useEffect } from 'react';
import { Download, RefreshCw, Layers, Plus, Check, ArrowRight, ArrowLeft } from 'lucide-react';

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
    <div className="mt-2 animate-fade-in flex flex-col h-full max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-3">
          Kết Quả
          <span className="px-3 py-1 rounded-full bg-green-100 text-green-700 text-xs font-semibold shadow-sm">
            {results.length} Ảnh
          </span>
        </h2>
        <div className="flex gap-2">
           <button 
            onClick={onReset}
            className="px-4 py-2 text-sm text-gray-600 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors font-medium flex items-center gap-2 shadow-sm"
          >
            <ArrowLeft size={16} />
            Quay lại
          </button>
        </div>
      </div>

      {/* Desktop Grid Layout: Image Left, Sidebar Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
        
        {/* Main Image Column */}
        <div className="lg:col-span-7 xl:col-span-8 bg-white p-2 rounded-2xl shadow-sm border border-gray-100">
            <div className="relative w-full rounded-xl overflow-hidden bg-gray-900 shadow-inner group flex items-center justify-center bg-[url('https://transparenttextures.com/patterns/cubes.png')]">
                {/* Max height constraint for desktop so it fits screen */}
                <img 
                    src={imageUrl} 
                    alt={`Result ${selectedIndex + 1}`} 
                    className="w-full h-auto max-h-[75vh] object-contain"
                />
            </div>
        </div>

        {/* Sidebar Controls Column */}
        <div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-6">
            
            {/* Action Box */}
            <div className="bg-white p-5 rounded-2xl shadow-lg shadow-indigo-50 border border-gray-100 flex flex-col gap-4">
                <button
                    onClick={() => onSelectForBackground(currentImageBase64)}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-4 px-6 rounded-xl font-bold hover:shadow-lg hover:scale-[1.02] transition-all group"
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
                        flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-all active:scale-[0.98]
                        ${isRegenerating ? 'opacity-70 cursor-wait' : ''}
                        `}
                    >
                        {isRegenerating ? (
                        <RefreshCw size={18} className="animate-spin" />
                        ) : (
                        <Plus size={18} />
                        )}
                        {isRegenerating ? 'Đang tạo...' : 'Tạo thêm'}
                    </button>

                    <button 
                        onClick={handleDownload}
                        className="flex items-center justify-center gap-2 bg-white border border-gray-200 text-gray-700 py-3 px-4 rounded-xl font-semibold hover:bg-gray-50 hover:text-indigo-600 transition-all shadow-sm active:scale-[0.98]"
                    >
                        <Download size={18} />
                        Tải ảnh
                    </button>
                </div>
                 
                 {isRegenerating && (
                    <div className="bg-blue-50 text-blue-700 text-xs p-3 rounded-lg flex items-center justify-center gap-2 animate-pulse">
                        <RefreshCw size={12} className="animate-spin" />
                        Đang thiết kế phương án mới...
                    </div>
                 )}
            </div>

            {/* History / Thumbnails */}
            {results.length > 0 && (
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex-1">
                    <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">Lịch sử phiên này</h3>
                    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-3 gap-3">
                        {results.map((res, idx) => (
                        <button
                            key={idx}
                            onClick={() => setSelectedIndex(idx)}
                            className={`relative aspect-[3/4] rounded-lg overflow-hidden border-2 transition-all shadow-sm ${
                            idx === selectedIndex 
                                ? 'border-indigo-600 ring-2 ring-indigo-100 ring-offset-2 scale-105 z-10' 
                                : 'border-gray-100 hover:border-gray-300 opacity-80 hover:opacity-100 hover:scale-105'
                            }`}
                        >
                            <img 
                                src={`data:image/png;base64,${res}`} 
                                className="w-full h-full object-cover" 
                                alt={`Thumb ${idx}`}
                            />
                            {idx === selectedIndex && (
                                <div className="absolute inset-0 bg-indigo-900/10 flex items-center justify-center backdrop-blur-[1px]">
                                    <div className="bg-indigo-600 rounded-full p-1 shadow-md">
                                        <Check size={12} className="text-white" strokeWidth={3} />
                                    </div>
                                </div>
                            )}
                        </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};
