
import React, { useState, useEffect, useRef } from 'react';
import { ProcessedImage, BackgroundState, GeneratedBackground } from '../types';
import { suggestBackgrounds, changeBackground, generateVideoPrompt, generateEveraiSpeech } from '../services/geminiService';
import { saveToDB, loadFromDB, KEYS, reconstructProcessedImage, prepareImageForStorage } from '../services/storage';
import { ImageUploader } from './ImageUploader';
import { ImagePreviewModal } from './ImagePreviewModal';
import { Sparkles, Lightbulb, Loader2, Download, Plus, Check, RefreshCw, Image, Type, Upload, Video, Copy, MonitorPlay, Mic, ChevronDown, ChevronRight, Play, FileText, Maximize2, CheckCircle2, ChevronUp } from 'lucide-react';

interface BackgroundEditorProps {
  initialBaseImage: string | null;
}

type EditorMode = 'UPLOAD' | 'PROMPT' | 'KEEP';

export const BackgroundEditor: React.FC<BackgroundEditorProps> = ({ initialBaseImage }) => {
  const [state, setState] = useState<BackgroundState>({
    selectedBaseImage: initialBaseImage,
    backgroundImage: null,
    textPrompt: '',
    aiSuggestions: [],
    isSuggesting: false,
    isGenerating: false,
    resultsUpload: [],
    resultsPrompt: [],
    resultsKeep: [],
    error: null,
  });

  const [mode, setMode] = useState<EditorMode>('UPLOAD');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);
  const [isLoadingStorage, setIsLoadingStorage] = useState(true);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null); // For local preview
  
  const [openSection, setOpenSection] = useState<string | null>('video');

  // Accordion State
  const [step1Open, setStep1Open] = useState(true);
  const [step2Open, setStep2Open] = useState(false);

  const getCurrentResults = (): GeneratedBackground[] => {
    switch (mode) {
        case 'UPLOAD': return state.resultsUpload;
        case 'PROMPT': return state.resultsPrompt;
        case 'KEEP': return state.resultsKeep;
        default: return [];
    }
  };

  const getCurrentResultKey = (targetMode: EditorMode = mode): keyof BackgroundState => {
      switch (targetMode) {
          case 'UPLOAD': return 'resultsUpload';
          case 'PROMPT': return 'resultsPrompt';
          case 'KEEP': return 'resultsKeep';
          default: return 'resultsUpload';
      }
  };

  useEffect(() => {
    if (initialBaseImage === null) {
        setState({
            selectedBaseImage: null,
            backgroundImage: null,
            textPrompt: '',
            aiSuggestions: [],
            isSuggesting: false,
            isGenerating: false,
            resultsUpload: [],
            resultsPrompt: [],
            resultsKeep: [],
            error: null,
        });
        setMode('UPLOAD');
        setStep1Open(true);
        setStep2Open(false);
    } 
    else if (initialBaseImage && initialBaseImage !== state.selectedBaseImage) {
      setState(prev => ({ 
        ...prev, 
        selectedBaseImage: initialBaseImage,
        resultsUpload: [],
        resultsPrompt: [],
        resultsKeep: [],
        error: null
      }));
      // Auto accordion logic handled in next effect
    }
  }, [initialBaseImage]);

  // Auto-Accordion Logic when Image Changes
  useEffect(() => {
     if (state.selectedBaseImage) {
         setStep1Open(false);
         setStep2Open(true);
     } else {
         setStep1Open(true);
         setStep2Open(false);
     }
  }, [state.selectedBaseImage]);

  useEffect(() => {
    const restore = async () => {
        try {
            const saved = await loadFromDB(KEYS.BG_EDITOR_SESSION);
            if (saved) {
                const baseImg = initialBaseImage || saved.selectedBaseImage;
                
                setState(prev => ({
                    ...prev,
                    selectedBaseImage: baseImg,
                    textPrompt: saved.textPrompt || '',
                    resultsUpload: saved.resultsUpload || [],
                    resultsPrompt: saved.resultsPrompt || [],
                    resultsKeep: saved.resultsKeep || [],
                    backgroundImage: reconstructProcessedImage(saved.backgroundImage)
                }));
                if (saved.mode) setMode(saved.mode);
                
                // Set initial accordion state based on restored data
                if (baseImg) {
                    setStep1Open(false);
                    setStep2Open(true);
                }
            }
        } catch (e) {
            console.error("BG Editor Restore Error", e);
        } finally {
            setIsLoadingStorage(false);
        }
    };
    restore();
  }, []); 

  const saveTimeoutRef = useRef<any>(null);
  useEffect(() => {
    if (isLoadingStorage) return;

    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    saveTimeoutRef.current = setTimeout(() => {
        const dataToSave = {
            selectedBaseImage: state.selectedBaseImage,
            textPrompt: state.textPrompt,
            resultsUpload: state.resultsUpload,
            resultsPrompt: state.resultsPrompt,
            resultsKeep: state.resultsKeep,
            backgroundImage: prepareImageForStorage(state.backgroundImage),
            mode: mode,
            timestamp: Date.now()
        };
        saveToDB(KEYS.BG_EDITOR_SESSION, dataToSave);
    }, 1000);
    
    return () => clearTimeout(saveTimeoutRef.current);
  }, [state, mode, isLoadingStorage]);

  useEffect(() => {
    setSelectedIndex(0);
    setOpenSection('video');
  }, [mode]);

  const currentResultsLength = getCurrentResults().length;
  useEffect(() => {
    if (currentResultsLength > 0) {
        setSelectedIndex(0);
        setOpenSection('video'); 
    }
  }, [currentResultsLength]);

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

    const executionMode = mode;
    const targetKey = getCurrentResultKey(executionMode);

    setState(prev => ({ ...prev, isGenerating: true, error: null }));
    
    try {
      let resultBase64 = '';

      if (executionMode === 'KEEP') {
         resultBase64 = state.selectedBaseImage;
         await new Promise(resolve => setTimeout(resolve, 500));
      } else {
         const bgImageParam = executionMode === 'UPLOAD' ? state.backgroundImage : null;
         const promptParam = executionMode === 'PROMPT' ? state.textPrompt : '';
         resultBase64 = await changeBackground(state.selectedBaseImage, promptParam, bgImageParam);
      }
      
      const newResultItem: GeneratedBackground = {
          base64: resultBase64,
          videoPrompts: [],
          voiceoverScripts: [],
          isVideoPromptLoading: false,
          generatedAudios: {},
          audioMimeTypes: {},
          isAudioLoading: {}
      };

      setState(prev => {
          const currentList = prev[targetKey] as GeneratedBackground[];
          const updatedList = isRegenerate ? [newResultItem, ...currentList] : [newResultItem];
          
          return { 
            ...prev, 
            isGenerating: false, 
            [targetKey]: updatedList
          };
      });

    } catch (err: any) {
      setState(prev => ({ ...prev, isGenerating: false, error: err.message }));
    }
  };

  const handleAnalyzeContent = async (index: number) => {
    const currentList = getCurrentResults();
    const item = currentList[index];
    const targetKey = getCurrentResultKey();

    if (!item) return;

    setState(prev => {
        const list = [...(prev[targetKey] as GeneratedBackground[])];
        list[index] = { ...list[index], isVideoPromptLoading: true };
        return { ...prev, [targetKey]: list };
    });

    try {
        const contentResult = await generateVideoPrompt(item.base64);
        
        setState(prev => {
            const list = [...(prev[targetKey] as GeneratedBackground[])];
            list[index] = { 
                ...list[index], 
                videoPrompts: contentResult.videoPrompts, 
                voiceoverScripts: contentResult.voiceoverScripts,
                isVideoPromptLoading: false 
            };
            return { ...prev, [targetKey]: list };
        });
        setOpenSection('video');
    } catch (videoErr) {
        console.error("Video prompt failed", videoErr);
        setState(prev => {
            const list = [...(prev[targetKey] as GeneratedBackground[])];
            list[index] = { 
                ...list[index], 
                videoPrompts: ["Lỗi tạo nội dung. Vui lòng thử lại."], 
                voiceoverScripts: [], 
                isVideoPromptLoading: false 
            };
            return { ...prev, [targetKey]: list };
        });
    }
  };

  const handleScriptChange = (scriptIndex: number, newText: string) => {
    const targetKey = getCurrentResultKey();
    
    setState(prev => {
        const list = [...(prev[targetKey] as GeneratedBackground[])];
        const currentItem = { ...list[selectedIndex] };
        
        if (currentItem && currentItem.voiceoverScripts) {
             const newScripts = [...currentItem.voiceoverScripts];
             newScripts[scriptIndex] = newText;
             currentItem.voiceoverScripts = newScripts;
             list[selectedIndex] = currentItem;
        }
        return { ...prev, [targetKey]: list };
    });
  };

  const handleGenerateAudio = async (scriptIndex: number, text: string) => {
    const targetKey = getCurrentResultKey();

    setState(prev => {
      const list = [...(prev[targetKey] as GeneratedBackground[])];
      const currentItem = { ...list[selectedIndex] };
      if (currentItem) {
         currentItem.isAudioLoading = { ...currentItem.isAudioLoading, [scriptIndex]: true };
         list[selectedIndex] = currentItem;
      }
      return { ...prev, [targetKey]: list };
    });

    try {
      const audioUrl = await generateEveraiSpeech(text);
      
      setState(prev => {
        const list = [...(prev[targetKey] as GeneratedBackground[])];
        const currentItem = { ...list[selectedIndex] };
        if (currentItem) {
          currentItem.generatedAudios = { ...currentItem.generatedAudios, [scriptIndex]: audioUrl };
          currentItem.isAudioLoading = { ...currentItem.isAudioLoading, [scriptIndex]: false };
          list[selectedIndex] = currentItem;
        }
        return { ...prev, [targetKey]: list };
      });
      
    } catch (error: any) {
       console.error("Audio Gen Error", error);
       alert(`Lỗi tạo giọng đọc (Everai): ${error.message}`);
       
       setState(prev => {
        const list = [...(prev[targetKey] as GeneratedBackground[])];
        const currentItem = { ...list[selectedIndex] };
        if (currentItem) {
          currentItem.isAudioLoading = { ...currentItem.isAudioLoading, [scriptIndex]: false };
          list[selectedIndex] = currentItem;
        }
        return { ...prev, [targetKey]: list };
      });
    }
  };

  const handleDownload = () => {
    const currentList = getCurrentResults();
    if (currentList.length === 0) return;
    const currentResult = currentList[selectedIndex];
    
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${currentResult.base64}`;
    link.download = `ai-bg-change-${Date.now()}.png`;
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
      resultsUpload: [],
      resultsPrompt: [],
      resultsKeep: [],
      error: null
    }));
    // Note: useEffect will handle accordion state
  };

  const PROMPT_LABELS = [
      "Full Fit Reveal (Toàn thân)", 
      "Side Profile (Góc nghiêng)", 
      "Gentle Sway (Lắc lư nhẹ)",
      "Subtle Pose (Tạo dáng nhẹ)",
      "Static Confidence (Thần thái)"
  ];

  const VOICEOVER_LABELS = [
      "Style Kể chuyện (Storytelling)",
      "Style Săn Deal (FOMO)"
  ];

  const currentBaseImageObj = state.selectedBaseImage ? {
      base64: state.selectedBaseImage,
      previewUrl: `data:image/png;base64,${state.selectedBaseImage}`,
      file: new File([], "base_image.png")
  } : null;

  const activeList = getCurrentResults();
  const currentItem = activeList[selectedIndex];
  const hasContent = currentItem?.videoPrompts && currentItem.videoPrompts.length > 0;
  const currentImageUrl = currentItem ? `data:image/png;base64,${currentItem.base64}` : null;

  const handlePreview = (url: string) => {
      setPreviewUrl(url);
      setIsPreviewOpen(true);
  };

  return (
    <div className="animate-in fade-in duration-500 pb-10">
      
      {!state.selectedBaseImage && mode === 'UPLOAD' && state.resultsUpload.length === 0 && !state.selectedBaseImage ? (
          /* EMPTY STATE - INITIAL */
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 flex flex-col items-center justify-center min-h-[400px] text-center max-w-2xl mx-auto">
              <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-6">
                  <Upload size={36} />
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">Tải ảnh mẫu cần đổi nền</h3>
              <p className="text-gray-500 mb-8 max-w-sm mx-auto">
                  Bạn có thể dùng kết quả từ bước "Mặc thử" hoặc tải ảnh trực tiếp từ máy lên đây.
              </p>
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
        /* 2-COLUMN LAYOUT START */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
            
            {/* LEFT COLUMN: CONTROLS (35%) */}
            <div className="lg:col-span-4 space-y-5">
                
                {/* STEP 1: BASE IMAGE - ACCORDION */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300">
                    {/* Header */}
                    <div 
                        onClick={() => setStep1Open(!step1Open)}
                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors select-none"
                    >
                         <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">1</div>
                            <div>
                                <h3 className="font-bold text-gray-800">Ảnh gốc</h3>
                                {!step1Open && state.selectedBaseImage && (
                                    <div className="flex items-center gap-1.5 mt-0.5 animate-in fade-in">
                                        <CheckCircle2 size={12} className="text-green-600" />
                                        <span className="text-xs text-green-700 font-medium">Đã chọn</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            {!step1Open && state.selectedBaseImage && (
                                <div 
                                    className="w-10 h-10 bg-white rounded border border-gray-200 p-0.5 animate-in zoom-in hover:border-indigo-300 transition-colors cursor-pointer"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handlePreview(`data:image/png;base64,${state.selectedBaseImage}`);
                                    }}
                                >
                                    <img src={`data:image/png;base64,${state.selectedBaseImage}`} className="w-full h-full object-contain" alt="Mini Base" />
                                </div>
                            )}
                            {step1Open ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
                        </div>
                    </div>

                    {/* Body */}
                    {step1Open && (
                         <div className="p-5 border-t border-gray-100 animate-in slide-in-from-top-1 duration-200">
                            <ImageUploader 
                                id="step2-base-image-display"
                                label=""
                                subLabel="Chọn ảnh khác"
                                image={currentBaseImageObj}
                                onImageChange={handleBaseImageUpload}
                            />
                        </div>
                    )}
                </div>

                {/* STEP 2: MODE & GENERATE - ACCORDION */}
                <div className={`bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden transition-all duration-300 ${!state.selectedBaseImage ? 'opacity-60 pointer-events-none' : 'opacity-100'}`}>
                    {/* Header */}
                    <div 
                        onClick={() => state.selectedBaseImage && setStep2Open(!step2Open)}
                        className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50 transition-colors select-none"
                    >
                         <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center font-bold text-sm">2</div>
                            <div>
                                <h3 className="font-bold text-gray-800">Chế độ & Bối cảnh</h3>
                                {!step2Open && activeList.length > 0 && (
                                    <div className="flex items-center gap-1.5 mt-0.5 animate-in fade-in">
                                        <CheckCircle2 size={12} className="text-green-600" />
                                        <span className="text-xs text-green-700 font-medium">Đã xử lý</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        {step2Open ? <ChevronUp size={20} className="text-gray-400" /> : <ChevronDown size={20} className="text-gray-400" />}
                    </div>

                    {/* Body */}
                    {step2Open && (
                        <div className="p-4 border-t border-gray-100 animate-in slide-in-from-top-1 duration-200">
                            {/* Mode Selection Tabs */}
                            <div className="flex bg-gray-100 rounded-xl p-1 mb-4">
                                <button
                                onClick={() => setMode('UPLOAD')}
                                className={`flex-1 flex flex-col items-center justify-center py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
                                    mode === 'UPLOAD' 
                                    ? 'bg-white shadow text-indigo-600' 
                                    : 'text-gray-500 hover:text-gray-700'
                                }`}
                                >
                                <Image size={18} className="mb-1" />
                                Dùng ảnh nền
                                </button>
                                <button
                                onClick={() => setMode('PROMPT')}
                                className={`flex-1 flex flex-col items-center justify-center py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
                                    mode === 'PROMPT' 
                                    ? 'bg-white shadow text-indigo-600' 
                                    : 'text-gray-500 hover:text-gray-700'
                                }`}
                                >
                                <Type size={18} className="mb-1" />
                                Mô tả AI
                                </button>
                                <button
                                onClick={() => setMode('KEEP')}
                                className={`flex-1 flex flex-col items-center justify-center py-2 rounded-lg text-xs font-semibold transition-all duration-200 ${
                                    mode === 'KEEP' 
                                    ? 'bg-white shadow text-indigo-600' 
                                    : 'text-gray-500 hover:text-gray-700'
                                }`}
                                >
                                <MonitorPlay size={18} className="mb-1" />
                                Giữ nguyên
                                </button>
                            </div>

                            {/* Dynamic Inputs based on Mode */}
                            <div className="mb-4">
                                {mode === 'UPLOAD' && (
                                    <div className="animate-in fade-in slide-in-from-left-2 duration-300">
                                        <ImageUploader
                                            id="bg-upload"
                                            label="Tải ảnh nền"
                                            subLabel="Phong cảnh, Studio..."
                                            image={state.backgroundImage}
                                            onImageChange={(img) => setState(prev => ({ ...prev, backgroundImage: img }))}
                                        />
                                    </div>
                                )}

                                {mode === 'PROMPT' && (
                                    <div className="space-y-3 animate-in fade-in slide-in-from-left-2 duration-300">
                                        <div className="flex justify-between items-center">
                                            <label className="text-sm font-semibold text-gray-700">Mô tả bối cảnh</label>
                                            <button 
                                                onClick={handleSuggest}
                                                disabled={state.isSuggesting}
                                                className="text-xs flex items-center gap-1 text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg hover:bg-indigo-100 transition-colors font-medium"
                                            >
                                                {state.isSuggesting ? <Loader2 size={10} className="animate-spin" /> : <Lightbulb size={10} />}
                                                Gợi ý
                                            </button>
                                        </div>

                                        {state.aiSuggestions.length > 0 && (
                                            <div className="flex flex-wrap gap-2">
                                            {state.aiSuggestions.map((sugg, idx) => (
                                                <button
                                                key={idx}
                                                onClick={() => setState(prev => ({ ...prev, textPrompt: sugg }))}
                                                className="text-[10px] bg-purple-50 text-purple-700 border border-purple-100 px-2 py-1 rounded-md hover:bg-purple-100 transition-colors text-left"
                                                >
                                                {sugg}
                                                </button>
                                            ))}
                                            </div>
                                        )}

                                        <textarea
                                            value={state.textPrompt}
                                            onChange={(e) => setState(prev => ({ ...prev, textPrompt: e.target.value }))}
                                            placeholder="Ví dụ: Góc studio tại nhà phong cách Hàn Quốc..."
                                            className="w-full p-3 rounded-xl border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm h-32 resize-none"
                                        />
                                    </div>
                                )}

                                {mode === 'KEEP' && (
                                    <div className="animate-in fade-in slide-in-from-left-2 duration-300">
                                        <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex gap-3">
                                            <div className="bg-white p-1.5 rounded-full h-fit shadow-sm text-blue-600">
                                                <Video size={16} />
                                            </div>
                                            <div>
                                                <strong className="block text-xs font-bold text-blue-800 mb-0.5">Chế độ tạo Prompt Video</strong>
                                                <p className="text-[10px] text-blue-700 leading-relaxed opacity-90">
                                                    Giữ nguyên ảnh hiện tại để tạo kịch bản Video & Voice thủ công mà không thay đổi nền.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {state.error && (
                                <div className="text-sm text-red-600 bg-red-50 p-3 rounded-xl flex items-center gap-2 border border-red-100 mb-3">
                                    <div className="w-1.5 h-1.5 rounded-full bg-red-600" />
                                    {state.error}
                                </div>
                            )}

                            {/* Generate Button */}
                            <button
                                onClick={() => handleGenerate(false)}
                                disabled={state.isGenerating || (mode === 'UPLOAD' && !state.backgroundImage) || (mode === 'PROMPT' && !state.textPrompt)}
                                className={`
                                w-full py-4 rounded-xl font-bold text-white shadow-lg shadow-indigo-200
                                flex items-center justify-center gap-2 transition-all
                                ${state.isGenerating || (mode === 'UPLOAD' && !state.backgroundImage) || (mode === 'PROMPT' && !state.textPrompt)
                                    ? 'bg-gray-300 cursor-not-allowed shadow-none' 
                                    : 'bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98]'}
                                `}
                            >
                                {state.isGenerating && activeList.length === 0 ? (
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
                    )}
                </div>

            </div>
            {/* END LEFT COLUMN */}

            {/* RIGHT COLUMN: PREVIEW (65%) */}
            <div className="lg:col-span-8 bg-white rounded-2xl shadow-sm border border-gray-200 p-4 min-h-[600px] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-100 pb-3 mb-4">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        Kết quả 
                        <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                           {mode === 'UPLOAD' ? 'Ảnh nền tự chọn' : mode === 'PROMPT' ? 'Mô tả AI' : 'Giữ nguyên'}
                        </span>
                    </h3>
                    <span className="text-xs font-medium text-gray-500">{activeList.length} ảnh</span>
                </div>

                {activeList.length > 0 && currentItem ? (
                    <div className="flex-1 flex flex-col gap-5 animate-in fade-in duration-300">
                    
                        {/* Main Image View */}
                        <div 
                            className="relative w-full aspect-[9/16] max-h-[70vh] rounded-xl overflow-hidden shadow-sm bg-gray-50 group mx-auto cursor-zoom-in"
                            onClick={() => handlePreview(currentImageUrl!)}
                        >
                            <img 
                                src={currentImageUrl!}
                                className="w-full h-full object-contain"
                                alt="Final Result"
                            />
                             {/* View Hint */}
                             <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center pointer-events-none">
                                <Maximize2 className="text-white opacity-0 group-hover:opacity-70 transition-opacity drop-shadow-md" size={40} />
                            </div>
                        </div>

                        {/* Thumbnails */}
                        {activeList.length > 1 && (
                            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide py-1">
                                {activeList.map((res, idx) => (
                                    <button
                                    key={idx}
                                    onClick={() => setSelectedIndex(idx)}
                                    className={`relative flex-shrink-0 w-12 h-16 rounded-md overflow-hidden border-2 transition-all ${
                                        idx === selectedIndex ? 'border-indigo-600 ring-2 ring-indigo-100' : 'border-transparent opacity-60 hover:opacity-100'
                                    }`}
                                    >
                                    <img 
                                        src={`data:image/png;base64,${res.base64}`} 
                                        className="w-full h-full object-cover" 
                                        alt={`Thumb ${idx}`}
                                    />
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Content Generation Accordions */}
                        <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                            
                            {currentItem.isVideoPromptLoading ? (
                                <div className="p-6 flex flex-col items-center justify-center gap-3 text-gray-500">
                                    <Loader2 size={24} className="animate-spin text-indigo-600" />
                                    <p className="text-sm font-medium">Đang viết kịch bản...</p>
                                </div>
                            ) : !hasContent ? (
                                <div className="p-4 flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-white text-orange-500 flex items-center justify-center shadow-sm">
                                            <FileText size={20} />
                                        </div>
                                        <div className="text-sm">
                                            <p className="font-bold text-gray-800">Chưa có kịch bản</p>
                                            <p className="text-xs text-gray-500">Tạo prompt video & lời thoại bán hàng.</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleAnalyzeContent(selectedIndex)}
                                        className="bg-white border border-gray-200 hover:border-orange-300 text-gray-700 hover:text-orange-600 font-semibold py-2 px-4 rounded-lg flex items-center gap-2 text-xs transition-all shadow-sm"
                                    >
                                        <Sparkles size={14} />
                                        Tạo ngay
                                    </button>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-200">
                                    {/* Accordion 1: Video Prompts */}
                                    <div>
                                        <button 
                                            onClick={() => setOpenSection(openSection === 'video' ? null : 'video')}
                                            className="w-full flex items-center justify-between p-3 text-sm font-bold text-gray-700 hover:bg-white transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                <Video size={16} className="text-pink-500" />
                                                Kịch bản Video (Prompt)
                                            </div>
                                            {openSection === 'video' ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                        </button>
                                        
                                        {openSection === 'video' && (
                                            <div className="p-3 bg-white border-t border-gray-100 space-y-2">
                                                {currentItem.videoPrompts && currentItem.videoPrompts.length > 0 ? (
                                                    currentItem.videoPrompts.map((prompt, idx) => {
                                                        const promptId = `vid-${idx}`;
                                                        const isCopied = copiedIndex === promptId;
                                                        return (
                                                        <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg border border-gray-100 gap-3 hover:border-indigo-100 transition-colors">
                                                            <div className="flex items-center gap-2 overflow-hidden flex-1">
                                                                <span className="text-[10px] font-bold text-gray-400 bg-white px-1.5 py-0.5 rounded border border-gray-200 min-w-fit">
                                                                    #{idx + 1}
                                                                </span>
                                                                <div className="text-xs text-gray-600 truncate flex-1 select-all cursor-text">
                                                                    {prompt}
                                                                </div>
                                                            </div>
                                                            <button 
                                                                onClick={() => copyToClipboard(prompt, promptId)}
                                                                className={`p-1.5 rounded-md transition-all shrink-0 ${isCopied ? 'text-green-600 bg-green-50' : 'text-gray-400 hover:text-indigo-600 bg-white shadow-sm'}`}
                                                            >
                                                                {isCopied ? <Check size={14} /> : <Copy size={14} />}
                                                            </button>
                                                        </div>
                                                    )})
                                                ) : <span className="text-xs text-red-400">Lỗi hiển thị.</span>}
                                            </div>
                                        )}
                                    </div>

                                    {/* Accordion 2: Voiceover */}
                                    <div>
                                        <button 
                                            onClick={() => setOpenSection(openSection === 'voiceover' ? null : 'voiceover')}
                                            className="w-full flex items-center justify-between p-3 text-sm font-bold text-gray-700 hover:bg-white transition-colors"
                                        >
                                            <div className="flex items-center gap-2">
                                                <Mic size={16} className="text-blue-500" />
                                                Lời thoại & Thu âm
                                            </div>
                                            {openSection === 'voiceover' ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                        </button>
                                        
                                        {openSection === 'voiceover' && (
                                            <div className="p-3 bg-white border-t border-gray-100 space-y-3">
                                                {currentItem.voiceoverScripts && currentItem.voiceoverScripts.length > 0 ? (
                                                    currentItem.voiceoverScripts.map((script, idx) => {
                                                        const scriptId = `voice-${idx}`;
                                                        const isCopied = copiedIndex === scriptId;
                                                        const isAudioLoading = currentItem.isAudioLoading?.[idx];
                                                        const audioData = currentItem.generatedAudios?.[idx];

                                                        return (
                                                        <div key={idx} className="p-3 bg-gray-50 rounded-lg border border-gray-100 space-y-2">
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-[10px] font-bold uppercase text-indigo-500 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                                                                    {VOICEOVER_LABELS[idx] || `Kịch bản ${idx + 1}`}
                                                                </span>
                                                                <button onClick={() => copyToClipboard(script, scriptId)} className="text-gray-400 hover:text-indigo-600">
                                                                    {isCopied ? <Check size={12} /> : <Copy size={12} />}
                                                                </button>
                                                            </div>
                                                            <textarea
                                                                value={script}
                                                                onChange={(e) => handleScriptChange(idx, e.target.value)}
                                                                className="w-full text-xs text-gray-700 bg-white p-2 rounded border border-gray-200 h-16 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
                                                            />
                                                            <div className="flex items-center gap-2 pt-1">
                                                                {!audioData ? (
                                                                    <button 
                                                                        onClick={() => handleGenerateAudio(idx, script)}
                                                                        disabled={isAudioLoading}
                                                                        className="flex-1 py-1.5 bg-white border border-gray-300 hover:border-indigo-400 text-gray-700 rounded text-xs font-semibold shadow-sm flex items-center justify-center gap-1 transition-all"
                                                                    >
                                                                        {isAudioLoading ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                                                                        {isAudioLoading ? 'Đang tạo...' : 'Tạo giọng đọc'}
                                                                    </button>
                                                                ) : (
                                                                    <div className="flex-1 flex flex-col gap-1">
                                                                        <audio controls src={audioData} className="w-full h-6" />
                                                                        <a 
                                                                            href={`https://apiproxy.coha.workers.dev/download?url=${encodeURIComponent(audioData)}`} 
                                                                            download={`voiceover-${idx + 1}.mp3`}
                                                                            className="text-[10px] text-center text-blue-500 hover:underline"
                                                                        >
                                                                            Tải MP3
                                                                        </a>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    )})
                                                ) : <span className="text-xs text-red-400">Lỗi hiển thị.</span>}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Actions Footer */}
                        <div className="grid grid-cols-2 gap-3 mt-auto pt-2">
                            <button 
                                onClick={() => handleGenerate(true)}
                                disabled={state.isGenerating}
                                className={`
                                flex items-center justify-center gap-2 py-3 rounded-xl font-semibold border border-indigo-200 text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-all text-sm
                                ${state.isGenerating ? 'opacity-70' : ''}
                                `}
                            >
                                {state.isGenerating ? <RefreshCw size={16} className="animate-spin" /> : <Plus size={16} />}
                                {state.isGenerating ? 'Đang tạo...' : 'Tạo thêm'}
                            </button>

                            <button 
                                onClick={handleDownload}
                                className="flex items-center justify-center gap-2 bg-gray-800 text-white py-3 rounded-xl font-semibold hover:bg-gray-900 transition-colors shadow-sm text-sm"
                            >
                                <Download size={16} />
                                Tải ảnh
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                            <Sparkles size={24} className="text-gray-300" />
                        </div>
                        <p className="font-medium text-sm">Kết quả sẽ hiện ở đây</p>
                    </div>
                )}
            </div>
            {/* END RIGHT COLUMN */}

        </div>
        /* 2-COLUMN LAYOUT END */
      )}

      {/* Global Modal for Background Editor */}
      <ImagePreviewModal 
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        imageUrl={previewUrl}
      />
    </div>
  );
};
