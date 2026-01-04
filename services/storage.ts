import { ProcessedImage, GenerationState, AppConfig, AppStep, BackgroundState } from '../types';

const DB_NAME = 'FashionAI_DB';
const STORE_NAME = 'app_state';
const DB_VERSION = 1;

// Keys for different parts of the app
export const KEYS = {
  APP_SESSION: 'main_session_v1',
  BG_EDITOR_SESSION: 'bg_editor_session_v1'
};

const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
};

export const saveToDB = async (key: string, value: any) => {
  try {
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      // We strip File objects because they don't persist well in all browsers/contexts
      // We will rely on base64 and mimeType to reconstruct them
      const request = store.put(value, key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error("Save to DB failed", e);
  }
};

export const loadFromDB = async (key: string) => {
  try {
    const db = await initDB();
    return new Promise<any>((resolve, reject) => {
      const transaction = db.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  } catch (e) {
    console.error("Load from DB failed", e);
    return null;
  }
};

export const clearKeyFromDB = async (key: string) => {
    try {
        const db = await initDB();
        return new Promise<void>((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.delete(key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.error("Clear DB key failed", e);
    }
};

// Helper to reconstruct ProcessedImage from saved state (which lacks the File object)
export const reconstructProcessedImage = (saved: any): ProcessedImage | null => {
  if (!saved || !saved.base64) return null;
  
  // Re-create a blob/file-like object for compatibility
  // Note: We don't strictly need the binary File if we have base64 for display/API
  // But we mock the File interface so types.ts is happy
  const mimeType = saved.mimeType || 'image/png';
  const mockFile = {
    name: saved.fileName || 'restored-image.png',
    type: mimeType,
    lastModified: Date.now(),
    size: Math.round((saved.base64.length * 3) / 4), // Approximate size
    slice: () => new Blob(),
    text: () => Promise.resolve(""),
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    stream: () => new ReadableStream()
  } as unknown as File;

  return {
    base64: saved.base64,
    previewUrl: `data:${mimeType};base64,${saved.base64}`,
    file: mockFile
  };
};

// Helper to prepare ProcessedImage for storage (strip File object)
export const prepareImageForStorage = (img: ProcessedImage | null) => {
  if (!img) return null;
  return {
    base64: img.base64,
    mimeType: img.file.type,
    fileName: img.file.name
  };
};
