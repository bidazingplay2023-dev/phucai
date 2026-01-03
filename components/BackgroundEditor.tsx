
import React, { useState, useEffect } from 'react';
import { 
  Sparkles, Loader2, Wand2, Image as ImageIcon, 
  ChevronRight, Play, Volume2, Download, AlertCircle,
  RotateCcw, Video, FileText, Check, ArrowLeft, Plus, Layers, ArrowRight
} from 'lucide-react';
import { suggestBackgrounds, changeBackground, generateVideoPrompt } from '../services/geminiService';
import { generateSpeechEverAI } from '../services/everAiService';
import { BackgroundState, ProcessedImage, GeneratedBackground } from '../types';
import { ImageUploader } from './ImageUploader';

interface BackgroundEditorProps {
  initialBaseImage: string | null;
}

export const BackgroundEditor: React.FC<BackgroundEditorProps> = ({ initialBaseImage }) => {
  const [state, setState] = useState<BackgroundState>({
    selectedBaseImage: initialBaseImage,
    backgroundImage: null,
    textPrompt: '',
    aiSuggestions: [],
    isSuggesting: false,
    isGenerating: false,
    results: [],
    error: null,
  });

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedVoice, setSelectedVoice] = useState('Puck');

  useEffect(() => {
    if (initialBaseImage && state.aiSuggestions.length === 0) {
      handleGetSuggestions(initialBaseImage);
    }
  }, [initialBaseImage]);

  const handleGetSuggestions = async (img: string) => {
    setState(prev => ({ ...prev, isSuggesting: true }));
    try {
      const suggestions = await suggestBackgrounds(img);
      setState(prev => ({ ...prev, aiSuggestions: suggestions, isSuggesting: false }));
    } catch (err) {
      setState(prev => ({ ...prev, isSuggesting: false }));
    }
  };

  const handleGenerate = async () => {
    if (!state.selectedBaseImage) return;
    setState(prev => ({ ...prev, isGenerating: true, error: null }));
    try {
      const resultBase64 = await changeBackground(
        state.selectedBaseImage,
        state.textPrompt,
        state.backgroundImage
      );

      const newResult: GeneratedBackground = {
        base64: resultBase64,
        videoPrompts: [],
        voiceoverScripts: [],
        isVideoPromptLoading: true,
      };

      setState(prev => ({
        ...prev,
        isGenerating: false,
        results: [newResult, ...prev.results]
      }));
      setSelectedIndex(0);

      // Trigger video prompt generation for the new result
      handleGenerateContentForImage(resultBase64, 0);

    } catch (error: any) {
      setState(prev => ({ ...prev, isGenerating: false, error: error.message }));
    }
  };

  const handleGenerateContentForImage = async (base64: string, index: number) => {
    try {
      const { videoPrompts, voiceoverScripts } = await generateVideoPrompt(base64);
      setState(prev => {
        const updated = [...prev.results];
        if (updated[index]) {
          updated[index] = {
            ...updated[index],
            videoPrompts,
            voiceoverScripts,
            isVideoPromptLoading: false
          };
        }
        return { ...prev, results: updated };
      });
    } catch (err) {
      console.error("Content generation error", err);
      setState(prev => {
        const updated = [...prev.results];
        if (updated[index]) {
          updated[index].isVideoPromptLoading = false;
        }
        return { ...prev, results: updated };
      });
    }
  };

  // Fixed handleGenerateAudio with proper scope variables
  const handleGenerateAudio = async (scriptIndex: number, text: string) => {
    setState(prev => {
      const updatedResults = [...prev.results];
      const current = updatedResults[selectedIndex];
      if (current) {
        current.isAudioLoading = { ...current.isAudioLoading, [scriptIndex]: true };
      }
      return { ...prev, results: updatedResults };
    });

    try {
      // Keys are now obtained from environment variables within services
      const audioBase64 = await generateSpeechEverAI(text, selectedVoice);

      setState(prev => {
        const updatedResults = [...prev.results];
        const current = updatedResults[selectedIndex];
        if (current) {
          current.generatedAudios = { ...current.generatedAudios, [scriptIndex]: audioBase64 };
          current.isAudioLoading = { ...current.isAudioLoading, [scriptIndex]: false };
        }
        return { ...prev, results: updatedResults };
      });
    } catch (error) {
       console.error("Audio Gen Error", error);
       alert("Lỗi: " + error);
       setState(prev => {
        const updatedResults = [...prev.results];
        const current = updatedResults[selectedIndex];
        if (current) {
          current.isAudioLoading = { ...current.isAudioLoading, [scriptIndex]: false };
        }
        return { ...prev, results: updatedResults };
      });
    }
  };

  const currentResult = state.results[selectedIndex];

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
        <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Wand2 className="text-purple-600" size={24} />
          Thay đổi bối cảnh
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="relative aspect-[9/16] bg-gray-100 rounded-xl overflow-hidden border-2 border-dashed border-gray-300">
              {state.selectedBaseImage ? (
                <img src={`data:image/png;base64,${state.selectedBaseImage}`} className="w-full h-full object-contain" alt="Base" />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">Chọn ảnh ở Bước 1 trước</div>
              )}
            </div>
            
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Gợi ý từ AI</label>
              <div className="flex flex-wrap gap-2">
                {state.isSuggesting ? (
                  <div className="flex items-center gap-2 text-indigo-600 text-xs font-medium animate-pulse">
                    <Loader2 className="animate-spin" size={14} /> Đang nghĩ...
                  </div>
                ) : (
                  state.aiSuggestions.map((s, i) => (
                    <button 
                      key={i}
                      onClick={() => setState(prev => ({ ...prev, textPrompt: s }))}
                      className="px-3 py-1.5 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium hover:bg-indigo-100 transition-colors"
                    >
                      {s}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold text-gray-700">Mô tả bối cảnh mới</label>
              <textarea
                value={state.textPrompt}
                onChange={(e) => setState(prev => ({ ...prev, textPrompt: e.target.value }))}
                className="w-full p-4 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none h-32 text-sm"
                placeholder="Ví dụ: Đứng trong một quán cafe sang trọng tại Paris..."
              />
            </div>

            <div className="space-y-2">
               <label className="text-sm font-semibold text-gray-700">Hoặc tải ảnh nền riêng</label>
               <ImageUploader 
                 id="bg-upload"
                 label="" 
                 subLabel="Ảnh nền tuỳ chỉnh"
                 image={state.backgroundImage}
                 onImageChange={(img) => setState(prev => ({ ...prev, backgroundImage: img }))}
               />
            </div>

            <button
              onClick={handleGenerate}
              disabled={state.isGenerating || !state.selectedBaseImage}
              className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-bold shadow-lg flex items-center justify-center gap-2 hover:scale-[1.02] transition-all disabled:opacity-50"
            >
              {state.isGenerating ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {state.isGenerating ? 'Đang tạo bối cảnh (20s)...' : 'Bắt đầu thay nền'}
            </button>
          </div>
        </div>
      </div>

      {state.results.length > 0 && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 animate-fade-in">
           <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-800">Kết quả bối cảnh</h3>
              <div className="flex gap-2">
                {state.results.map((_, i) => (
                  <button 
                    key={i}
                    onClick={() => setSelectedIndex(i)}
                    className={`w-3 h-3 rounded-full transition-all ${i === selectedIndex ? 'bg-indigo-600 w-8' : 'bg-gray-300'}`}
                  />
                ))}
              </div>
           </div>

           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="aspect-[9/16] bg-gray-900 rounded-2xl overflow-hidden shadow-xl">
                 <img src={`data:image/png;base64,${currentResult.base64}`} className="w-full h-full object-contain" alt="Result" />
              </div>

              <div className="space-y-6">
                 {currentResult.isVideoPromptLoading ? (
                    <div className="flex flex-col items-center justify-center h-40 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                       <Loader2 className="animate-spin text-indigo-600 mb-2" />
                       <span className="text-sm text-gray-500 font-medium">Đang phân tích kịch bản Video...</span>
                    </div>
                 ) : (
                    <>
                      <div className="space-y-3">
                         <h4 className="flex items-center gap-2 font-bold text-gray-800"><Video size={18} className="text-indigo-600"/> Gợi ý Video (Prompts)</h4>
                         <div className="space-y-2">
                            {currentResult.videoPrompts.map((p, i) => (
                               <div key={i} className="p-3 bg-gray-50 rounded-lg text-xs text-gray-700 border border-gray-100 hover:border-indigo-200 transition-colors">
                                  {p}
                               </div>
                            ))}
                         </div>
                      </div>

                      <div className="space-y-4">
                         <div className="flex items-center justify-between">
                            <h4 className="flex items-center gap-2 font-bold text-gray-800"><FileText size={18} className="text-purple-600"/> Kịch bản Voiceover</h4>
                            <select 
                              value={selectedVoice} 
                              onChange={(e) => setSelectedVoice(e.target.value)}
                              className="text-xs border rounded-lg p-1 outline-none"
                            >
                               <option value="Puck">Giọng Nam (Puck)</option>
                               <option value="Kore">Giọng Nữ (Kore)</option>
                               <option value="Charon">Giọng Trầm (Charon)</option>
                            </select>
                         </div>
                         
                         <div className="space-y-4">
                            {currentResult.voiceoverScripts.map((script, i) => (
                               <div key={i} className="p-4 bg-purple-50 rounded-xl border border-purple-100 space-y-3">
                                  <p className="text-sm italic text-gray-700 leading-relaxed">"{script}"</p>
                                  <div className="flex items-center justify-end gap-2">
                                     {currentResult.generatedAudios?.[i] ? (
                                        <audio controls src={`data:audio/wav;base64,${currentResult.generatedAudios[i]}`} className="h-8 w-48" />
                                     ) : (
                                        <button
                                          onClick={() => handleGenerateAudio(i, script)}
                                          disabled={currentResult.isAudioLoading?.[i]}
                                          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-xs font-bold hover:bg-purple-700 transition-all disabled:opacity-50"
                                        >
                                           {currentResult.isAudioLoading?.[i] ? <Loader2 size={14} className="animate-spin" /> : <Volume2 size={14} />}
                                           Tạo Audio
                                        </button>
                                     )}
                                  </div>
                               </div>
                            ))}
                         </div>
                      </div>
                    </>
                 )}
              </div>
           </div>
        </div>
      )}
    </div>
  );
};
