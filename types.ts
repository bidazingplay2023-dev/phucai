export interface ApiKeyConfig {
  key: string;
  isValid: boolean;
}

export interface ImageAsset {
  id: string;
  file: File;
  previewUrl: string;
  base64: string; // Clean base64 string without data prefix for API
  mimeType: string;
}

export interface VirtualFitState {
  productImage: ImageAsset | null;
  modelImage: ImageAsset | null;
  resultImage: string | null;
  isProcessing: boolean;
  error: string | null;
  retryAfter: number | null; // For 429 handling
}

export enum AppRoute {
  HOME = 'home',
  FITTING = 'fitting',
  SETTINGS = 'settings',
}

export interface NavigationItem {
  id: AppRoute;
  label: string;
  icon: any; // Lucide icon component type
}