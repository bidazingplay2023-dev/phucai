import React, { useState } from 'react';
import { Video, Sparkles, AlertCircle, Upload } from 'lucide-react';
import { useApiKey } from '../context/ApiKeyContext';
import { generateCinematicVideo } from '../services/gemini';
import { ProcessingState } from '../types';

export const CinematicVideo: React.FC = () => {
  const { apiKey } = useApiKey();
  const [prompt, setPrompt] = useState('');
  const [refImg, setRefImg] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [processing, setProcessing] = useState<ProcessingState>({ isProcessing: false, statusMessage: '' });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setRefImg(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!prompt || !apiKey) return;
    setProcessing({ isProcessing: true, statusMessage: 'Starting Veo engine...' });
    
    try {
        setProcessing({ isProcessing: true, statusMessage: 'Generating (this may take 1-2 mins)...' });
        // Optional: refImg passes image input to Veo for Image-to-Video
        const url = await generateCinematicVideo(prompt, apiKey, refImg || undefined);
        setVideoUrl(url);
    } catch (e: any) {
        alert(e.message);
    } finally {
        setProcessing({ isProcessing: false, statusMessage: '' });
    }
  };

  return (
    <div className="flex flex-col space-y-6 pb-24">
       <div className="bg-gradient-to-r from-purple-900/40 to-lumina-primary/20 p-6 rounded-2xl border border-purple-500/30">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2 mb-2">
            <Video className="text-purple-400" />
            Cinematic Video
          </h2>
          <p className="text-sm text-lumina-muted">
            Powered by <strong>Google Veo</strong>. Turn your static fashion shots into moving runway videos.
          </p>
       </div>

       {/* Video Player or Placeholder */}
       <div className="w-full aspect-[9/16] md:aspect-video bg-black rounded-2xl overflow-hidden relative shadow-2xl border border-gray-800">
          {videoUrl ? (
            <video 
                src={videoUrl} 
                controls 
                autoPlay 
                loop 
                className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-lumina-muted p-6 text-center">
                {processing.isProcessing ? (
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-12 h-12 border-4 border-lumina-primary/30 border-t-lumina-primary rounded-full animate-spin" />
                        <p className="animate-pulse">{processing.statusMessage}</p>
                    </div>
                ) : (
                    <>
                        <Video className="w-16 h-16 opacity-20 mb-4" />
                        <p>Generated video will appear here</p>
                    </>
                )}
            </div>
          )}
       </div>

       <div className="space-y-4 bg-lumina-surface p-4 rounded-xl">
            <div className="flex items-center gap-2 mb-2">
                 <div className="w-16 h-16 bg-gray-700 rounded-lg shrink-0 flex items-center justify-center overflow-hidden border border-gray-600 relative">
                    {refImg ? (
                        <img src={refImg} className="w-full h-full object-cover" />
                    ) : (
                        <Upload className="w-6 h-6 text-gray-400" />
                    )}
                    <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFile} accept="image/*" />
                 </div>
                 <div className="flex-1">
                    <label className="text-xs text-lumina-muted uppercase font-bold">Starting Frame (Optional)</label>
                    <p className="text-xs text-gray-400">Upload an image to animate it.</p>
                 </div>
            </div>

            <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the motion: Slow motion pan of a fashion model walking..."
                className="w-full bg-lumina-bg border border-gray-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-lumina-primary outline-none resize-none h-24 text-sm"
            />
            
            <button
                onClick={handleGenerate}
                disabled={!prompt || processing.isProcessing}
                className="w-full py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-lg flex items-center justify-center gap-2 transition-all"
            >
                <Sparkles className="w-4 h-4" />
                Generate Video
            </button>
            
            <div className="flex items-start gap-2 text-[10px] text-gray-500 bg-black/20 p-2 rounded">
                <AlertCircle className="w-3 h-3 mt-0.5" />
                Veo generation can take 1-2 minutes. Please keep this tab open.
            </div>
       </div>
    </div>
  );
};
