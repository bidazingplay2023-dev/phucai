export enum Tab {
  REMOVE_BG = 'REMOVE_BG',
  TRY_ON = 'TRY_ON',
  SCENE = 'SCENE',
  VIDEO = 'VIDEO'
}

export interface ProcessingState {
  isLoading: boolean;
  error: string | null;
  success: boolean;
}

export interface GeneratedMedia {
  type: 'image' | 'video';
  url: string;
}

export type GeminiModel = 
  | 'gemini-2.5-flash-image' 
  | 'veo-3.1-fast-generate-preview';
