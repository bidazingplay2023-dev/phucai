import React, { useState } from 'react';
import { ImageUpload } from './ui/ImageUpload';
import { generateTryOn } from '../services/geminiService';

interface TryOnProps {
  apiKey: string | null;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

export const TryOnFeature: React.FC<TryOnProps> = ({ apiKey, onError, onSuccess }) => {
  const [modelImg, setModelImg] = useState<string | null>(null);
  const [productImg, setProductImg] = useState<string | null>(null);
  const [resultImg, setResultImg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleGenerate = async () => {
    if (!apiKey) return onError("Vui lòng nhập API Key trong phần Cài Đặt trước.");
    if (!modelImg || !productImg) return onError("Vui lòng tải lên cả ảnh người mẫu và ảnh sản phẩm.");

    setIsProcessing(true);
    try {
      const result = await generateTryOn(apiKey, modelImg, productImg);
      setResultImg(result);
      onSuccess("Thử đồ thành công!");
    } catch (err: any) {
      onError(err.message || "Có lỗi xảy ra khi xử lý.");
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ImageUpload 
          label="1. Ảnh Người Mẫu" 
          image={modelImg} 
          onImageChange={setModelImg} 
        />
        <ImageUpload 
          label="2. Ảnh Sản Phẩm (Quần/Áo)" 
          image={productImg} 
          onImageChange={setProductImg} 
        />
      </div>

      <button
        onClick={handleGenerate}
        disabled={isProcessing || !modelImg || !productImg}
        className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all ${
          isProcessing 
            ? 'bg-gray-600 cursor-not-allowed animate-pulse' 
            : 'bg-gradient-to-r from-studio-accent to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white active:scale-95'
        }`}
      >
        {isProcessing ? 'AI Đang Xử Lý...' : '✨ Bắt Đầu Thử Đồ'}
      </button>

      {resultImg && (
        <div className="bg-studio-800 p-4 rounded-2xl border border-studio-700 animate-fade-in mt-8">
          <h3 className="text-lg font-semibold text-white mb-3">Kết quả AI</h3>
          <div className="relative aspect-[3/4] w-full rounded-xl overflow-hidden">
             <img src={resultImg} alt="Result" className="w-full h-full object-contain bg-black" />
          </div>
          <a 
            href={resultImg} 
            download="ai-tryon-result.jpg"
            className="block w-full text-center mt-4 py-3 bg-studio-700 hover:bg-studio-600 text-white rounded-lg font-medium"
          >
            Tải ảnh về
          </a>
        </div>
      )}
    </div>
  );
};