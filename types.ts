

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
  generatedAudios?: { [key: number]: string }; // Index -> Base64 Data
  audioMimeTypes?: { [key: number]: string }; // Index -> MIME Type (e.g., 'audio/wav', 'audio/mpeg')
  isAudioLoading?: { [key: number]: boolean }; // Index -> Loading state
}

export interface BackgroundState {
  selectedBaseImage: string | null; // Base64 of the image chosen from Step 1
  
  // Inputs per mode
  backgroundImage: ProcessedImage | null; // User uploaded background (UPLOAD Mode)
  textPrompt: string; // Text prompt (PROMPT Mode)
  
  aiSuggestions: string[];
  isSuggesting: boolean;
  isGenerating: boolean;
  
  // Separate results for each mode to persist state when switching tabs
  resultsUpload: GeneratedBackground[];
  resultsPrompt: GeneratedBackground[];
  resultsKeep: GeneratedBackground[];
  
  error: string | null;
}
