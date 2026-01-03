import { GoogleGenAI, Modality } from "@google/genai";
import { AppConfig, ProcessedImage } from "../types";
import { addWavHeader } from "./utils";

// REVERT: Back to Gemini 2.5 Flash Image as requested
const IMAGE_MODEL_NAME = 'gemini-2.5-flash-image';
// Model for Text Analysis
const TEXT_MODEL_NAME = 'gemini-3-flash-preview';

// --- EVERAI CREDENTIALS ---
// Note: We use a relative path for the API URL to allow the Proxy (Vite or Cloudflare) to handle CORS.
const PROXY_BASE_URL = "/api/everai"; 
const EVERAI_API_KEY = "R28Id4IVC3YNbq1mERu2iNqw9hvI6geUl";
const EVERAI_VOICE_CODE = "voice-e7bc94bb-b424-4a0a";

// GIAI ĐOẠN 1 CỦA BƯỚC 1: Tách nền sản phẩm
export const isolateProductImage = async (apiKey: string, productImageBase64: string): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: apiKey });
    
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
        imageConfig: { aspectRatio: "1:1" }, 
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
  apiKey: string,
  isolatedProductBase64: string, 
  modelImage: ProcessedImage,
  config: AppConfig
): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: apiKey });

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
export const suggestBackgrounds = async (apiKey: string, imageBase64: string): Promise<string[]> => {
  try {
    const ai = new GoogleGenAI({ apiKey: apiKey });
    
    const prompt = `
      Bạn là một giám đốc nghệ thuật. Hãy gợi ý 3 bối cảnh (background) chụp ảnh thời trang phù hợp nhất cho bộ trang phục trong ảnh này.
      
      Yêu cầu đầu ra:
      - Chỉ trả về một JSON Array chứa 3 chuỗi string.
      - Nội dung mỗi chuỗi phải Ngắn gọn, súc tích (dưới 10 từ).
      - KHÔNG có lời dẫn, không đánh số.
      
      Ví dụ output mong muốn:
      ["Sảnh tòa nhà hiện đại", "Quán cafe phong cách Vintage", "Đường phố Tokyo về đêm"]
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
        responseMimeType: "application/json"
      }
    });

    const text = response.text || "";
    
    try {
      const cleanedText = text.replace(/```json|```/g, '').trim();
      const json = JSON.parse(cleanedText);
      if (Array.isArray(json)) {
        return json.map(item => String(item).trim());
      }
      return ["Studio phông trắng", "Đường phố hiện đại", "Quán cafe sang trọng"];
    } catch (e) {
      console.warn("JSON Parse Error for suggestions", e);
      return text.split('\n')
        .map(line => line.replace(/^\d+[\.\)]\s*|-\s*/, '').trim())
        .filter(line => line.length > 0 && line.length < 50 && !line.includes("Dưới đây"))
        .slice(0, 3);
    }
  } catch (error) {
    console.error("Suggestion Error:", error);
    return ["Nền màu be tối giản", "Đường phố thành thị", "Nội thất sang trọng"];
  }
};

// Step 2: Change Background
export const changeBackground = async (
  apiKey: string,
  baseImageBase64: string,
  prompt: string,
  backgroundImage?: ProcessedImage | null
): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: apiKey });

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
        Xác định người mẫu và trang phục từ ẢNH GỐC để tách ra sau đó thay nền phía sau bằng: ẢNH NỀN MỚI này
        + Xử lý bóng đổ và ánh sáng chân thực.
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
export const generateVideoPrompt = async (apiKey: string, imageBase64: string): Promise<{ videoPrompts: string[], voiceoverScripts: string[] }> => {
  try {
    const ai = new GoogleGenAI({ apiKey: apiKey });
    
    const prompt = `
    Phân tích bức ảnh này và thực hiện 2 nhiệm vụ:

    NHIỆM VỤ 1: Viết 5 Video Prompts (Mô tả hành động Image-to-Video)
    - Tạo 5 prompt tiếng Anh ngắn gọn dùng cho các AI Video Generator.
    - Phong cách: Gen Z, Trẻ trung, Năng động, "Slay".
    - ƯU TIÊN TUYỆT ĐỐI: Mô tả các hành động quay video bằng điện thoại trước gương (Mirror Selfie) hoặc khoe Outfit (Outfit Check).
    - 5 tuỳ chọn cụ thể cần viết:
      1. Mirror Selfie (Mô tả người mẫu cầm điện thoại quay trước gương, lắc nhẹ người, nghiêng đầu dễ thương).
      2. Outfit Check (Mô tả camera zoom nhẹ vào chi tiết quần áo, người mẫu vuốt tóc hoặc chỉnh áo).
      3. Gen Z Pose (Tạo dáng ngầu, che mặt một chút hoặc nháy mắt, chuyển động tự nhiên).
      4. Tóc Hông (Xoay ngang hông vuốt tóc nhẹ nhàng).
      5. Playful (Vui vẻ, nghiêng 1 chút mặt, năng lượng tích cực).

    NHIỆM VỤ 2:  Đóng vai một TikToker/Reviewer thời trang Gen Z nổi tiếng. 
    Hãy viết 2 kịch bản voiceover ngắn (khoảng 35s) để bán sản phẩm, trang phục trong ảnh.
    
    YÊU CẦU ĐẶC BIỆT VỀ NGÔN NGỮ (RẤT QUAN TRỌNG):
    1. TUYỆT ĐỐI KHÔNG SỬ DỤNG TIẾNG ANH (No English words allowed). 
       Lý do: AI đọc giọng Việt sẽ bị lỗi khi gặp từ tiếng Anh.
    2. Phải thay thế các từ tiếng Anh bằng từ lóng tiếng Việt tương đương nhưng vẫn giữ chất Gen Z:
       - Thay "Outfit" -> "bộ cánh này", "set đồ này", "em này".
       - Thay "Slay" -> "đỉnh của chóp", "u là trời", "keo lỳ", "đỉnh nóc kịch trần".
       - Thay "Check" -> "soi", "ngắm nghía".
       - Thay "Mix match" -> "lên đồ", "phối đồ".
       - Thay "Sale" -> "săn deal", "giá hời".
    3. Giọng điệu hào hứng, tự nhiên: "mấy bà ơi", "chấn động", "tôn dáng xỉu", "hack chân cực đỉnh", "chốt đơn lẹ", "mê chữ ê kéo dài", "nhức nách", "hết nước chấm".

    ĐỊNH DẠNG ĐẦU RA (JSON BẮT BUỘC):
    {
      "videoPrompts": ["Prompt 1...", "Prompt 2...", "Prompt 3...", "Prompt 4...", "Prompt 5..."],
      "voiceoverScripts": ["Lời thoại 1...", "Lời thoại 2..."]
    }
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
        responseMimeType: "application/json"
      }
    });

    const text = response.text;
    if (!text) return { videoPrompts: ["Failed to generate."], voiceoverScripts: [] };

    try {
      const cleanedText = text.replace(/```json|```/g, '').trim();
      const json = JSON.parse(cleanedText);
      
      const videoPrompts = Array.isArray(json.videoPrompts) ? json.videoPrompts.map((s: any) => String(s)) : [];
      const voiceoverScripts = Array.isArray(json.voiceoverScripts) ? json.voiceoverScripts.map((s: any) => String(s)) : [];

      return { videoPrompts, voiceoverScripts };
    } catch (e) {
      console.warn("Failed to parse JSON prompt response", e);
      return { videoPrompts: ["Error parsing response"], voiceoverScripts: [] };
    }

  } catch (error: any) {
    console.error("Video Content Generation Error:", error);
    return { videoPrompts: [`Lỗi: ${error.message}`], voiceoverScripts: [] };
  }
};

