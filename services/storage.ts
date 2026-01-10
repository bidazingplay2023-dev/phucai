import { ProcessedImage } from '../types';

// --- CONFIGURATION ---
const DB_NAME = 'FashionAI_Database';
const DB_VERSION = 1;
const STORE_NAME = 'app_sessions';

export const KEYS = {
  APP_SESSION: 'app_session_v1',
  BG_EDITOR_SESSION: 'bg_editor_v1'
};

// --- INDEXED DB HELPER (Core Logic) ---
// Opens (or creates) the database asynchronously
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

// --- PUBLIC API (Compatible with App.tsx) ---

// 1. Save Data (Async, Non-blocking)
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

// 2. Load Data (Async)
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

// 3. Clear Data
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

// Prepare image for storage: Keep High-Res Base64
export const prepareImageForStorage = (image: ProcessedImage | null) => {
  if (!image) return null;
  return {
    base64: image.base64,
    name: image.file.name,
    type: image.file.type,
    lastModified: image.file.lastModified
  };
};

// Reconstruct image from DB: Create new Blob & URL
export const reconstructProcessedImage = (savedImage: any): ProcessedImage | null => {
  if (!savedImage) return null;
  
  try {
    // Convert Base64 back to Blob/File
    const byteString = atob(savedImage.base64);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    
    const type = savedImage.type || 'image/png';
    const blob = new Blob([ab], { type: type });
    const file = new File([blob], savedImage.name || 'restored_image.png', {
      type: type,
      lastModified: savedImage.lastModified || Date.now()
    });

    const previewUrl = URL.createObjectURL(file);

    return {
      file: file,
      base64: savedImage.base64, // Keep original high-quality base64
      previewUrl: previewUrl
    };
  } catch (e) {
    console.error("Error reconstructing image:", e);
    return null;
  }
};