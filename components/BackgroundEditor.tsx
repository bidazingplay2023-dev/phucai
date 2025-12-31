import React, { useState, useEffect } from 'react';
import { ProcessedImage, BackgroundState, GeneratedBackground } from '../types';
import { suggestBackgrounds, changeBackground, generateVideoPrompt } from '../services/geminiService';
import { ImageUploader } from './ImageUploader';
import { Sparkles, Lightbulb, Loader2, Download, Plus, Check, RefreshCw, Image, Type, Upload, Trash2, Video, Copy, CheckCheck } from 'lucide-react';

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

  const [mode, setMode] = useState<'UPLOAD' | 'PROMPT'>('UPLOAD');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Sync prop to state if it changes
  useEffect(() => {
    if (initialBaseImage) {
      setState(prev => ({ 
        ...prev, 
        selectedBaseImage: initialBaseImage,
        results: [], 
        error: null,
      }));
    }
  }, [initialBaseImage]);

  // Reset selected index when new results come in (usually prepended to top)
  useEffect(() => {
    if (state.results.length > 0) {
        setSelectedIndex(0);
    }
  }, [state.results.length]);

  const handleSuggest = async () => {
    if (!state.selectedBaseImage) return;
    setState(prev => ({ ...prev, isSuggesting: true, error: null }));
    try {
      const suggestions = await suggestBackgrounds(state.selectedBaseImage);
      setState(prev => ({ ...prev, isSuggesting: false, aiSuggestions: suggestions }));
    } catch (err) {
      setState(prev => ({ ...prev, isSuggesting: false, error: "Không lấy được gợi ý." }));
    }
  };

  const handleGenerate = async (isRegenerate: boolean = false) => {
    if (!state.selectedBaseImage) {
        setState(prev => ({ ...prev, error: "Chưa có ảnh gốc để xử lý." }));
        return;
    }

    if (mode === 'UPLOAD' && !state.backgroundImage) {
      setState(prev => ({ ...prev, error: "Vui lòng tải ảnh nền lên." }));
      return;
    }
    if (mode === 'PROMPT' && !state.textPrompt.trim()) {
      setState(prev => ({ ...prev, error: "Vui lòng nhập mô tả bối cảnh." }));
      return;
    }

    setState(prev => ({ ...prev, isGenerating: true, error: null }));
    
    try {
      const bgImageParam = mode === 'UPLOAD' ? state.backgroundImage : null;
      const promptParam = mode === 'PROMPT' ? state.textPrompt : '';

      const resultBase64 = await changeBackground(state.selectedBaseImage, promptParam, bgImageParam);
      
      // Create a new result object with loading state for prompts
      const newResultItem: GeneratedBackground = {
          base64: resultBase64,
          videoPrompts: [],
          isVideoPromptLoading: true
      };

      // 1. Update UI with the image immediately
      setState(prev => {
          const updatedResults = isRegenerate ? [newResultItem, ...prev.results] : [newResultItem];
          return { 
            ...prev, 
            isGenerating: false, 
            results: updatedResults 
          };
      });

      // 2. Automatically generate prompt for THIS specific image
      try {
        const promptsResult = await generateVideoPrompt(resultBase64);
        
        // Update the specific item in the results array
        setState(prev => {
            const updatedResults = prev.results.map(item => {
                // Find the item by matching base64 (since it's unique per generation usually)
                if (item.base64 === resultBase64) {
                    return { ...item, videoPrompts: promptsResult, isVideoPromptLoading: false };
                }
                return item;
            });
            return { ...prev, results: updatedResults };
        });
      } catch (videoErr) {
        console.error("Video prompt failed", videoErr);
        setState(prev => {
            const updatedResults = prev.results.map(item => {
                if (item.base64 === resultBase64) {
                    return { ...item, videoPrompts: ["Lỗi tạo prompt video."], isVideoPromptLoading: false };
                }
                return item;
            });
            return { ...prev, results: updatedResults };
        });
      }

    } catch (err: any) {
      setState(prev => ({ ...prev, isGenerating: false, error: err.message }));
    }
  };

  const handleDownload = () => {
    if (state.results.length === 0) return;
    const currentResult = state.results[selectedIndex];
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${currentResult.base64}`;
    link.download = `ai-bg-change-${Date.now()}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyToClipboard = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const handleBaseImageUpload = (img: ProcessedImage | null) => {
    setState(prev => ({ 
      ...prev, 
      selectedBaseImage: img ? img.base64 : null,
      results: [],
      error: null
    }));
  };

  const clearBaseImage = () => {
      setState(prev => ({ ...prev, selectedBaseImage: null, results: [] }));
  };

  const PROMPT_LABELS = ["Cinematic (Điện ảnh)", "Dynamic (Năng động)", "Lifestyle (Tự nhiên)"];

  // Get current selected item safely
  const currentItem = state.results[selectedIndex];

  return (
    <div className="animate-in slide-in-from-right duration-500 pb-10">
      
      {/* CASE 1: NO BASE IMAGE SELECTED */}
      {!state.selectedBaseImage ? (
          <div className="flex flex-col items-center justify-center min-h-[300px] bg-white rounded-2xl border-2 border-dashed border-indigo-200 p-8 text-center space-y-4">
              <div className="w-16 h-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center">
                  <Upload size={32} />
              </div>
              <div>
                  <h3 className="text-lg font-bold text-gray-800">Tải ảnh mẫu cần đổi nền</h3>
                  <p className="text-sm text-gray-500 mt-1 max-w-xs mx-auto">
                      Bạn có thể dùng kết quả từ bước "Mặc thử" hoặc tải ảnh trực tiếp từ máy lên đây.
                  </p>
              </div>
              <div className="w-full max-w-xs">
                 <ImageUploader 
                    id="base-image-upload"
                    label=""
                    subLabel="Chọn ảnh (JPG/PNG)"
                    image={null}
                    onImageChange={handleBaseImageUpload}
                 />
              </div>
          </div>
      ) : (
        /* CASE 2: HAS BASE IMAGE - SHOW EDITOR */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left Column: Inputs */}
            <div className="space-y-6">
            
            {/* Base Image Preview with Change Option */}
            <div className="relative group flex gap-4 items-start bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                <img 
                src={`data:image/png;base64,${state.selectedBaseImage}`} 
                className="w-20 h-auto rounded-lg object-contain bg-gray-50 border" 
                alt="Base"
                />
                <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">Ảnh gốc đang xử lý</p>
                    <button 
                        onClick={clearBaseImage}
                        className="text-xs text-red-500 flex items-center gap-1 mt-2 hover:bg-red-50 px-2 py-1 rounded-md transition-colors"
                    >
                        <Trash2 size={12} /> Thay ảnh khác
                    </button>
                </div>
            </div>

            <div className="border-t border-gray-200 my-2"></div>

            {/* Mode Selection Tabs */}
            <div className="flex p-1 bg-gray-100 rounded-xl">
                <button
                onClick={() => setMode('UPLOAD')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    mode === 'UPLOAD' 
                    ? 'bg-white shadow text-indigo-600' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                }`}
                >
                <Image size={16} />
                Dùng ảnh nền
                </button>
                <button
                onClick={() => setMode('PROMPT')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 ${
                    mode === 'PROMPT' 
                    ? 'bg-white shadow text-indigo-600' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                }`}
                >
                <Type size={16} />
                Mô tả AI
                </button>
            </div>

            {/* Option A: Custom Background Image */}
            {mode === 'UPLOAD' && (
                <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-xs text-indigo-800 mb-2">
                    <strong>Chế độ:</strong> Sử dụng ảnh nền có sẵn của bạn. AI sẽ ghép người mẫu vào ảnh này.
                </div>
                <ImageUploader
                    id="bg-upload"
                    label="Tải ảnh nền"
                    subLabel="Tải ảnh phong cảnh, studio..."
                    image={state.backgroundImage}
                    onImageChange={(img) => setState(prev => ({ ...prev, backgroundImage: img }))}
                />
                </div>
            )}

            {/* Option B: Text Prompt & Suggestions */}
            {mode === 'PROMPT' && (
                <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 text-xs text-indigo-800 mb-2">
                    <strong>Chế độ:</strong> AI sẽ vẽ bối cảnh dựa trên mô tả của bạn.
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-gray-700">Mô tả bối cảnh</span>
                    <button 
                        onClick={handleSuggest}
                        disabled={state.isSuggesting}
                        className="text-xs flex items-center gap-1 text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg hover:bg-indigo-100 transition-colors"
                    >
                        {state.isSuggesting ? <Loader2 size={12} className="animate-spin" /> : <Lightbulb size={12} />}
                        Gợi ý cho tôi
                    </button>
                </div>

                {state.aiSuggestions.length > 0 && (
                    <div className="flex flex-wrap gap-2 animate-in fade-in">
                    {state.aiSuggestions.map((sugg, idx) => (
                        <button
                        key={idx}
                        onClick={() => setState(prev => ({ ...prev, textPrompt: sugg }))}
                        className="text-xs bg-purple-50 text-purple-700 border border-purple-100 px-3 py-1.5 rounded-full hover:bg-purple-100 transition-colors text-left"
                        >
                        {sugg}
                        </button>
                    ))}
                    </div>
                )}

                <textarea
                    value={state.textPrompt}
                    onChange={(e) => setState(prev => ({ ...prev, textPrompt: e.target.value }))}
                    placeholder="Ví dụ: Đứng giữa cánh đồng hoa hướng dương, ánh nắng rực rỡ..."
                    className="w-full p-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm h-24 resize-none"
                />
                </div>
            )}

            {state.error && (
                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-red-600" />
                {state.error}
                </div>
            )}

            <button
                onClick={() => handleGenerate(false)}
                disabled={state.isGenerating || (mode === 'UPLOAD' && !state.backgroundImage) || (mode === 'PROMPT' && !state.textPrompt)}
                className={`
                w-full py-3.5 px-6 rounded-xl font-bold text-white shadow-lg
                flex items-center justify-center gap-2 transition-all
                ${state.isGenerating || (mode === 'UPLOAD' && !state.backgroundImage) || (mode === 'PROMPT' && !state.textPrompt)
                    ? 'bg-gray-400 cursor-not-allowed' 
                    : 'bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98]'}
                `}
            >
                {state.isGenerating && state.results.length === 0 ? (
                <>
                    <Loader2 className="animate-spin" size={20} />
                    <span>Đang xử lý (20s)...</span>
                </>
                ) : (
                <>
                    <Sparkles size={20} />
                    <span>{mode === 'UPLOAD' ? 'Ghép vào nền này' : 'Tạo bối cảnh mới'}</span>
                </>
                )}
            </button>
            </div>

            {/* Right Column: Result */}
            <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200 flex flex-col min-h-[500px]">
            {state.results.length > 0 && currentItem ? (
                <div className="w-full flex flex-col gap-4 animate-in zoom-in-95 duration-300 h-full">
                
                {/* Main Image View */}
                <div className="relative w-full aspect-[9/16] rounded-xl overflow-hidden shadow-lg bg-gray-900 group">
                    <img 
                        src={`data:image/png;base64,${currentItem.base64}`} 
                        className="w-full h-full object-contain"
                        alt="Final Result"
                    />
                </div>

                {/* Thumbnails */}
                {state.results.length > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                        {state.results.map((res, idx) => (
                            <button
                            key={idx}
                            onClick={() => setSelectedIndex(idx)}
                            className={`relative flex-shrink-0 w-14 h-20 rounded-md overflow-hidden border-2 transition-all ${
                                idx === selectedIndex ? 'border-indigo-600 ring-2 ring-indigo-100' : 'border-transparent opacity-60 hover:opacity-100'
                            }`}
                            >
                            <img 
                                src={`data:image/png;base64,${res.base64}`} 
                                className="w-full h-full object-cover" 
                                alt={`Thumb ${idx}`}
                            />
                            {idx === selectedIndex && (
                                <div className="absolute inset-0 bg-indigo-900/10 flex items-center justify-center">
                                <Check size={12} className="text-white drop-shadow-md" />
                                </div>
                            )}
                            </button>
                        ))}
                    </div>
                )}

                {/* Video Prompt Generator Result - Specific to the selected image */}
                <div className="bg-white rounded-xl border border-indigo-100 p-4 shadow-sm animate-in slide-in-from-bottom-4 transition-all">
                    <div className="flex items-center gap-2 text-sm font-bold text-gray-800 mb-3">
                        <div className="bg-gradient-to-r from-pink-500 to-orange-500 text-white p-1 rounded-md">
                            <Video size={14} />
                        </div>
                        Prompt Video (Cho ảnh hiện tại)
                    </div>
                    
                    {currentItem.isVideoPromptLoading ? (
                        <div className="flex items-center gap-2 text-xs text-gray-500 py-2">
                            <Loader2 size={14} className="animate-spin text-indigo-600" />
                            Đang phân tích ảnh để viết 3 prompt...
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {currentItem.videoPrompts && currentItem.videoPrompts.length > 0 ? (
                                currentItem.videoPrompts.map((prompt, idx) => (
                                    <div key={idx} className="relative group">
                                        <div className="text-[10px] uppercase font-bold text-gray-400 mb-1 ml-1">
                                            {PROMPT_LABELS[idx] || `Lựa chọn ${idx + 1}`}
                                        </div>
                                        <div className="relative">
                                            <textarea 
                                                readOnly
                                                value={prompt}
                                                className="w-full h-20 text-xs p-3 pr-10 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 resize-none focus:outline-none focus:border-indigo-300"
                                            />
                                            <button 
                                                onClick={() => copyToClipboard(prompt, idx)}
                                                className="absolute top-2 right-2 p-1.5 bg-white border border-gray-200 rounded-md shadow-sm hover:bg-gray-50 transition-colors text-gray-600"
                                                title="Sao chép"
                                            >
                                                {copiedIndex === idx ? <CheckCheck size={14} className="text-green-600" /> : <Copy size={14} />}
                                            </button>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-xs text-red-500">Không có prompt nào được tạo.</div>
                            )}
                        </div>
                    )}
                </div>

                {/* Actions Grid */}
                <div className="grid grid-cols-2 gap-3 mt-auto">
                    <button 
                        onClick={() => handleGenerate(true)}
                        disabled={state.isGenerating}
                        className={`
                        flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-all active:scale-[0.98]
                        ${state.isGenerating ? 'opacity-70 cursor-wait' : ''}
                        `}
                    >
                        {state.isGenerating ? (
                        <RefreshCw size={20} className="animate-spin" />
                        ) : (
                        <Plus size={20} />
                        )}
                        {state.isGenerating ? 'Đang tạo...' : 'Tạo thêm'}
                    </button>

                    <button 
                        onClick={handleDownload}
                        className="flex items-center justify-center gap-2 bg-green-600 text-white py-3 px-4 rounded-xl font-semibold hover:bg-green-700 transition-colors shadow-md active:scale-[0.98]"
                    >
                        <Download size={20} />
                        Tải về
                    </button>
                </div>
                </div>
            ) : (
                <div className="text-center text-gray-400 flex flex-col items-center justify-center flex-grow h-full">
                <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-4">
                    <Sparkles size={32} className="text-gray-400" />
                </div>
                <p className="font-medium">Kết quả sẽ hiện ở đây</p>
                <p className="text-sm mt-1">Chọn bối cảnh và nhấn tạo</p>
                </div>
            )}
            </div>
        </div>
      )}
    </div>
  );
};