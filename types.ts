export interface ProcessedImage {
  file: File;
  previewUrl: string;
  base64: string;
}

export interface GenerationState {
  isLoading: boolean;
  results: string[];
  error: string | null;
}

export interface AppConfig {
  enableMannequin: boolean;
}

export type AppStep = 'TRY_ON' | 'BACKGROUND_EDIT';

// New interface to couple the image with its specific video prompts
export interface GeneratedBackground {
  base64: string;
  videoPrompts: string[];
  voiceoverScripts: string[]; // Added: Store voiceover scripts
  isVideoPromptLoading: boolean;
  
  // New: Store generated audios for each script index
  generatedAudios?: { [key: number]: string }; // Index -> Base64 WAV or URL
  isAudioLoading?: { [key: number]: boolean }; // Index -> Loading state
}

export interface BackgroundState {
  selectedBaseImage: string | null; // Base64 of the image chosen from Step 1
  backgroundImage: ProcessedImage | null; // User uploaded background
  textPrompt: string;
  aiSuggestions: string[];
  isSuggesting: boolean;
  isGenerating: boolean;
  
  // Updated: Store objects instead of just strings
  results: GeneratedBackground[]; 
  
  error: string | null;
}

export interface ApiKeys {
  gemini: string;
  everAi: string;
}