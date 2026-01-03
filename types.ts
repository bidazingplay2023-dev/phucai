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
  voiceoverScripts: string[]; 
  
  // New fields for Audio/TTS
  voiceoverAudios: (string | null)[]; // Stores Blob URLs for the audio files
  isVoiceoverLoading: boolean[]; // Stores loading state for each script index
  
  isVideoPromptLoading: boolean;
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