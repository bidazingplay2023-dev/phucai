export enum NavTab {
  TRY_ON = 'TRY_ON',
  BACKGROUND = 'BACKGROUND',
  VIDEO = 'VIDEO',
  SETTINGS = 'SETTINGS'
}

export interface AppState {
  apiKey: string | null;
  activeTab: NavTab;
  isLoading: boolean;
  error: string | null;
  successMessage: string | null;
}

export interface ImageAsset {
  id: string;
  data: string; // Base64
  mimeType: string;
}

export enum ModelType {
  IMAGE_GEN = 'gemini-2.5-flash-image', // Good for editing/try-on
  VIDEO_GEN = 'veo-3.1-fast-generate-preview',
  TEXT_GEN = 'gemini-3-flash-preview'
}