// NEW: Generate Audio (EverAI)
export const generateSpeech = async (text: string, _voiceName: string): Promise<string> => {
  try {
    // 1. Create Request using Relative Proxy Path
    const response = await fetch(`${PROXY_BASE_URL}/v1/text-to-speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': EVERAI_API_KEY
      },
      body: JSON.stringify({
        text: text,
        voice_code: EVERAI_VOICE_CODE,
        speed: 1
      })
    });

    if (!response.ok) {
        let errText = await response.text();
        try {
            // Try to parse error json if possible
            const errJson = JSON.parse(errText);
            errText = errJson.message || errJson.error || errText;
        } catch(e) {}
        throw new Error(`EverAI API Error (${response.status}): ${errText}`);
    }

    const data = await response.json();
    
    // Check if it returns a file_url directly
    if (data.file_url || (data.data && data.data.file_url)) {
        const url = data.file_url || data.data.file_url;
        // NOTE: The URL returned might be absolute (https://...). 
        // We usually can't fetch it directly due to CORS unless EverAI allows it.
        // If it fails, we might need to proxy the download too. 
        // For now, let's try direct, and if it fails, the user might need to use a simple "Open Link" instead.
        // Or we route it through our proxy if it matches the everai domain.
        return await fetchAudioAsBase64(url);
    }
    
    // If it returns an ID, we poll
    const requestId = data.id || data.request_id;
    if (!requestId) {
        throw new Error("Không tìm thấy ID request hoặc URL audio từ EverAI.");
    }

    // 2. Poll for Result
    const audioUrl = await pollEverAIResult(requestId);
    
    // 3. Download and convert to Base64
    return await fetchAudioAsBase64(audioUrl);

  } catch (error: any) {
    console.error("EverAI TTS Error:", error);
    throw new Error(error.message || "Lỗi tạo giọng nói EverAI.");
  }
};

// Helper: Poll EverAI Request Status
async function pollEverAIResult(requestId: string, maxAttempts = 15, intervalMs = 2000): Promise<string> {
    for (let i = 0; i < maxAttempts; i++) {
        await new Promise(r => setTimeout(r, intervalMs));
        
        try {
            // Use relative path for polling too
            const response = await fetch(`${PROXY_BASE_URL}/requests/${requestId}`, {
                method: 'GET',
                headers: { 'x-api-key': EVERAI_API_KEY }
            });
            
            if (response.ok) {
                const data = await response.json();
                
                // Success cases
                if (data.status === 'success' || data.status === 'done' || data.status === 'completed') {
                     if (data.file_url) return data.file_url;
                     if (data.data && data.data.file_url) return data.data.file_url;
                }
                // Failure cases
                if (data.status === 'failed' || data.status === 'error') {
                    throw new Error("EverAI xử lý thất bại.");
                }
            }
        } catch (e) {
            console.warn("Polling error", e);
        }
    }
    throw new Error("Timeout: EverAI xử lý quá lâu.");
}

// Helper: Fetch Audio URL and convert to Base64
async function fetchAudioAsBase64(url: string): Promise<string> {
    // If the URL is absolute and CORS blocks it, we might need to proxy it.
    // However, usually signed URLs from S3/GCS allow CORS. 
    // If it is from api.everai.vn, we might need to strip and proxy.
    let fetchUrl = url;
    if (url.includes('api.everai.vn')) {
        // Simple heuristic: route through our proxy if it's the API domain
        fetchUrl = url.replace('https://api.everai.vn', PROXY_BASE_URL);
    }

    const response = await fetch(fetchUrl);
    if (!response.ok) throw new Error("Không thể tải file audio.");
    
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64Data = reader.result as string;
            // Return raw base64 (remove data prefix)
            const rawBase64 = base64Data.split(',')[1];
            resolve(rawBase64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}