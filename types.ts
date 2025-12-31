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

export interface BackgroundState {
  selectedBaseImage: string | null; // Base64 of the image chosen from Step 1
  backgroundImage: ProcessedImage | null; // User uploaded background
  textPrompt: string;
  aiSuggestions: string[];
  isSuggesting: boolean;
  isGenerating: boolean;
  results: string[]; // Changed from resultImage to array
  error: string | null;
}