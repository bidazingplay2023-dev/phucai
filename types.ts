export enum AppTab {
  VIRTUAL_FIT = 'VIRTUAL_FIT',
  SCENE_MAGIC = 'SCENE_MAGIC',
  CINEMATIC_VIDEO = 'CINEMATIC_VIDEO',
  SETTINGS = 'SETTINGS'
}

export interface GeneratedImage {
  url: string;
  timestamp: number;
}

export interface GeneratedVideo {
  url: string;
  timestamp: number;
}

export interface ProcessingState {
  isProcessing: boolean;
  statusMessage: string;
  progress?: number;
}
