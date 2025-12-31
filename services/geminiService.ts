import { GoogleGenAI } from "@google/genai";
import { AppConfig, ProcessedImage } from "../types";

// REVERT: Back to Gemini 2.5 Flash Image as requested
const IMAGE_MODEL_NAME = 'gemini-2.5-flash-image';
// Model for Text Analysis
const TEXT_MODEL_NAME = 'gemini-2.5-flash-latest';

// Helper to safely get API Key in various environments (Vite, Node, etc.)
const getApiKey = () => {
  // Check standard process.env first (for Node/Webpack)
  if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
    return process.env.API_KEY;
  }
  // Check Vite specific env (for client-side build support)
  // This allows the user to set VITE_API_KEY in Vercel/Netlify dashboard
  if (typeof import.meta !== 'undefined' && (import.meta as any).env && (import.meta as any).env.VITE_API_KEY) {
    return (import.meta as any).env.VITE_API_KEY;
  }
  // Fallback/Error will be handled by SDK
  return process.env.API_KEY;
};

const getClient = () => {
  const apiKey = getApiKey();
  if (!apiKey) {
    throw new Error("Chưa cấu hình API Key. Vui lòng thiết lập biến môi trường API_KEY hoặc VITE_API_KEY.");
  }
  return new GoogleGenAI({ apiKey });
};

// GIAI ĐOẠN 1 CỦA BƯỚC 1: Tách nền sản phẩm
export const isolateProductImage = async (productImageBase64: string): Promise<string> => {
  try {
    const ai = getClient();
    
    const prompt = `
      Nhiệm vụ: Chụp ảnh sản phẩm thương mại điện tử (E-commerce Product Photography).
      
      Yêu cầu:
      1. Hãy tách chiếc quần/áo/váy trong ảnh này ra khỏi nền cũ.
      2. Đặt nó lên một nền TRẮNG TINH KHIẾT (Pure White Background #FFFFFF).
      3. Giữ nguyên chi tiết, màu sắc, nếp nhăn vải và ánh sáng thực tế của sản phẩm.
      4. Loại bỏ móc treo, ma nơ canh hoặc người mẫu cũ (nếu có), chỉ giữ lại trang phục.
      5. Căn giữa sản phẩm.
    `;

    const response = await ai.models.generateContent({
      model: IMAGE_MODEL_NAME,
      contents: {
        parts: [
          { inlineData: { mimeType: "image/png", data: productImageBase64 } },
          { text: prompt }
        ]
      },
      config: {
        imageConfig: { aspectRatio: "1:1" }, // Square aspect ratio for product shot
      }
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
    console.error("Isolate Product Error:", error);
    throw new Error(error.message || "Lỗi khi xử lý ảnh sản phẩm.");
  }
};

// GIAI ĐOẠN 2 CỦA BƯỚC 1: Ghép vào mẫu
export const generateTryOnImage = async (
  isolatedProductBase64: string, // Input is now the clean product image
  modelImage: ProcessedImage,
  config: AppConfig
): Promise<string> => {
  try {
    const ai = getClient();

    let promptText = `
    Nhiệm vụ: Virtual Try-On (Thử đồ ảo).
    
    Đầu vào:
    - Ảnh 1: Ảnh trang phục đã được tách nền (Sản phẩm cần mặc).
    - Ảnh 2: Ảnh người mẫu gốc.

    Yêu cầu thực hiện:
    1. Thay trang phục hiện tại của người mẫu trong Ảnh 2 bằng trang phục trong Ảnh 1.
    2. QUAN TRỌNG: Giữ nguyên khuôn mặt, màu da, dáng đứng và bối cảnh của Ảnh 2. KHÔNG ĐƯỢC thay đổi khuôn mặt.
    3. Trang phục mới phải ôm sát cơ thể người mẫu một cách tự nhiên (realistic fit).
    4. Xử lý ánh sáng trên trang phục mới sao cho khớp với ánh sáng môi trường của Ảnh 2.
    `;

    if (config.enableMannequin) {
      promptText += `
      - Tạo thêm một ma nơ canh đứng cạnh người mẫu, mặc cùng bộ trang phục này.
      `;
    }

    const contents = {
      parts: [
        { text: "ẢNH 1 (SẢN PHẨM MỚI):" },
        { inlineData: { mimeType: "image/png", data: isolatedProductBase64 } },
        { text: "ẢNH 2 (NGƯỜI MẪU GỐC):" },
        { inlineData: { mimeType: modelImage.file.type, data: modelImage.base64 } },
        { text: promptText },
      ],
    };

    const response = await ai.models.generateContent({
      model: IMAGE_MODEL_NAME,
      contents: contents,
      config: {
        imageConfig: { aspectRatio: "9:16" },
      }
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
    console.error("Gemini Try-On Error:", error);
    throw new Error(error.message || "Lỗi xử lý ảnh.");
  }
};

// Step 2: Suggest Backgrounds (Uses Flash text model)
export const suggestBackgrounds = async (imageBase64: string): Promise<string[]> => {
  try {
    const ai = getClient();
    
    const prompt = `
      Gợi ý 3 bối cảnh chụp ảnh thời trang phù hợp cho trang phục trong ảnh này. 
      Trả về danh sách 3 dòng ngắn gọn bằng Tiếng Việt.
    `;

    const response = await ai.models.generateContent({
      model: TEXT_MODEL_NAME,
      contents: {
        parts: [
           { inlineData: { mimeType: "image/png", data: imageBase64 } },
           { text: prompt }
        ]
      }
    });

    const text = response.text || "";
    const suggestions = text.split('\n')
      .map(line => line.replace(/^\d+[\.\)]\s*|-\s*/, '').trim())
      .filter(line => line.length > 5)
      .slice(0, 3);
      
    return suggestions.length > 0 ? suggestions : ["Studio hiện đại", "Đường phố năng động", "Quán cafe sang trọng"];
  } catch (error) {
    console.error("Suggestion Error:", error);
    return ["Nền màu be tối giản", "Đường phố thành thị", "Nội thất sang trọng"];
  }
};

// Step 2: Change Background
export const changeBackground = async (
  baseImageBase64: string,
  prompt: string,
  backgroundImage?: ProcessedImage | null
): Promise<string> => {
  try {
    const ai = getClient();

    let finalPrompt = `
      Nhiệm vụ: Thay đổi bối cảnh (background).
      Yêu cầu: 
      - Giữ nguyên người mẫu và trang phục từ ảnh gốc.
      - Thay nền phía sau bằng: ${prompt}.
      - Tỉ lệ ảnh: 9:16.
    `;

    const parts: any[] = [
      { text: "ẢNH GỐC:" },
      { inlineData: { mimeType: "image/png", data: baseImageBase64 } }
    ];

    if (backgroundImage) {
      finalPrompt = `
        Nhiệm vụ: Ghép người mẫu vào nền mới.
        - Lấy người mẫu từ ẢNH GỐC.
        - Ghép vào ẢNH NỀN MỚI.
        - Xử lý bóng đổ và ánh sáng chân thực.
      `;
      parts.push({ text: "ẢNH NỀN MỚI:" });
      parts.push({ inlineData: { mimeType: backgroundImage.file.type, data: backgroundImage.base64 } });
    }
    
    parts.push({ text: finalPrompt });

    const response = await ai.models.generateContent({
      model: IMAGE_MODEL_NAME,
      contents: { parts },
      config: {
        imageConfig: { aspectRatio: "9:16" },
      }
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
    throw new Error(error.message || "Lỗi đổi bối cảnh.");
  }
};