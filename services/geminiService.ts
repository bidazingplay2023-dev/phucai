import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from "@google/genai";
import { AppConfig, ProcessedImage } from "../types";

// CHANGE: Switch to 2.0 Flash Experimental. 
// Reason: The 2.5-flash-image model currently enforces "Limit: 0" on accounts without Billing (Free Tier locked).
// 2.0-flash-exp is more permissive for free testing.
const IMAGE_MODEL_NAME = 'gemini-2.0-flash-exp';
const TEXT_MODEL_NAME = 'gemini-2.5-flash-latest';

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
    
    // Check for "Limit: 0" specifically - this implies Billing Requirement, retrying won't fix it usually, but we try once.
    const isZeroLimit = error.message?.includes("limit: 0");

    if (isZeroLimit) {
        throw new Error("BILLING_REQUIRED");
    }

    if ((isQuotaError || isOverloaded) && retries > 0) {
      console.warn(`Gặp lỗi quá tải (429/503). Đang đợi ${delay}ms để thử lại... (Còn ${retries} lần)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return callWithRetry(apiCall, retries - 1, delay * 2);
    }
    throw error;
  }
};

export const isolateProductImage = async (productImageBase64: string): Promise<string> => {
  try {
    const ai = getClient();
    const prompt = `
      Nhiệm vụ: Chụp ảnh sản phẩm thương mại điện tử (E-commerce Product Photography).
      Yêu cầu: Tách quần/áo ra khỏi nền. Đặt trên nền TRẮNG (#FFFFFF). Giữ nguyên chi tiết. Căn giữa.
    `;

    const response = await callWithRetry(async () => {
      return await ai.models.generateContent({
        model: IMAGE_MODEL_NAME,
        contents: {
          parts: [
            { inlineData: { mimeType: "image/png", data: productImageBase64 } },
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
    if (errMsg === "BILLING_REQUIRED") throw error;
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

    let promptText = `
    Nhiệm vụ: Virtual Try-On.
    Input: Ảnh 1 (Áo/Quần), Ảnh 2 (Người mẫu).
    Output: Thay trang phục Ảnh 1 vào người Ảnh 2.
    Yêu cầu: Giữ nguyên khuôn mặt, màu da, dáng đứng của Ảnh 2. Trang phục ôm sát tự nhiên. Ánh sáng chân thực.
    `;

    if (config.enableMannequin) promptText += ` Tạo thêm một ma nơ canh đứng cạnh.`;

    const response = await callWithRetry(async () => {
      return await ai.models.generateContent({
        model: IMAGE_MODEL_NAME,
        contents: {
          parts: [
            { text: "Item:" },
            { inlineData: { mimeType: "image/png", data: isolatedProductBase64 } },
            { text: "Model:" },
            { inlineData: { mimeType: modelImage.file.type, data: modelImage.base64 } },
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
    if (errMsg === "BILLING_REQUIRED") throw error;
    if (errMsg === "MISSING_API_KEY" || errMsg.includes("429") || errMsg.includes("Quota") || errMsg.includes("RESOURCE_EXHAUSTED")) {
        throw new Error("QUOTA_EXCEEDED");
    }
    throw new Error(errMsg || "Lỗi xử lý ảnh.");
  }
};

export const suggestBackgrounds = async (imageBase64: string): Promise<string[]> => {
  try {
    const ai = getClient();
    const prompt = `Gợi ý 3 bối cảnh chụp ảnh thời trang (3 dòng ngắn gọn Tiếng Việt).`;

    const response = await callWithRetry(async () => {
        return await ai.models.generateContent({
            model: TEXT_MODEL_NAME,
            contents: {
                parts: [
                { inlineData: { mimeType: "image/png", data: imageBase64 } },
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
    let finalPrompt = `Thay nền phía sau thành: ${prompt}. Giữ nguyên người mẫu. Tỉ lệ 9:16.`;
    const parts: any[] = [
      { text: "Original:" },
      { inlineData: { mimeType: "image/png", data: baseImageBase64 } }
    ];

    if (backgroundImage) {
      finalPrompt = `Ghép người mẫu từ ảnh Original vào ảnh Background. Xử lý bóng đổ chân thực.`;
      parts.push({ text: "Background:" });
      parts.push({ inlineData: { mimeType: backgroundImage.file.type, data: backgroundImage.base64 } });
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
    if (errMsg === "BILLING_REQUIRED") throw error;
    if (errMsg === "MISSING_API_KEY" || errMsg.includes("429") || errMsg.includes("Quota") || errMsg.includes("RESOURCE_EXHAUSTED")) {
        throw new Error("QUOTA_EXCEEDED");
    }
    throw new Error(errMsg || "Lỗi đổi bối cảnh.");
  }
};