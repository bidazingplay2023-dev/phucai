import React, { useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { resizeImageBase64 } from '../services/geminiService';

interface ImageUploaderProps {
  label: string;
  onImageSelected: (base64: string) => void;
  selectedImage: string | null;
  onClear: () => void;
}

const ImageUploader: React.FC<ImageUploaderProps> = ({ label, onImageSelected, selectedImage, onClear }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setIsProcessing(true);
      try {
        const base64 = await resizeImageBase64(e.target.files[0]);
        onImageSelected(base64);
      } catch (err) {
        console.error("Error processing image", err);
        alert("Could not process image. Please try another file.");
      } finally {
        setIsProcessing(false);
      }
    }
  };

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-slate-300 mb-2">{label}</label>
      
      {!selectedImage ? (
        <div 
          onClick={() => inputRef.current?.click()}
          className="border-2 border-dashed border-slate-700 hover:border-indigo-500/50 bg-slate-900/50 hover:bg-slate-800/50 rounded-xl h-48 flex flex-col items-center justify-center cursor-pointer transition-all group"
        >
          <div className="p-4 rounded-full bg-slate-800 group-hover:bg-slate-700 transition-colors mb-3">
            <Upload className="w-6 h-6 text-indigo-400" />
          </div>
          <p className="text-slate-400 text-sm font-medium">
            {isProcessing ? 'Optimizing Image...' : 'Tap to upload image'}
          </p>
          <input 
            type="file" 
            ref={inputRef}
            className="hidden" 
            accept="image/*"
            onChange={handleFileChange}
          />
        </div>
      ) : (
        <div className="relative rounded-xl overflow-hidden border border-slate-700 group">
          <img src={`data:image/jpeg;base64,${selectedImage}`} alt="Preview" className="w-full h-64 object-cover" />
          <button 
            onClick={onClear}
            className="absolute top-2 right-2 p-2 bg-black/60 backdrop-blur-md rounded-full text-white hover:bg-red-500/80 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};

export default ImageUploader;