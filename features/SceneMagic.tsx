import React, { useState } from 'react';
import { Upload, Sparkles, Image as ImageIcon } from 'lucide-react';
import { useApiKey } from '../context/ApiKeyContext';
import { generateSceneMagic } from '../services/gemini';
import { ProcessingState } from '../types';

const PRESETS = [
  "Professional photo studio with soft grey lighting",
  "Luxury modern living room with sunlight",
  "Urban street style, blurred city lights bokeh",
  "Tropical beach at golden hour",
  "Minimalist concrete architectural background"
];

export const SceneMagic: React.FC = () => {
  const { apiKey } = useApiKey();
  const [sourceImg, setSourceImg] = useState<string | null>(null);
  const [resultImg, setResultImg] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [processing, setProcessing] = useState<ProcessingState>({ isProcessing: false, statusMessage: '' });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setSourceImg(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!sourceImg || !prompt || !apiKey) return;
    setProcessing({ isProcessing: true, statusMessage: 'Generating new scene...' });
    try {
      const result = await generateSceneMagic(sourceImg, prompt, apiKey);
      setResultImg(result);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setProcessing({ isProcessing: false, statusMessage: '' });
    }
  };

  return (
    <div className="flex flex-col space-y-6 pb-20">
      <h2 className="text-2xl font-bold text-white flex items-center gap-2">
        <ImageIcon className="text-lumina-primary" />
        Scene Magic
      </h2>

      {/* Main Preview Area */}
      <div className="w-full aspect-square md:aspect-video bg-lumina-surface rounded-2xl border-2 border-dashed border-gray-700 overflow-hidden relative flex flex-col items-center justify-center">
        {resultImg ? (
             <img src={resultImg} alt="Result" className="w-full h-full object-contain" />
        ) : sourceImg ? (
             <img src={sourceImg} alt="Source" className="w-full h-full object-contain" />
        ) : (
            <label className="flex flex-col items-center gap-3 cursor-pointer p-10 hover:bg-white/5 w-full h-full justify-center transition-colors">
                <Upload className="w-10 h-10 text-lumina-muted" />
                <span className="text-lumina-muted">Upload Photo to Start</span>
                <input type="file" className="hidden" accept="image/*" onChange={handleFile} />
            </label>
        )}
        
        {/* Reset Button */}
        {(sourceImg || resultImg) && (
            <button 
                onClick={() => { setSourceImg(null); setResultImg(null); }}
                className="absolute top-4 right-4 bg-black/50 text-white text-xs px-3 py-1 rounded-full backdrop-blur"
            >
                Clear
            </button>
        )}
      </div>

      {/* Controls */}
      <div className="space-y-4">
        <div className="space-y-2">
            <label className="text-sm font-semibold text-lumina-muted">Prompt</label>
            <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Describe the background you want..."
                className="w-full bg-lumina-surface border border-gray-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-lumina-primary outline-none resize-none h-24"
            />
        </div>

        {/* Chips */}
        <div className="flex flex-wrap gap-2">
            {PRESETS.map((p, i) => (
                <button
                    key={i}
                    onClick={() => setPrompt(p)}
                    className="text-xs bg-gray-800 hover:bg-gray-700 text-lumina-muted hover:text-white px-3 py-1.5 rounded-full border border-gray-700 transition-colors"
                >
                    {p}
                </button>
            ))}
        </div>

        <button
            onClick={handleGenerate}
            disabled={!sourceImg || !prompt || processing.isProcessing}
            className="w-full py-4 bg-lumina-primary disabled:opacity-50 disabled:cursor-not-allowed hover:bg-lumina-accent text-white font-bold rounded-xl flex items-center justify-center gap-2 transition-all"
        >
             {processing.isProcessing ? (
                <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Generating...
                </>
            ) : (
                <>
                    <Sparkles className="w-5 h-5" />
                    Generate Scene
                </>
            )}
        </button>
      </div>
    </div>
  );
};
