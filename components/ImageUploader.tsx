import React, { useRef } from 'react';
import { Upload, X, Image as ImageIcon } from 'lucide-react';
import { fileToBase64 } from '../services/utils';
import { ProcessedImage } from '../types';

interface ImageUploaderProps {
  label: string;
  subLabel: string;
  image: ProcessedImage | null;
  onImageChange: (image: ProcessedImage | null) => void;
  id: string;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({
  label,
  subLabel,
  image,
  onImageChange,
  id
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chỉ tải lên tệp hình ảnh.');
      return;
    }

    try {
      const base64 = await fileToBase64(file);
      const previewUrl = URL.createObjectURL(file);
      onImageChange({ file, previewUrl, base64 });
    } catch (err) {
      console.error("Error processing file", err);
      alert("Lỗi khi xử lý ảnh.");
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await processFile(file);
    }
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault(); // Prevent pasting text if any
          await processFile(file);
          return;
        }
      }
    }
  };

  return (
    <div className="w-full">
      {label && (
        <div className="flex justify-between items-center mb-2">
          <label className="text-sm font-semibold text-gray-700 block">
            {label}
          </label>
        </div>
      )}
      
      <div 
        tabIndex={0} // Make div focusable to receive paste events
        onPaste={handlePaste}
        className={`relative w-full aspect-[3/4] rounded-xl border-2 transition-all duration-300 overflow-hidden group cursor-pointer focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent
          ${image ? 'border-indigo-500 bg-gray-50' : 'border-dashed border-gray-300 bg-white hover:border-indigo-400 hover:bg-indigo-50'}`}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            inputRef.current?.click();
          }
        }}
      >
        <input 
          type="file" 
          ref={inputRef}
          onChange={handleFileChange} 
          accept="image/*" 
          className="hidden" 
          id={id}
        />

        {image ? (
          <div className="relative w-full h-full">
             <img 
              src={image.previewUrl} 
              alt={label} 
              className="w-full h-full object-cover"
            />
            {/* Overlay for change hint */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
              <span className="opacity-0 group-hover:opacity-100 transition-opacity text-white font-medium text-xs bg-black/60 px-3 py-1.5 rounded-full backdrop-blur-sm flex items-center gap-1">
                <ImageIcon size={12} />
                Thay đổi ảnh
              </span>
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
            <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mb-3 text-indigo-600 group-hover:scale-110 transition-transform">
              <Upload size={24} />
            </div>
            <span className="text-sm font-medium text-gray-900">Tải ảnh lên</span>
            <span className="text-xs text-gray-500 mt-1 block">
                {subLabel} <br/>
                <span className="text-indigo-500 font-semibold opacity-80">hoặc dán ảnh (Ctrl+V)</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
};