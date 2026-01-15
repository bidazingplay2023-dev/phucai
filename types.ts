
export interface ProcessedImage {
  file: File;
  previewUrl: string;
}

export interface GeneratedImage {
  blob: Blob;
  previewUrl: string;
}

export interface GenerationState {
  isLoading: boolean;
  results: GeneratedImage[];
  error: string | null;
}

export interface AppConfig {
  enableMannequin: boolean;
}

export type AppStep = 'TRY_ON' | 'BACKGROUND_EDIT';

// New Type for Product Isolation Mode
export type GarmentType = 'TOP' | 'BOTTOM' | 'FULL';

// New interface to couple the image with its specific video prompts
export interface GeneratedBackground {
  blob: Blob;
  previewUrl: string;
  videoPrompts: string[];
  voiceoverScripts: string[]; // Added: Store voiceover scripts
  isVideoPromptLoading: boolean;
  
  // New: Store generated audios for each script index
  generatedAudios?: { [key: number]: string }; // Index -> Base64 Data or URL
  audioMimeTypes?: { [key: number]: string }; // Index -> MIME Type (e.g., 'audio/wav', 'audio/mpeg')
  isAudioLoading?: { [key: number]: boolean }; // Index -> Loading state
}

export interface BackgroundState {
  selectedBaseImage: GeneratedImage | null; // Blob + URL of the image chosen from Step 1
  
  // Inputs per mode
  backgroundImage: ProcessedImage | null; // User uploaded background (UPLOAD Mode)
  textPrompt: string; // Text prompt (PROMPT Mode)
  
  aiSuggestions: string[];
  suggestionCache: Record<string, string[]>; // CACHE: Store suggestions per style (Key: StyleName, Value: Array of prompts)
  
  isSuggesting: boolean;
  isGenerating: boolean;
  
  // Separate results for each mode to persist state when switching tabs
  resultsUpload: GeneratedBackground[];
  resultsPrompt: GeneratedBackground[];
  resultsKeep: GeneratedBackground[];
  
  error: string | null;
}
