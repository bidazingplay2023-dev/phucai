import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { AppConfig, ProcessedImage } from "../types";
import { compressImage } from "./utils";

// Sử dụng model Flash Experimental - Model này hiện tại 'dễ tính' nhất với Free Tier
const IMAGE_MODEL_NAME = 'gemini-2.0-flash-exp';
const TEXT_MODEL_NAME = 'gemini-2.0-flash-exp';

// Disable Safety Settings
const SAFETY_SETTINGS = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

const getApiKey = () => {
  if (typeof window !== 'undefined') {
    const userKey = localStorage.getItem('user_api_key');
    if (userKey && userKey.length > 10) return userKey;
  }
  if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_API_KEY) {
    return (import.meta as any).env.VITE_API_KEY;
  }
  try {
    if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
      return process.env.API_KEY;
    }
  } catch (e) {}
  return undefined;
};

const getClient = () => {
  const apiKey = getApiKey();
  if (!apiKey) throw new Error("MISSING_API_KEY");
  return new GoogleGenAI({ apiKey });
};

// --- RETRY LOGIC ---
const callWithRetry = async (apiCall: () => Promise<any>, retries = 3, delay = 2000): Promise<any> => {
  try {
    return await apiCall();
  } catch (error: any) {
    const isQuotaError = error.message?.includes("429") || error.message?.includes("Quota") || error.status === 429;
    const isOverloaded = error.message?.includes("503") || error.message?.includes("Overloaded");
    
    // Nếu gặp lỗi Limit 0, thường do model bị kén vùng hoặc account mới
    // Ta sẽ thử lại 1 lần nữa vì đôi khi nó chỉ là lỗi tạm thời của Google
    if ((isQuotaError || isOverloaded || error.message?.includes("limit: 0")) && retries > 0) {
      console.warn(`API bận, đang thử lại... (Còn ${retries} lần)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return callWithRetry(apiCall, retries - 1, delay * 2);
    }
    throw error;
  }
};

export const isolateProductImage = async (productImageBase64: string): Promise<string> => {
  try {
    const ai = getClient();
    
    // QUAN TRỌNG: Nén ảnh xuống còn tối đa 800px để tiết kiệm Token Free Tier
    const optimizedImage = await compressImage(productImageBase64, 800);

    const prompt = `
      Extract the clothing item from this image. Place it on a pure white background. 
      Center it. Keep high detail.
    `;

    const response = await callWithRetry(async () => {
      return await ai.models.generateContent({
        model: IMAGE_MODEL_NAME,
        contents: {
          parts: [
            { inlineData: { mimeType: "image/jpeg", data: optimizedImage } },
            { text: prompt }
          ]
        },
        config: {
          imageConfig: { aspectRatio: "1:1" },
          safetySettings: SAFETY_SETTINGS,
        }
      });
    });

    if (response.candidates && response.candidates.length > 0) {
      const parts = response.candidates[0].content.parts;
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          return part.inlineData.data;
        }
      }
    }
    throw new Error("Không thể tách nền sản phẩm.");
  } catch (error: any) {
    console.error("Isolate Error:", error);
    const errMsg = error.message || "";
    if (errMsg === "MISSING_API_KEY" || errMsg.includes("429") || errMsg.includes("Quota") || errMsg.includes("RESOURCE_EXHAUSTED")) {
        throw new Error("QUOTA_EXCEEDED");
    }
    throw new Error(errMsg || "Lỗi khi xử lý ảnh sản phẩm.");
  }
};

export const generateTryOnImage = async (
  isolatedProductBase64: string,
  modelImage: ProcessedImage,
  config: AppConfig
): Promise<string> => {
  try {
    const ai = getClient();

    // QUAN TRỌNG: Nén cả 2 ảnh đầu vào
    const optimizedProduct = await compressImage(isolatedProductBase64, 800);
    const optimizedModel = await compressImage(modelImage.base64, 800);

    let promptText = `
    Virtual Try-On Task.
    Replace the model's clothes with the input item.
    Keep face, skin tone, and pose exactly the same.
    Realistic lighting.
    `;

    if (config.enableMannequin) promptText += ` Add a mannequin next to the model wearing the same outfit.`;

    const response = await callWithRetry(async () => {
      return await ai.models.generateContent({
        model: IMAGE_MODEL_NAME,
        contents: {
          parts: [
            { text: "Item:" },
            { inlineData: { mimeType: "image/jpeg", data: optimizedProduct } },
            { text: "Model:" },
            { inlineData: { mimeType: "image/jpeg", data: optimizedModel } },
            { text: promptText },
          ],
        },
        config: {
          imageConfig: { aspectRatio: "9:16" },
          safetySettings: SAFETY_SETTINGS,
        }
      });
    });

    if (response.candidates && response.candidates.length > 0) {
      const parts = response.candidates[0].content.parts;
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          return part.inlineData.data;
        }
      }
    }
    throw new Error("AI không trả về hình ảnh nào.");
  } catch (error: any) {
    console.error("Try-On Error:", error);
    const errMsg = error.message || "";
    if (errMsg === "MISSING_API_KEY" || errMsg.includes("429") || errMsg.includes("Quota") || errMsg.includes("RESOURCE_EXHAUSTED")) {
        throw new Error("QUOTA_EXCEEDED");
    }
    throw new Error(errMsg || "Lỗi xử lý ảnh.");
  }
};

export const suggestBackgrounds = async (imageBase64: string): Promise<string[]> => {
  try {
    const ai = getClient();
    // Nén ảnh cực nhỏ cho việc đọc text gợi ý
    const optimizedImage = await compressImage(imageBase64, 512);
    
    const prompt = `Gợi ý 3 bối cảnh chụp ảnh thời trang (3 dòng ngắn gọn Tiếng Việt).`;

    const response = await callWithRetry(async () => {
        return await ai.models.generateContent({
            model: TEXT_MODEL_NAME,
            contents: {
                parts: [
                { inlineData: { mimeType: "image/jpeg", data: optimizedImage } },
                { text: prompt }
                ]
            },
            config: { safetySettings: SAFETY_SETTINGS }
        });
    }, 2, 1000); 

    const text = response.text || "";
    const suggestions = text.split('\n')
      .map(line => line.replace(/^\d+[\.\)]\s*|-\s*/, '').trim())
      .filter(line => line.length > 5)
      .slice(0, 3);
    return suggestions.length > 0 ? suggestions : ["Studio hiện đại", "Đường phố năng động", "Quán cafe sang trọng"];
  } catch (error) {
    return ["Nền màu be tối giản", "Đường phố thành thị", "Nội thất sang trọng"];
  }
};

export const changeBackground = async (
  baseImageBase64: string,
  prompt: string,
  backgroundImage?: ProcessedImage | null
): Promise<string> => {
  try {
    const ai = getClient();
    const optimizedBase = await compressImage(baseImageBase64, 800);
    
    let finalPrompt = `Change background to: ${prompt}. Keep model exactly same. Ratio 9:16.`;
    const parts: any[] = [
      { text: "Original:" },
      { inlineData: { mimeType: "image/jpeg", data: optimizedBase } }
    ];

    if (backgroundImage) {
      const optimizedBg = await compressImage(backgroundImage.base64, 1024);
      finalPrompt = `Composite model into background image. Realistic shadows.`;
      parts.push({ text: "Background:" });
      parts.push({ inlineData: { mimeType: "image/jpeg", data: optimizedBg } });
    }
    parts.push({ text: finalPrompt });

    const response = await callWithRetry(async () => {
        return await ai.models.generateContent({
            model: IMAGE_MODEL_NAME,
            contents: { parts },
            config: {
                imageConfig: { aspectRatio: "9:16" },
                safetySettings: SAFETY_SETTINGS,
            }
        });
    });

    if (response.candidates && response.candidates.length > 0) {
      const parts = response.candidates[0].content.parts;
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          return part.inlineData.data;
        }
      }
    }
    throw new Error("AI không thể tạo bối cảnh mới.");
  } catch (error: any) {
    console.error("Change Background Error:", error);
    const errMsg = error.message || "";
    if (errMsg === "MISSING_API_KEY" || errMsg.includes("429") || errMsg.includes("Quota") || errMsg.includes("RESOURCE_EXHAUSTED")) {
        throw new Error("QUOTA_EXCEEDED");
    }
    throw new Error(errMsg || "Lỗi đổi bối cảnh.");
  }
};