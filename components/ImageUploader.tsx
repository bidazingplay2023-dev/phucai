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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (image) {
      URL.revokeObjectURL(image.previewUrl);
    }
    onImageChange(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-2">
        <label className="text-sm font-semibold text-gray-700 block">
          {label}
        </label>
        {image && (
          <button 
            onClick={handleRemove}
            className="text-xs text-red-500 font-medium hover:text-red-700 flex items-center gap-1"
          >
            <X size={12} /> Xoá ảnh
          </button>
        )}
      </div>
      
      <div 
        className={`relative w-full aspect-[3/4] rounded-xl border-2 transition-all duration-300 overflow-hidden group cursor-pointer
          ${image ? 'border-indigo-500 bg-gray-50' : 'border-dashed border-gray-300 bg-white hover:border-indigo-400 hover:bg-indigo-50'}`}
        onClick={() => !image && inputRef.current?.click()}
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
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
              <span className="text-white font-medium text-sm bg-black/50 px-3 py-1 rounded-full">
                Nhấn để xoá & thay đổi
              </span>
            </div>
            {/* Change trigger logic needs to be careful not to conflict with remove button. 
                Currently click triggers remove handled by parent click if no image, but here image exists.
                Let's keep it simple: Click removes logic is separate. Re-clicking container does nothing if image exists to avoid accidental replace.
            */}
          </div>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
            <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center mb-3 text-indigo-600">
              <Upload size={24} />
            </div>
            <span className="text-sm font-medium text-gray-900">Tải ảnh lên</span>
            <span className="text-xs text-gray-500 mt-1">{subLabel}</span>
          </div>
        )}
      </div>
    </div>
  );
};