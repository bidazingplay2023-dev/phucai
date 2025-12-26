import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

type AppMode = 'standard' | 'premium';

// --- KEY MANAGEMENT ---
const STORAGE_KEY = 'gemini_api_key_secure';

export const getStoredApiKey = (): string | null => {
  return localStorage.getItem(STORAGE_KEY) || process.env.API_KEY || null;
};

export const setStoredApiKey = (key: string) => {
  localStorage.setItem(STORAGE_KEY, key);
};

export const validateApiKey = async (key: string): Promise<boolean> => {
  try {
    const ai = new GoogleGenAI({ apiKey: key });
    await ai.models.generateContent({
      model: 'gemini-2.5-flash-latest',
      contents: { parts: [{ text: 'Test' }] }
    });
    return true;
  } catch (e) {
    console.error("Key validation failed", e);
    return false;
  }
};

// --- HELPER: Resize ảnh ---
const resizeImage = (base64Str: string, maxWidth = 4096): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      if (img.width <= maxWidth && img.height <= maxWidth) {
         resolve(base64Str);
         return;
      }
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height *= maxWidth / width;
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/png')); 
      } else {
        resolve(base64Str);
      }
    };
    img.onerror = () => resolve(base64Str);
  });
};

async function retryOperation<T>(operation: () => Promise<T>, retries = 3, delay = 5000): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    let errString = typeof error === 'object' ? JSON.stringify(error) : String(error);
    
    const isQuotaError = errString.includes('429') || 
                         errString.includes('RESOURCE_EXHAUSTED') || 
                         errString.includes('quota') ||
                         (error?.status === 429) || 
                         (error?.status === 503);

    if (retries > 0 && isQuotaError) {
      console.warn(`Hết hạn mức. Đang thử lại sau ${delay/1000}s...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return retryOperation(operation, retries - 1, delay * 2);
    }
    throw error;
  }
}

const getModelConfig = (mode: AppMode) => {
  if (mode === 'premium') {
    return {
      model: 'gemini-3-pro-image-preview',
      imageConfig: { imageSize: "4K" }
    };
  }
  return {
    model: 'gemini-2.5-flash-image',
    imageConfig: undefined
  };
};

const getAIClient = () => {
  const key = getStoredApiKey();
  if (!key) throw new Error("API Key missing");
  return new GoogleGenAI({ apiKey: key });
};

// --- SUGGEST BACKGROUNDS ---
export const suggestBackgrounds = async (imageBase64: string): Promise<string[]> => {
  const key = getStoredApiKey();
  if (!key) return [];

  const ai = new GoogleGenAI({ apiKey: key });
  const optimizedImage = await resizeImage(imageBase64, 1024);

  // Prompt đã tối ưu ngắn gọn
  const prompt = `
    Analyze fashion image. Suggest 4 professional, photorealistic backgrounds. 
    Keep descriptions under 12 words.
    Return ONLY a raw JSON array of strings. 
    Example: ["Modern loft with large windows", "Urban street at night"]
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-latest',
      contents: {
        parts: [
          { inlineData: { data: optimizedImage.split(',')[1], mimeType: 'image/