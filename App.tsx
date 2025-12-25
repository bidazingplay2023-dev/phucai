import React, { useState, useEffect } from 'react';
import { Layers, Shirt, Image as ImageIcon, Video, Wand2, Download, AlertCircle } from 'lucide-react';
import ApiKeyModal from './components/ApiKeyModal';
import ImageUploader from './components/ImageUploader';
import Button from './components/Button';
import { Tab, ProcessingState } from './types';
import { removeBackground, virtualTryOn, generateScene, generateFashionVideo } from './services/geminiService';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.REMOVE_BG);
  const [apiKey, setApiKey] = useState<string | null>(null);
  
  // State for all tabs
  const [image1, setImage1] = useState<string | null>(null); // Main Image (Person/Item)
  const [image2, setImage2] = useState<string | null>(null); // Secondary Image (Cloth for TryOn)
  const [textPrompt, setTextPrompt] = useState<string>('');
  const [outputMedia, setOutputMedia] = useState<{ url: string, type: 'image' | 'video' } | null>(null);
  
  const [processing, setProcessing] = useState<ProcessingState>({
    isLoading: false,
    error: null,
    success: false
  });

  useEffect(() => {
    const key = localStorage.getItem('GEMINI_STUDIO_KEY');
    if (key) setApiKey(key);
  }, []);

  const clearState = () => {
    setImage1(null);
    setImage2(null);
    setTextPrompt('');
    setOutputMedia(null);
    setProcessing({ isLoading: false, error: null, success: false });
  };

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab);
    clearState();
  };

  const executeAI = async () => {
    if (!apiKey) return alert("API Key missing");
    if (!image1) return alert("Please upload a base image");

    setProcessing({ isLoading: true, error: null, success: false });
    setOutputMedia(null);

    try {
      let resultUrl = '';
      let type: 'image' | 'video' = 'image';

      switch (activeTab) {
        case Tab.REMOVE_BG:
          resultUrl = await removeBackground(apiKey, image1);
          break;
        case Tab.TRY_ON:
          if (!image2) throw new Error("Please upload the clothing image.");
          resultUrl = await virtualTryOn(apiKey, image1, image2);
          break;
        case Tab.SCENE:
          if (!textPrompt) throw new Error("Please describe the scene.");
          resultUrl = await generateScene(apiKey, image1, textPrompt);
          break;
        case Tab.VIDEO:
          type = 'video';
          resultUrl = await generateFashionVideo(apiKey, image1);
          break;
      }

      setOutputMedia({ url: resultUrl, type });
      setProcessing({ isLoading: false, error: null, success: true });
    } catch (err: any) {
      console.error(err);
      setProcessing({ 
        isLoading: false, 
        error: err.message || "An error occurred during AI processing.", 
        success: false 
      });
    }
  };

  const renderContent = () => {
    return (
      <div className="pb-32 pt-6 px-4 max-w-2xl mx-auto w-full">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center p-3 bg-indigo-500/10 rounded-2xl mb-3">
             <Wand2 className="w-8 h-8 text-indigo-400" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-200 to-white bg-clip-text text-transparent">
            AI Fashion Studio
          </h1>
          <p className="text-slate-400 text-sm mt-1">Design. Try-on. Create.</p>
        </div>

        {/* Inputs */}
        <div className="space-y-6 bg-slate-900/40 border border-slate-800 p-6 rounded-2xl backdrop-blur-sm shadow-xl">
          
          <ImageUploader 
            label={activeTab === Tab.TRY_ON ? "1. Model / Person" : "Upload Image"} 
            selectedImage={image1}
            onImageSelected={setImage1}
            onClear={() => setImage1(null)}
          />

          {activeTab === Tab.TRY_ON && (
            <ImageUploader 
              label="2. Clothing Item" 
              selectedImage={image2}
              onImageSelected={setImage2}
              onClear={() => setImage2(null)}
            />
          )}

          {activeTab === Tab.SCENE && (
            <div>
               <label className="block text-sm font-medium text-slate-300 mb-2">Describe Background</label>
               <textarea 
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-slate-200 focus:ring-2 focus:ring-indigo-500/50 focus:border-transparent transition-all outline-none resize-none h-24"
                  placeholder="e.g., A luxury parisian street during golden hour..."
                  value={textPrompt}
                  onChange={(e) => setTextPrompt(e.target.value)}
               />
            </div>
          )}

          {activeTab === Tab.REMOVE_BG && (
            <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
               <p className="text-xs text-slate-400 text-center">
                 Uses <strong>Gemini 2.5 Flash Image</strong> to analyze and extract the product.
               </p>
            </div>
          )}
          
           {activeTab === Tab.VIDEO && (
            <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700/50 flex gap-2 items-center justify-center">
               <Video className="w-4 h-4 text-purple-400" />
               <p className="text-xs text-slate-400">
                 Uses <strong>Veo 3.1</strong>. Generation may take 1-2 minutes.
               </p>
            </div>
          )}

          {processing.error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <p className="text-sm text-red-200">{processing.error}</p>
            </div>
          )}

          <Button 
            onClick={executeAI} 
            isLoading={processing.isLoading} 
            disabled={!image1 || (activeTab === Tab.TRY_ON && !image2)}
            className="w-full shadow-indigo-500/20 shadow-lg"
          >
            {activeTab === Tab.REMOVE_BG && 'Remove Background'}
            {activeTab === Tab.TRY_ON && 'Generate Try-On'}
            {activeTab === Tab.SCENE && 'Generate Scene'}
            {activeTab === Tab.VIDEO && 'Generate Video'}
          </Button>
        </div>

        {/* Results */}
        {outputMedia && (
          <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <span className="w-2 h-8 bg-indigo-500 rounded-full"></span>
              Result
            </h3>
            <div className="relative rounded-2xl overflow-hidden shadow-2xl border border-slate-700 group">
              {outputMedia.type === 'image' ? (
                <img src={outputMedia.url} alt="Result" className="w-full h-auto" />
              ) : (
                <video src={outputMedia.url} controls autoPlay loop className="w-full h-auto bg-black" />
              )}
              
              <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <a 
                  href={outputMedia.url} 
                  download={`ai-studio-${Date.now()}.${outputMedia.type === 'image' ? 'png' : 'mp4'}`}
                  className="p-3 bg-white/10 backdrop-blur-md hover:bg-white/20 text-white rounded-full flex items-center justify-center shadow-lg border border-white/20"
                >
                  <Download className="w-5 h-5" />
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen font-sans">
      <ApiKeyModal onSave={setApiKey} />
      
      {/* Content Area */}
      {renderContent()}

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-950/80 backdrop-blur-xl border-t border-slate-800 z-40 pb-safe">
        <div className="flex justify-around items-center p-2 max-w-md mx-auto">
          <NavButton 
            active={activeTab === Tab.REMOVE_BG} 
            onClick={() => handleTabChange(Tab.REMOVE_BG)} 
            icon={<Layers className="w-5 h-5" />} 
            label="Remove BG" 
          />
          <NavButton 
            active={activeTab === Tab.TRY_ON} 
            onClick={() => handleTabChange(Tab.TRY_ON)} 
            icon={<Shirt className="w-5 h-5" />} 
            label="Try On" 
          />
          <NavButton 
            active={activeTab === Tab.SCENE} 
            onClick={() => handleTabChange(Tab.SCENE)} 
            icon={<ImageIcon className="w-5 h-5" />} 
            label="Scene" 
          />
          <NavButton 
            active={activeTab === Tab.VIDEO} 
            onClick={() => handleTabChange(Tab.VIDEO)} 
            icon={<Video className="w-5 h-5" />} 
            label="Video" 
          />
        </div>
      </div>
    </div>
  );
};

const NavButton: React.FC<{ active: boolean; onClick: () => void; icon: React.ReactNode; label: string }> = ({ active, onClick, icon, label }) => (
  <button 
    onClick={onClick}
    className={`flex flex-col items-center gap-1 p-3 rounded-2xl transition-all duration-300 w-20 ${
      active ? 'text-indigo-400 bg-indigo-500/10' : 'text-slate-500 hover:text-slate-300'
    }`}
  >
    <div className={`transition-transform duration-300 ${active ? 'scale-110' : ''}`}>
      {icon}
    </div>
    <span className="text-[10px] font-medium tracking-wide">{label}</span>
  </button>
);

export default App;