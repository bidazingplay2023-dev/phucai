
import { GoogleGenAI, Modality, Type } from "@google/genai";
import { AppConfig, ProcessedImage } from "../types";
import { addWavHeader } from "./utils";

// Model for Image Generation/Editing
const IMAGE_MODEL_NAME = 'gemini-2.5-flash-image';
// Model for Text Analysis
const TEXT_MODEL_NAME = 'gemini-3-flash-preview';
// Model for TTS
const TTS_MODEL_NAME = 'gemini-2.5-flash-preview-tts';

// GIAI ĐOẠN 1 CỦA BƯỚC 1: Tách nền sản phẩm
// Removed apiKey argument, using process.env.API_KEY directly
export const isolateProductImage = async (productImageBase64: string): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
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
// Removed apiKey argument, using process.env.API_KEY directly
export const generateTryOnImage = async (
  isolatedProductBase64: string, // Input is now the clean product image
  modelImage: ProcessedImage,
  config: AppConfig
): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    let promptText = `
    Nhiệm vụ: Virtual Try-On (Thử đồ ảo).
    
    Đầu vào:
    - Ảnh 1: Ảnh trang phục đã được tách nền (Sản phẩm cần mặc).
    - Ảnh 2: Ảnh người mẫu gốc.

    Yêu cầu thực hiện:
    1. Thay trang phục hiện tại của người mẫu trong Ảnh 2 bằng trang phục trong Ảnh 1.
    2. QUAN TRỌNG: Giữ nguyên khuôn mặt, dáng đứng và bối cảnh của Ảnh 2. KHÔNG ĐƯỢC thay đổi khuôn mặt.
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
// Removed apiKey argument, using process.env.API_KEY directly and using responseSchema
export const suggestBackgrounds = async (imageBase64: string): Promise<string[]> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const prompt = `
      Bạn là một giám đốc nghệ thuật. Hãy gợi ý 3 bối cảnh (background) chụp ảnh thời trang phù hợp nhất cho bộ trang phục trong ảnh này.
      Nội dung mỗi gợi ý phải Ngắn gọn, súc tích (dưới 10 từ).
    `;

    const response = await ai.models.generateContent({
      model: TEXT_MODEL_NAME,
      contents: {
        parts: [
           { inlineData: { mimeType: "image/png", data: imageBase64 } },
           { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });

    const text = response.text;
    if (text) {
      return JSON.parse(text);
    }
    return ["Studio phông trắng", "Đường phố hiện đại", "Quán cafe sang trọng"];
  } catch (error) {
    console.error("Suggestion Error:", error);
    return ["Nền màu be tối giản", "Đường phố thành thị", "Nội thất sang trọng"];
  }
};

// Step 2: Change Background
// Removed apiKey argument, using process.env.API_KEY directly
export const changeBackground = async (
  baseImageBase64: string,
  prompt: string,
  backgroundImage?: ProcessedImage | null
): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    let finalPrompt = `
      Nhiệm vụ: Thay đổi bối cảnh (background).
      Yêu cầu: 
      - Xác định người mẫu và trang phục từ ẢNH GỐC để tách ra sau đó thay nền phía sau bằng: ${prompt}.
      - Tỉ lệ ảnh: 9:16.
      Lưu ý: Giữ nguyên khuôn mặt của người mẫu tuyệt đối không thay đổi khuôn mặt người mẫu
    `;

    const parts: any[] = [
      { text: "ẢNH GỐC:" },
      { inlineData: { mimeType: "image/png", data: baseImageBase64 } }
    ];

    if (backgroundImage) {
      finalPrompt = `
        Nhiệm vụ: Ghép người mẫu vào nền mới.
        Xác định người mẫu và trang phục từ ẢNH GỐC để tách ra đó thay vào ẢNH NỀN MỚI này
        + Xử lý bóng đổ và ánh sáng chân thực.
        + Xử lí ảnh tách người mẫu ghép sang khung nền ảnh mới phải vừa vặn nhìn phù hợp với ẢNH NỀN MỚI.
        Lưu ý: Giữ nguyên khuôn mặt của người mẫu tuyệt đối không thay đổi khuôn mặt người mẫu
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

// NEW: Analyze image to generate 5 Video Prompts AND 2 Voiceover Scripts
// Removed apiKey argument, using process.env.API_KEY directly and using responseSchema
export const generateVideoPrompt = async (imageBase64: string): Promise<{ videoPrompts: string[], voiceoverScripts: string[] }> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const prompt = `
    Phân tích bức ảnh này và thực hiện 2 nhiệm vụ:

    NHIỆM VỤ 1: Viết 5 Video Prompts (Mô tả hành động Image-to-Video)
    - Tạo 5 prompt tiếng Anh ngắn gọn dùng cho các AI Video Generator.
    - ƯU TIÊN TUYỆT ĐỐI: Mô tả các hành động quay video bằng điện thoại trước gương (Mirror Selfie) hoặc khoe Outfit (Outfit Check).

    NHIỆM VỤ 2: Đóng vai một TikToker/Reviewer thời trang Gen Z nổi tiếng. 
    Hãy viết 2 kịch bản voiceover ngắn (khoảng 35s) để bán sản phẩm, trang phục trong ảnh.
    
    YÊU CẦU ĐẶC BIỆT VỀ NGÔN NGỮ (RẤT QUAN TRỌNG):
    1. TUYỆT ĐỐI KHÔNG SỬ DỤNG TIẾNG ANH (No English words allowed).
    2. Giọng điệu hào hứng, tự nhiên, sử dụng từ lóng Gen Z Việt Nam.
    `;

    const response = await ai.models.generateContent({
      model: TEXT_MODEL_NAME,
      contents: {
        parts: [
           { inlineData: { mimeType: "image/png", data: imageBase64 } },
           { text: prompt }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            videoPrompts: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            voiceoverScripts: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["videoPrompts", "voiceoverScripts"]
        }
      }
    });

    const text = response.text;
    if (text) {
      return JSON.parse(text);
    }
    return { videoPrompts: ["Failed to generate."], voiceoverScripts: [] };
  } catch (error: any) {
    console.error("Video Content Generation Error:", error);
    return { videoPrompts: [`Lỗi: ${error.message}`], voiceoverScripts: [] };
  }
};

// NEW: Generate Audio (TTS)
// Removed apiKey argument, using process.env.API_KEY directly
export const generateSpeech = async (text: string, voiceName: string): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const response = await ai.models.generateContent({
      model: TTS_MODEL_NAME,
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceName },
            },
        },
      },
    });

    const base64Pcm = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (!base64Pcm) {
      throw new Error("AI did not return audio data.");
    }

    // Wrap raw PCM in a WAV header so it can be played/downloaded
    return addWavHeader(base64Pcm);

  } catch (error: any) {
    console.error("TTS Error:", error);
    throw new Error(error.message || "Lỗi tạo giọng nói.");
  }
};
