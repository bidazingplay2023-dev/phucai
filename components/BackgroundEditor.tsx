import React, { useState, useEffect, useRef } from 'react';
import { ProcessedImage, BackgroundState, GeneratedBackground } from '../types';
import { suggestBackgrounds, changeBackground, generateVideoPrompt, generateSpeech } from '../services/geminiService';
import { saveToDB, loadFromDB, KEYS, reconstructProcessedImage, prepareImageForStorage } from '../services/storage';
import { ImageUploader } from './ImageUploader';
import { Sparkles, Lightbulb, Loader2, Download, Plus, Check, RefreshCw, Image, Type, Upload, Video, Copy, MonitorPlay, Mic, ChevronDown, ChevronRight, Play } from 'lucide-react';

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

  const [mode, setMode] = useState<'UPLOAD' | 'PROMPT' | 'KEEP'>('UPLOAD');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const [isLoadingStorage, setIsLoadingStorage] = useState(true);
  
  // Accordion state: 'video' | 'voiceover' | null
  const [openSection, setOpenSection] = useState<string | null>('video');

  // TTS State
  const [selectedVoice, setSelectedVoice] = useState('Kore');
  const VOICES = ['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr'];

  // 1. Sync prop to state if it changes (Priority over local storage if explicit navigation)
  useEffect(() => {
    // Nếu initialBaseImage là null (do bấm Reset ở App.tsx), ta cần xoá sạch state
    if (initialBaseImage === null) {
        setState({
            selectedBaseImage: null,
            backgroundImage: null,
            textPrompt: '',
            aiSuggestions: [],
            isSuggesting: false,
            isGenerating: false,
            results: [],
            error: null,
        });
        setMode('UPLOAD');
    } 
    // Nếu có ảnh mới được chuyển từ Bước 1 sang
    else if (initialBaseImage && initialBaseImage !== state.selectedBaseImage) {
      setState(prev => ({ 
        ...prev, 
        selectedBaseImage: initialBaseImage,
        results: [], // Reset kết quả cũ nếu đổi ảnh gốc
        error: null
      }));
    }
  }, [initialBaseImage]);

  // 2. Restore from DB on mount
  useEffect(() => {
    const restore = async () => {
        try {
            const saved = await loadFromDB(KEYS.BG_EDITOR_SESSION);
            if (saved) {
                // If initialBaseImage is provided (user came from Step 1 just now), use it.
                // Otherwise use saved image.
                const baseImg = initialBaseImage || saved.selectedBaseImage;
                
                setState(prev => ({
                    ...prev,
                    selectedBaseImage: baseImg,
                    textPrompt: saved.textPrompt || '',
                    results: saved.results || [],
                    backgroundImage: reconstructProcessedImage(saved.backgroundImage)
                }));
                if (saved.mode) setMode(saved.mode);
            }
        } catch (e) {
            console.error("BG Editor Restore Error", e);
        } finally {
            setIsLoadingStorage(false);
        }
    };
    restore();
  }, []); // Run once

  // 3. Auto-Save Logic
  const saveTimeoutRef = useRef<any>(null);
  useEffect(() => {
    if (isLoadingStorage) return;

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
        const dataToSave = {
            selectedBaseImage: state.selectedBaseImage,
            textPrompt: state.textPrompt,
            results: state.results, // Contains large base64s
            backgroundImage: prepareImageForStorage(state.backgroundImage),
            mode: mode,
            timestamp: Date.now()
        };
        saveToDB(KEYS.BG_EDITOR_SESSION, dataToSave);
    }, 1000);
    
    return () => clearTimeout(saveTimeoutRef.current);
  }, [state.selectedBaseImage, state.textPrompt, state.results, state.backgroundImage, mode, isLoadingStorage]);


  // Reset selected index when new results come in (usually prepended to top)
  useEffect(() => {
    if (state.results.length > 0) {
        setSelectedIndex(0);
        setOpenSection('video'); // Default open first section on new result
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
      let resultBase64 = '';

      // LOGIC BRANCH: If KEEP, use original image. Else, call AI to change background.
      if (mode === 'KEEP') {
         resultBase64 = state.selectedBaseImage;
         // Small delay to simulate processing so user sees the loading state momentarily
         await new Promise(resolve => setTimeout(resolve, 800));
      } else {
         const bgImageParam = mode === 'UPLOAD' ? state.backgroundImage : null;
         const promptParam = mode === 'PROMPT' ? state.textPrompt : '';
         resultBase64 = await changeBackground(state.selectedBaseImage, promptParam, bgImageParam);
      }
      
      // Create a new result object with loading state for prompts
      const newResultItem: GeneratedBackground = {
          base64: resultBase64,
          videoPrompts: [],
          voiceoverScripts: [],
          isVideoPromptLoading: true,
          generatedAudios: {},
          isAudioLoading: {}
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
        const contentResult = await generateVideoPrompt(resultBase64);
        
        // Update the specific item in the results array
        setState(prev => {
            const updatedResults = prev.results.map(item => {
                // Find the item by matching base64
                if (item === newResultItem) {
                    return { 
                      ...item, 
                      videoPrompts: contentResult.videoPrompts, 
                      voiceoverScripts: contentResult.voiceoverScripts,
                      isVideoPromptLoading: false 
                    };
                }
                return item;
            });
            return { ...prev, results: updatedResults };
        });
      } catch (videoErr) {
        console.error("Video prompt failed", videoErr);
        setState(prev => {
            const updatedResults = prev.results.map(item => {
                if (item === newResultItem) {
                    return { ...item, videoPrompts: ["Lỗi tạo nội dung."], voiceoverScripts: [], isVideoPromptLoading: false };
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

  const handleGenerateAudio = async (scriptIndex: number, text: string) => {
    // Set Loading State for this script
    setState(prev => {
      const updatedResults = [...prev.results];
      const current = updatedResults[selectedIndex];
      if (current) {
        current.isAudioLoading = { ...current.isAudioLoading, [scriptIndex]: true };
      }
      return { ...prev, results: updatedResults };
    });

    try {
      const audioBase64 = await generateSpeech(text, selectedVoice);

      // Update Audio Data
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
       alert("Lỗi khi tạo audio: " + error);
       // Reset loading
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

  const handleDownloadAudio = (base64Audio: string) => {
    const link = document.createElement('a');
    link.href = `data:audio/wav;base64,${base64Audio}`;
    link.download = `voiceover-${selectedVoice}-${Date.now()}.wav`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(id);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  const handleBaseImageUpload = (img: ProcessedImage | null) => {
    setState(prev => ({ 
      ...prev, 
      selectedBaseImage: img ? img.base64 : null,
      results: [],
      error: null
    }));
  };

  const PROMPT_LABELS = [
      "Mirror Selfie", 
      "Outfit Check", 
      "Gen Z Pose",
      "Walking/Spinning",
      "Playful"
  ];

  // Helper object to pass to ImageUploader
  const currentBaseImageObj = state.selectedBaseImage ? {
      base64: state.selectedBaseImage,
      previewUrl: `data:image/png;base64,${state.selectedBaseImage}`,
      file: new File([], "base_image.png") // Dummy file object for type satisfaction
  } : null;

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
            
            {/* Base Image Preview with CLICKABLE Change Option */}
            <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm">
                <ImageUploader 
                    id="step2-base-image-display"
                    label="Ảnh gốc (Bấm vào ảnh để thay đổi)"
                    subLabel="Chọn ảnh khác"
                    image={currentBaseImageObj}
                    onImageChange={handleBaseImageUpload}
                />
            </div>

            {/* Mode Selection Tabs */}
            <div className="flex p-1 bg-gray-100 rounded-xl">
                <button
                onClick={() => setMode('UPLOAD')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs md:text-sm font-semibold transition-all duration-200 ${
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
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs md:text-sm font-semibold transition-all duration-200 ${
                    mode === 'PROMPT' 
                    ? 'bg-white shadow text-indigo-600' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                }`}
                >
                <Type size={16} />
                Mô tả AI
                </button>
                <button
                onClick={() => setMode('KEEP')}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs md:text-sm font-semibold transition-all duration-200 ${
                    mode === 'KEEP' 
                    ? 'bg-white shadow text-indigo-600' 
                    : 'text-gray-500 hover:text-gray-700 hover:bg-gray-200/50'
                }`}
                >
                <MonitorPlay size={16} />
                Giữ nguyên
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

             {/* Option C: Keep Original (New) */}
             {mode === 'KEEP' && (
                <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-indigo-100 rounded-lg p-4 text-sm text-indigo-800 mb-2 flex gap-3">
                         <div className="bg-white p-2 rounded-full h-fit shadow-sm text-indigo-600">
                            <MonitorPlay size={20} />
                         </div>
                         <div>
                            <strong className="block mb-1">Chế độ tạo Prompt Video</strong>
                            <p className="text-xs opacity-90 leading-relaxed">
                                Hệ thống sẽ giữ nguyên ảnh hiện tại và chỉ tập trung phân tích để viết kịch bản Video & Lời thoại bán hàng.
                            </p>
                         </div>
                    </div>
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
                    <span>Đang xử lý...</span>
                </>
                ) : (
                <>
                    {mode === 'KEEP' ? <Video size={20} /> : <Sparkles size={20} />}
                    <span>
                        {mode === 'UPLOAD' ? 'Ghép vào nền này' : mode === 'PROMPT' ? 'Tạo bối cảnh mới' : 'Tạo Prompt Video ngay'}
                    </span>
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

                {/* Content Generation Result - ACCORDION STYLE */}
                <div className="bg-white rounded-xl border border-indigo-100 shadow-sm overflow-hidden animate-in slide-in-from-bottom-4 transition-all">
                    
                    {currentItem.isVideoPromptLoading ? (
                        <div className="p-4 flex flex-col items-center justify-center gap-3 py-8 text-gray-500">
                            <Loader2 size={24} className="animate-spin text-indigo-600" />
                            <p className="text-sm">Đang phân tích hình ảnh và viết kịch bản...</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                             {/* Accordion 1: Video Prompts */}
                             <div>
                                <button 
                                    onClick={() => setOpenSection(openSection === 'video' ? null : 'video')}
                                    className={`w-full flex items-center justify-between p-3.5 text-sm font-bold text-gray-800 hover:bg-gray-50 transition-colors ${openSection === 'video' ? 'bg-gray-50' : ''}`}
                                >
                                    <div className="flex items-center gap-2">
                                        <div className="bg-gradient-to-r from-pink-500 to-orange-500 text-white p-1 rounded-md">
                                            <Video size={14} />
                                        </div>
                                        Kịch bản Video (Prompt Video)
                                    </div>
                                    {openSection === 'video' ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                </button>
                                
                                {openSection === 'video' && (
                                    <div className="p-3 bg-gray-50/50 space-y-2 animate-in slide-in-from-top-2 duration-200">
                                        {currentItem.videoPrompts && currentItem.videoPrompts.length > 0 ? (
                                            currentItem.videoPrompts.map((prompt, idx) => {
                                                const promptId = `vid-${idx}`;
                                                const isCopied = copiedIndex === promptId;
                                                return (
                                                <div key={idx} className="flex items-center justify-between p-2.5 bg-white border border-gray-200 rounded-lg shadow-sm gap-3 group hover:border-indigo-200 transition-all">
                                                    <div className="flex items-center gap-2 overflow-hidden flex-1" title={prompt}>
                                                        <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 bg-gray-100 px-2 py-1 rounded-md min-w-fit">
                                                            {PROMPT_LABELS[idx] || `OPT ${idx + 1}`}
                                                        </div>
                                                        <div className="text-xs text-gray-600 truncate flex-1 select-all cursor-text">
                                                            {prompt}
                                                        </div>
                                                    </div>
                                                    
                                                    <button 
                                                        onClick={() => copyToClipboard(prompt, promptId)}
                                                        className={`p-1.5 rounded-md transition-all shrink-0 flex items-center justify-center gap-1 ${
                                                            isCopied 
                                                            ? 'bg-green-500 text-white shadow-md' 
                                                            : 'bg-gray-100 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50'
                                                        }`}
                                                        title="Sao chép"
                                                    >
                                                        {isCopied ? <Check size={14} strokeWidth={3} /> : <Copy size={14} />}
                                                    </button>
                                                </div>
                                            )})
                                        ) : (
                                            <div className="text-xs text-red-500 p-2">Không có prompt nào được tạo.</div>
                                        )}
                                    </div>
                                )}
                             </div>

                             {/* Accordion 2: Voiceover Scripts & Audio Gen */}
                             <div>
                                <button 
                                    onClick={() => setOpenSection(openSection === 'voiceover' ? null : 'voiceover')}
                                    className={`w-full flex items-center justify-between p-3.5 text-sm font-bold text-gray-800 hover:bg-gray-50 transition-colors ${openSection === 'voiceover' ? 'bg-gray-50' : ''}`}
                                >
                                    <div className="flex items-center gap-2">
                                        <div className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white p-1 rounded-md">
                                            <Mic size={14} />
                                        </div>
                                        Lời thoại & Thu âm (TTS)
                                    </div>
                                    {openSection === 'voiceover' ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                </button>
                                
                                {openSection === 'voiceover' && (
                                    <div className="p-3 bg-gray-50/50 space-y-4 animate-in slide-in-from-top-2 duration-200">
                                        
                                        {/* Voice Selector */}
                                        <div className="flex items-center justify-between bg-white p-2 rounded-lg border border-gray-200 shadow-sm">
                                            <label className="text-xs font-semibold text-gray-600 ml-1">Chọn giọng đọc AI:</label>
                                            <select 
                                                value={selectedVoice} 
                                                onChange={(e) => setSelectedVoice(e.target.value)}
                                                className="text-xs border-none bg-indigo-50 text-indigo-700 font-bold rounded px-2 py-1 focus:ring-0 cursor-pointer hover:bg-indigo-100 transition-colors"
                                            >
                                                {VOICES.map(v => <option key={v} value={v}>{v}</option>)}
                                            </select>
                                        </div>

                                        {currentItem.voiceoverScripts && currentItem.voiceoverScripts.length > 0 ? (
                                            currentItem.voiceoverScripts.map((script, idx) => {
                                                const scriptId = `voice-${idx}`;
                                                const isCopied = copiedIndex === scriptId;
                                                const isAudioLoading = currentItem.isAudioLoading?.[idx];
                                                const audioData = currentItem.generatedAudios?.[idx];

                                                return (
                                                <div key={idx} className="flex flex-col p-3 bg-white border border-gray-200 rounded-lg shadow-sm gap-3 group hover:border-indigo-200 transition-all">
                                                    {/* Header: Option label + Copy */}
                                                    <div className="flex justify-between items-center gap-2">
                                                        <span className="text-[10px] font-bold uppercase tracking-wider text-white bg-indigo-400 px-2 py-0.5 rounded-md">
                                                            Kịch bản {idx + 1}
                                                        </span>
                                                        <button 
                                                            onClick={() => copyToClipboard(script, scriptId)}
                                                            className={`p-1.5 rounded-md transition-all shrink-0 flex items-center justify-center gap-1 ${
                                                                isCopied 
                                                                ? 'bg-green-500 text-white shadow-md' 
                                                                : 'bg-gray-100 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50'
                                                            }`}
                                                            title="Sao chép văn bản"
                                                        >
                                                            {isCopied ? <Check size={14} strokeWidth={3} /> : <Copy size={14} />}
                                                        </button>
                                                    </div>
                                                    
                                                    {/* Script Content */}
                                                    <div className="text-xs text-gray-700 leading-relaxed italic select-all cursor-text bg-gray-50 p-2 rounded border border-gray-100">
                                                        "{script}"
                                                    </div>

                                                    {/* Audio Controls */}
                                                    <div className="pt-2 border-t border-gray-100 flex items-center gap-2">
                                                        {!audioData ? (
                                                            <button 
                                                                onClick={() => handleGenerateAudio(idx, script)}
                                                                disabled={isAudioLoading}
                                                                className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-md transition-all ${
                                                                    isAudioLoading 
                                                                    ? 'bg-gray-100 text-gray-400' 
                                                                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                                                }`}
                                                            >
                                                                {isAudioLoading ? (
                                                                    <Loader2 size={12} className="animate-spin" />
                                                                ) : (
                                                                    <Play size={12} fill="currentColor" />
                                                                )}
                                                                {isAudioLoading ? 'Đang tạo audio...' : 'Tạo Audio'}
                                                            </button>
                                                        ) : (
                                                            <div className="flex-1 flex flex-col gap-2">
                                                                <audio controls src={`data:audio/wav;base64,${audioData}`} className="w-full h-8" />
                                                                <button
                                                                    onClick={() => handleDownloadAudio(audioData)}
                                                                    className="flex items-center justify-center gap-1.5 w-full py-1.5 text-xs font-semibold bg-green-50 text-green-700 hover:bg-green-100 rounded-md transition-colors"
                                                                >
                                                                    <Download size={12} /> Tải Audio ({selectedVoice})
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )})
                                        ) : (
                                            <div className="text-xs text-red-500 p-2">Không có lời thoại nào được tạo.</div>
                                        )}
                                    </div>
                                )}
                             </div>
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
                        Tải ảnh
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