import React, { useRef } from 'react';
import { processImage } from '../../services/imageUtils';

interface ImageUploadProps {
  label: string;
  image: string | null;
  onImageChange: (base64: string) => void;
  heightClass?: string;
}

export const ImageUpload: React.FC<ImageUploadProps> = ({ 
  label, 
  image, 
  onImageChange,
  heightClass = "h-64"
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const { base64 } = await processImage(file);
        onImageChange(base64);
      } catch (err) {
        console.error("Image processing failed", err);
        alert("Lỗi xử lý ảnh. Vui lòng chọn ảnh khác.");
      }
    }
  };

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-gray-300 mb-2">{label}</label>
      <div 
        onClick={() => fileInputRef.current?.click()}
        className={`relative w-full ${heightClass} bg-studio-800 border-2 border-dashed border-studio-700 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-studio-accent transition-colors overflow-hidden group`}
      >
        {image ? (
          <>
            <img 
              src={`data:image/jpeg;base64,${image}`} 
              alt="Preview" 
              className="w-full h-full object-cover" 
            />
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <span className="text-white font-medium">Thay đổi ảnh</span>
            </div>
          </>
        ) : (
          <div className="text-center p-4">
            <svg className="mx-auto h-12 w-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p className="mt-2 text-sm text-gray-400">Chạm để tải ảnh lên</p>
          </div>
        )}
      </div>
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange} 
        accept="image/*" 
        className="hidden" 
      />
    </div>
  );
};