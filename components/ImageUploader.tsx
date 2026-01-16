
import React, { useRef, useState } from 'react';
import { Upload, Edit2, Maximize2 } from 'lucide-react';
import { ProcessedImage } from '../types';
import { ImagePreviewModal } from './ImagePreviewModal';

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
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const processFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chỉ tải lên tệp hình ảnh.');
      return;
    }

    try {
      const previewUrl = URL.createObjectURL(file);
      // Remove Base64 generation here. We just pass the File and URL.
      onImageChange({ file, previewUrl });
    } catch (err) {
      console.error("Error processing file", err);
      alert("Lỗi khi xử lý ảnh.");
    } finally {
       // Reset input so selecting the same file triggers change again
       if (inputRef.current) {
         inputRef.current.value = '';
       }
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

  const triggerUpload = () => {
    inputRef.current?.click();
  };

  return (
    <div className="w-full">
      {label && (
        <label className="text-sm font-semibold text-gray-700 block mb-2">
          {label}
        </label>
      )}
      
      <div 
        tabIndex={0} 
        onPaste={handlePaste}
        className={`relative w-full aspect-[3/4] rounded-xl transition-all duration-300 overflow-hidden group shadow-sm
          ${image ? 'border border-gray-200 bg-white' : 'border border-gray-200 bg-gray-50 hover:bg-gray-100 hover:border-gray-300'}`}
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
          <>
            <div 
                className="absolute inset-0 z-10 cursor-zoom-in"
                onClick={() => setIsPreviewOpen(true)}
            >
                <img 
                    src={image.previewUrl} 
                    alt={label} 
                    className="w-full h-full object-contain p-2"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center pointer-events-none">
                     <Maximize2 className="text-white opacity-0 group-hover:opacity-70 transition-opacity drop-shadow-md" size={32} />
                </div>
            </div>

            <button
                type="button"
                onClick={(e) => {
                    e.stopPropagation();
                    triggerUpload();
                }}
                className="absolute bottom-3 right-3 z-20 bg-white text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50 px-3 py-2 rounded-lg shadow-md border border-gray-200 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
            >
                <Edit2 size={14} />
                Thay ảnh
            </button>
            
            <ImagePreviewModal 
                isOpen={isPreviewOpen}
                onClose={() => setIsPreviewOpen(false)}
                imageUrl={image.previewUrl}
                altText={label}
            />
          </>
        ) : (
          <div 
            className="absolute inset-0 z-10 flex flex-col items-center justify-center p-4 text-center cursor-pointer"
            onClick={triggerUpload}
          >
            <div className="w-12 h-12 rounded-full bg-white border border-gray-200 flex items-center justify-center mb-3 text-gray-400 group-hover:scale-110 group-hover:text-indigo-500 group-hover:border-indigo-200 transition-all shadow-sm">
              <Upload size={20} />
            </div>
            <span className="text-sm font-semibold text-gray-700">Tải ảnh lên</span>
            <span className="text-xs text-gray-400 mt-1 block max-w-[80%] mx-auto leading-tight">
                {subLabel}
            </span>
            <span className="mt-3 text-[10px] text-indigo-500 font-medium opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-50 px-2 py-0.5 rounded-full">
                hoặc Ctrl+V
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
