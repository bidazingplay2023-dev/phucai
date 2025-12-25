import React, { useState } from 'react';
import { ImageUpload } from './ui/ImageUpload';
import { generateBackground } from '../services/geminiService';

interface BackgroundProps {
  apiKey: string | null;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

export const BackgroundFeature: React.FC<BackgroundProps> = ({ apiKey, onError, onSuccess }) => {
  const [sourceImg, setSourceImg] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [resultImg, setResultImg] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleGenerate = async () => {
    if (!apiKey) return onError("Vui lòng nhập API Key.");
    if (!sourceImg) return onError("Vui lòng tải ảnh sản phẩm.");
    if (!prompt.trim()) return onError("Vui lòng mô tả bối cảnh mong muốn.");

    setIsProcessing(true);
    try {
      const result = await generateBackground(apiKey, sourceImg, prompt);
      setResultImg(result);
      onSuccess("Tạo bối cảnh thành công!");
    } catch (err: any) {
      onError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const suggestions = [
    "Trên bàn gỗ sồi, ánh nắng buổi sáng, cạnh tách cà phê",
    "Studio nền trắng tối giản, ánh sáng studio mềm mại",
    "Đường phố Paris mờ ảo phía sau, phong cách thời trang",
    "Bãi biển nhiệt đới, cát trắng, bầu trời xanh"
  ];

  return (
    <div className="space-y-6">
      <ImageUpload 
        label="Ảnh Sản Phẩm Gốc" 
        image={sourceImg} 
        onImageChange={setSourceImg} 
        heightClass="h-48"
      />

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Mô tả bối cảnh (Prompt)</label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Ví dụ: Đặt sản phẩm trên bệ đá cẩm thạch, phông nền sang trọng..."
          className="w-full bg-studio-900 border border-studio-700 rounded-xl p-4 text-white focus:ring-2 focus:ring-studio-accent outline-none h-32 resize-none"
        />
        <div className="mt-2 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => setPrompt(s)}
              className="whitespace-nowrap px-3 py-1 bg-studio-800 text-xs text-gray-400 rounded-full border border-studio-700 hover:border-studio-accent hover:text-white transition-colors"
            >
              {s.substring(0, 20)}...
            </button>
          ))}
        </div>
      </div>

      <button
        onClick={handleGenerate}
        disabled={isProcessing || !sourceImg}
        className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all ${
          isProcessing 
            ? 'bg-gray-600 cursor-not-allowed' 
            : 'bg-emerald-600 hover:bg-emerald-500 text-white active:scale-95'
        }`}
      >
        {isProcessing ? 'Đang Thiết Kế...' : '🎨 Tạo Bối Cảnh'}
      </button>

      {resultImg && (
        <div className="bg-studio-800 p-4 rounded-2xl border border-studio-700 animate-fade-in mt-8">
          <div className="relative aspect-square w-full rounded-xl overflow-hidden">
             <img src={resultImg} alt="Background Result" className="w-full h-full object-cover" />
          </div>
          <a 
            href={resultImg} 
            download="ai-background-result.jpg"
            className="block w-full text-center mt-4 py-3 bg-studio-700 hover:bg-studio-600 text-white rounded-lg font-medium"
          >
            Tải ảnh về
          </a>
        </div>
      )}
    </div>
  );
};