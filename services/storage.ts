
import { ProcessedImage, GeneratedImage, GeneratedBackground } from '../types';

// --- CONFIGURATION ---
const DB_NAME = 'FashionAI_Database';
const DB_VERSION = 2; // Incremented version for schema changes if needed, though simple structure change is fine
const STORE_NAME = 'app_sessions';

export const KEYS = {
  APP_SESSION: 'app_session_v1',
  BG_EDITOR_SESSION: 'bg_editor_v1'
};

// --- INDEXED DB HELPER (Core Logic) ---
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result);
    };

    request.onerror = (event) => {
      reject(`IndexedDB error: ${(event.target as IDBOpenDBRequest).error}`);
    };
  });
};

// --- PUBLIC API ---

export const saveToDB = async (key: string, data: any): Promise<void> => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(data, key);
    
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error("Save to DB failed:", error);
  }
};

export const loadFromDB = async (key: string): Promise<any> => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(key);

    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Load from DB failed:", error);
    return null;
  }
};

export const clearKeyFromDB = async (key: string): Promise<void> => {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(key);
    
    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (error) {
    console.error("Clear DB key failed:", error);
  }
};

// --- HELPER FUNCTIONS FOR IMAGES ---

// For ProcessedImage (User Uploads) - Store the File object directly
export const prepareImageForStorage = (image: ProcessedImage | null) => {
  if (!image) return null;
  // IndexedDB stores File objects natively
  return {
    file: image.file
  };
};

// For GeneratedImage (AI Outputs) - Store the Blob directly
export const prepareGeneratedImageForStorage = (image: GeneratedImage | null) => {
  if (!image) return null;
  return {
    blob: image.blob
  };
};

// For GeneratedBackground arrays
export const prepareBackgroundsForStorage = (images: GeneratedBackground[]) => {
  return images.map(img => ({
    blob: img.blob,
    videoPrompts: img.videoPrompts,
    voiceoverScripts: img.voiceoverScripts,
    generatedAudios: img.generatedAudios,
    audioMimeTypes: img.audioMimeTypes
  }));
};

// Reconstruct ProcessedImage (User Uploads)
export const reconstructProcessedImage = (savedData: any): ProcessedImage | null => {
  if (!savedData || !savedData.file) return null;
  
  try {
    // Check if it's a legacy saved object (with base64) or new (File)
    // If it has base64 but no File object, we might need to convert (handling legacy migration if needed, but assuming clean state for refactor)
    // For this refactor, we assume savedData.file IS a File object retrieved from IDB
    
    const file = savedData.file;
    const previewUrl = URL.createObjectURL(file);

    return {
      file: file,
      previewUrl: previewUrl
    };
  } catch (e) {
    console.error("Error reconstructing processed image:", e);
    return null;
  }
};

// Reconstruct GeneratedImage (AI Outputs)
export const reconstructGeneratedImage = (savedData: any): GeneratedImage | null => {
  if (!savedData || (!savedData.blob && !savedData.base64)) return null;
  
  try {
    let blob = savedData.blob;
    
    // Legacy support: if saved as base64 in old version
    if (!blob && savedData.base64) {
        // We won't implement full legacy migration here to keep code clean, 
        // but typically you'd convert base64 to blob here.
        // Assuming strict new format based on instructions.
        return null;
    }

    const previewUrl = URL.createObjectURL(blob);
    return {
      blob: blob,
      previewUrl: previewUrl
    };
  } catch (e) {
    console.error("Error reconstructing generated image:", e);
    return null;
  }
};

// Reconstruct GeneratedBackgrounds
export const reconstructBackgrounds = (savedList: any[]): GeneratedBackground[] => {
  if (!Array.isArray(savedList)) return [];
  
  return savedList.map(item => {
     if (!item.blob) return null;
     const previewUrl = URL.createObjectURL(item.blob);
     return {
         blob: item.blob,
         previewUrl,
         videoPrompts: item.videoPrompts || [],
         voiceoverScripts: item.voiceoverScripts || [],
         isVideoPromptLoading: false,
         generatedAudios: item.generatedAudios || {},
         audioMimeTypes: item.audioMimeTypes || {},
         isAudioLoading: {}
     };
  }).filter(Boolean) as GeneratedBackground[];
};
