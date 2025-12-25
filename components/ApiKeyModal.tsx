import React, { useState, useEffect } from 'react';
import { Key, Lock, AlertTriangle } from 'lucide-react';
import Button from './Button';

interface ApiKeyModalProps {
  onSave: (key: string) => void;
}

const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ onSave }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [keyInput, setKeyInput] = useState('');

  useEffect(() => {
    const storedKey = localStorage.getItem('GEMINI_STUDIO_KEY');
    if (!storedKey) {
      setIsOpen(true);
    }
  }, []);

  const handleSave = () => {
    if (keyInput.trim().length > 10) {
      localStorage.setItem('GEMINI_STUDIO_KEY', keyInput.trim());
      onSave(keyInput.trim());
      setIsOpen(false);
    } else {
      alert("Please enter a valid Gemini API Key");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-indigo-500/20 rounded-xl">
              <Key className="w-6 h-6 text-indigo-400" />
            </div>
            <h2 className="text-xl font-bold text-white">Setup Access</h2>
          </div>
          
          <p className="text-slate-400 text-sm mb-6">
            To use AI Fashion Studio, please provide your Google Gemini API Key. 
            This key is saved locally in your browser and never sent to our servers.
          </p>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                Gemini API Key
              </label>
              <div className="relative">
                <input 
                  type="password"
                  value={keyInput}
                  onChange={(e) => setKeyInput(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 pl-10"
                />
                <Lock className="absolute left-3 top-3.5 w-4 h-4 text-slate-600" />
              </div>
            </div>

            <div className="bg-amber-900/20 border border-amber-900/50 rounded-lg p-3 flex gap-3 items-start">
               <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
               <p className="text-xs text-amber-200/80">
                 Required: A paid project key or a key with billing enabled is recommended for high usage limits.
                 Use <span className="font-mono bg-amber-900/40 px-1 rounded">gemini-2.5-flash-image</span> and <span className="font-mono bg-amber-900/40 px-1 rounded">veo-3.1</span> enabled.
               </p>
            </div>

            <Button onClick={handleSave} className="w-full">
              Save & Continue
            </Button>
            
            <p className="text-center text-xs text-slate-600 mt-4">
              Get your key at <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">Google AI Studio</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ApiKeyModal;