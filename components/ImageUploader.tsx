import React, { useCallback } from 'react';

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
            ${compact ? 'h-24 lg:h-32' : 'h-36 lg:h-52'}
          `}
        >
          {image ? (
            <div className="relative w-full h-full p-2">
              <div className="w-full h-full rounded-lg overflow-hidden relative">
                <img src={image} alt="Preview" className="w-full h-full object-contain" />
                {/* Overlay hover effect */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/label:opacity-100 flex flex-col items-center justify-center transition-opacity backdrop-blur-[2px]">
                   <svg className="w-6 h-6 text-white mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                   <span className="text-white text-[10px] font-bold uppercase tracking-wide">Thay đổi ảnh</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-3 p-4 text-center group-hover/label:-translate-y-1 transition-transform duration-300">
              <div className={`rounded-full bg-slate-800/80 ring-1 ring-white/10 flex items-center justify-center shadow-lg ${compact ? 'p-2' : 'p-3'}`}>
                <svg className={`${compact ? 'w-4 h-4 lg:w-5 lg:h-5' : 'w-6 h-6 lg:w-7 lg:h-7'} text-slate-400 group-hover/label:text-indigo-400 transition-colors`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
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