import React, { useCallback } from 'react';
import { Upload, RefreshCw } from 'lucide-react';

interface ImageUploaderProps {
  label: string;
  id: string;
  image: string | null;
  onUpload: (base64: string, name: string) => void;
  className?: string;
  compact?: boolean;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ label, id, image, onUpload, className = "", compact = false }) => {
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      onUpload(base64, file.name);
    };
    reader.readAsDataURL(file);
  }, [onUpload]);

  return (
    <div className={`flex flex-col space-y-2 ${className}`}>
      <label className="text-[10px] lg:text-xs font-bold text-slate-400 uppercase tracking-widest pl-1">{label}</label>
      <div className="relative group w-full">
        <input
          type="file"
          id={id}
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
        />
        <label
          htmlFor={id}
          className={`relative flex flex-col items-center justify-center w-full border rounded-xl cursor-pointer transition-all duration-300 overflow-hidden group/label
            ${image 
              ? 'border-indigo-500/30 bg-slate-900/80 shadow-[0_0_15px_-3px_rgba(99,102,241,0.2)]' 
              : 'border-slate-700/50 border-dashed hover:border-indigo-500/50 bg-slate-800/20 hover:bg-slate-800/40'}
            ${compact ? 'h-28 lg:h-32' : 'h-44 lg:h-52'} 
          `}
          // Increased height for better touch area on mobile
        >
          {image ? (
            <div className="relative w-full h-full p-2">
              <div className="w-full h-full rounded-lg overflow-hidden relative">
                <img src={image} alt="Preview" className="w-full h-full object-contain" />
                {/* Overlay hover effect */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/label:opacity-100 flex flex-col items-center justify-center transition-opacity backdrop-blur-[2px]">
                   <RefreshCw className="w-6 h-6 text-white mb-1" />
                   <span className="text-white text-[10px] font-bold uppercase tracking-wide">Thay đổi ảnh</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-3 p-4 text-center group-hover/label:-translate-y-1 transition-transform duration-300">
              <div className={`rounded-full bg-slate-800/80 ring-1 ring-white/10 flex items-center justify-center shadow-lg ${compact ? 'p-3' : 'p-4'}`}>
                <Upload className={`${compact ? 'w-5 h-5' : 'w-7 h-7'} text-slate-400 group-hover/label:text-indigo-400 transition-colors`} />
              </div>
              {!compact && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-slate-300 group-hover/label:text-white transition-colors">Tải ảnh lên</p>
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">PNG, JPG, WEBP</p>
                </div>
              )}
            </div>
          )}
        </label>
      </div>
    </div>
  );
};

export default ImageUploader;