import React, { useState } from 'react';
import { ImageUpload } from './ui/ImageUpload';
import { generateVideo } from '../services/geminiService';

interface VideoProps {
  apiKey: string | null;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

export const VideoFeature: React.FC<VideoProps> = ({ apiKey, onError, onSuccess }) => {
  const [sourceImg, setSourceImg] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleGenerate = async () => {
    if (!apiKey) return onError("Vui lòng nhập API Key.");
    if (!sourceImg) return onError("Vui lòng tải ảnh sản phẩm.");

    setIsProcessing(true);
    try {
      const url = await generateVideo(apiKey, sourceImg, prompt);
      setVideoUrl(url);
      onSuccess("Sản xuất video thành công!");
    } catch (err: any) {
      onError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-yellow-500/10 border border-yellow-500/30 p-4 rounded-xl">
        <p className="text-yellow-200 text-sm">
          ⚠️ Tính năng Video sử dụng mô hình Veo. Quá trình tạo có thể mất 1-2 phút. Vui lòng kiên nhẫn.
        </p>
      </div>

      <ImageUpload 
        label="Ảnh Sản Phẩm (Làm khung hình đầu)" 
        image={sourceImg} 
        onImageChange={setSourceImg} 
      />

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">Kịch bản Video</label>
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="Mô tả chuyển động (VD: Camera xoay tròn quanh sản phẩm, ánh sáng lấp lánh)"
          className="w-full bg-studio-900 border border-studio-700 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-studio-accent outline-none"
        />
      </div>

      <button
        onClick={handleGenerate}
        disabled={isProcessing || !sourceImg}
        className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg transition-all ${
          isProcessing 
            ? 'bg-gray-600 cursor-not-allowed' 
            : 'bg-rose-600 hover:bg-rose-500 text-white active:scale-95'
        }`}
      >
        {isProcessing ? 'Đang Quay Phim (1-2p)...' : '🎬 Sản Xuất Video'}
      </button>

      {videoUrl && (
        <div className="bg-studio-800 p-4 rounded-2xl border border-studio-700 animate-fade-in mt-8">
          <h3 className="text-lg font-semibold text-white mb-3">Video Hoàn Thiện</h3>
          <div className="relative aspect-[9/16] w-full rounded-xl overflow-hidden bg-black">
             <video 
                src={videoUrl} 
                controls 
                autoPlay 
                loop 
                className="w-full h-full object-contain" 
             />
          </div>
          <a 
            href={videoUrl} 
            download="ai-video-result.mp4"
            className="block w-full text-center mt-4 py-3 bg-studio-700 hover:bg-studio-600 text-white rounded-lg font-medium"
          >
            Tải Video về
          </a>
        </div>
      )}
    </div>
  );
};