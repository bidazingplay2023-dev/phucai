
import { GoogleGenAI } from "@google/genai";
import { AppConfig, ProcessedImage } from "../types";
import { blobToBase64 } from "./utils";

// REVERT: Back to Gemini 2.5 Flash Image as requested
const IMAGE_MODEL_NAME = 'gemini-2.5-flash-image';
// Model for Text Analysis
const TEXT_MODEL_NAME = 'gemini-3-flash-preview';

// --- API KEY HELPER ---
const getApiKey = (): string => {
  const key = localStorage.getItem('GOOGLE_API_KEY');
  if (!key) {
    throw new Error("Vui lòng nhập Google API Key trong phần Cài đặt (Icon Chìa khóa).");
  }
  return key;
};

// --- MIME TYPE HELPER (ROBUST) ---
const getMimeType = (file: File): string => {
  // 1. Trust browser if available and valid
  if (file && file.type) return file.type;
  
  // 2. Fallback to filename extension
  if (file && file.name) {
      const name = file.name.toLowerCase();
      if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg';
      if (name.endsWith('.webp')) return 'image/webp';
      if (name.endsWith('.png')) return 'image/png';
  }
  
  // 3. Ultimate Fallback (Gemini handles PNG/JPEG leniency well)
  return 'image/png';
};

// --- NEW: VALIDATE API KEY ---
export const validateApiKey = async (apiKey: string): Promise<boolean> => {
  try {
    const ai = new GoogleGenAI({ apiKey: apiKey });
    // Gọi thử một request cực nhẹ (ví dụ: chào 'hi') để xem key có hoạt động không
    await ai.models.generateContent({
      model: TEXT_MODEL_NAME,
      contents: { parts: [{ text: "hi" }] },
    });
    return true;
  } catch (error) {
    console.error("API Key Validation Failed:", error);
    return false;
  }
};

// GIAI ĐOẠN 1 CỦA BƯỚC 1: Tách nền sản phẩm
export const isolateProductImage = async (productImageBase64: string): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    
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
    const ai = new GoogleGenAI({ apiKey: getApiKey() });

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
        { inlineData: { mimeType: getMimeType(modelImage.file), data: modelImage.base64 } },
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
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    
    const prompt = `
      "Bạn là Giám đốc Hình ảnh cho một thương hiệu thời trang thiết kế trẻ trung (local brand). Hãy lên ý tưởng cho 3 bối cảnh chụp ảnh lookbook tại nhà (home-studio vibe).
      Bối cảnh chung (The Vibe): Một căn hộ chung cư cao tầng hiện đại (Modern City Apartment) với phong cách Soft Industrial & Korean Minimalist. Không gian phải sáng sủa, gọn gàng, có gu nhưng gần gũi, không quá xa hoa hào nhoáng.
      + Vẫn giữ các yếu tố đặc trưng: Tường bê tông sáng màu hoặc trát vữa (plaster), sàn gỗ ấm, và ánh sáng tự nhiên từ cửa sổ.
      Nhiệm vụ: Gợi ý 3 góc chụp đời thường (lifestyle corners) khác nhau trong căn hộ này.
      + Quan trọng: Các không gian phải được trang trí theo lối sống thực tế (lived-in), có các đồ vật decor mềm mại như thảm lông, rèm voan, gương toàn thân, tạp chí, cốc cafe... để tạo cảm giác gần gũi.
      Yêu cầu đầu ra:
      - Chỉ trả về một JSON Array chứa 3 chuỗi string bằng Tiếng Anh.
      - Các mô tả cần chi tiết, giàu hình ảnh và không khí (không giới hạn số từ).
      Ví dụ output mong muốn (Mô tả kiểu gần gũi): ["A cozy living room corner with a grey fabric sofa, a textured concrete wall softened by a beige rug and a standing lamp, natural light coming from the balcony.", "A bright bedroom setup with a white messy bed, a large leaning floor mirror reflecting the window view, and some fashion magazines on the floor.", "A clean aesthetic workspace area with a wooden desk, a grid moodboard on the concrete wall, and a pot of monstera plant receiving sunlight."]"
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
      // Clean potential markdown blocks if API returns ```json ... ```
      const cleanedText = text.replace(/```json|```/g, '').trim();
      const json = JSON.parse(cleanedText);
      if (Array.isArray(json)) {
        return json.map(item => String(item).trim());
      }
      return ["Studio phông trắng", "Đường phố hiện đại", "Quán cafe sang trọng"];
    } catch (e) {
      console.warn("JSON Parse Error for suggestions", e);
      // Fallback parser if JSON fails
      return text.split('\n')
        .map(line => line.replace(/^\d+[\.\)]\s*|-\s*/, '').trim())
        .filter(line => line.length > 0 && line.length < 50 && !line.includes("Dưới đây"))
        .slice(0, 3);
    }
  } catch (error) {
    console.error("Suggestion Error:", error);
    // Return defaults if API key is missing or other error, but user should be prompted for key by UI handling
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
    const ai = new GoogleGenAI({ apiKey: getApiKey() });

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
      parts.push({ inlineData: { mimeType: getMimeType(backgroundImage.file), data: backgroundImage.base64 } });
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
export const generateVideoPrompt = async (imageBase64: string): Promise<{ videoPrompts: string[], voiceoverScripts: string[] }> => {
  try {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    
    const prompt = `
    Phân tích kỹ dữ liệu thị giác của bức ảnh để thực hiện 2 nhiệm vụ sau:

    NHIỆM VỤ 1: Viết 5 Video Prompts (Image-to-Video) - CHẾ ĐỘ "IDLE MOTION"
    - MỤC TIÊU: Tạo video "Living Photo" (Ảnh động). Người mẫu đứng yên, giữ nguyên khung hình gốc 100%.
    - QUY TẮC LOGIC (LOGIC GATE):
      1. XÁC ĐỊNH CAMERA (BẮT BUỘC):
        - Nếu ảnh Mirror Selfie (Cầm điện thoại) -> Dùng cụm từ: "Handheld static camera, mirror selfie".
        - Nếu ảnh Chụp thường (Không cầm điện thoại) -> Dùng cụm từ: "Tripod static camera, POV looking at camera".
      2. XÁC ĐỊNH NEO CƠ THỂ (BODY ANCHOR):
        - Nếu ảnh Toàn thân -> Dùng: "Feet glued to the floor" (Chân dính sàn).
        - Nếu ảnh Bán thân -> Dùng: "Torso fixed in place" (Thân trên cố định).
    - 5 OUTPUTS (Tiếng Anh - Bắt đầu mỗi prompt bằng cụm từ Camera đã xác định ở trên):
      1. The Breathing Pose (Start with determined Camera phrase. Body Anchor applied. Model stands absolutely still. Only natural breathing and subtle eye blinking visible. Maintains original framing).
      2. The Tiny Tilt (Start with determined Camera phrase. Body Anchor applied. Model stands in place. Slowly tilts head 5 degrees to the side, looking cute/cool. No body movement).
      3. Hair Tuck Idle (Start with determined Camera phrase. Body Anchor applied. Model remains stationary. Uses free hand to gently tuck hair behind ear or smooths hair. No sudden moves).
      4. Hip Shift Minimal (Start with determined Camera phrase. Body Anchor applied. Very subtle weight shift on hips without lifting feet/moving torso. A relaxed, waiting pose).
      5. Interaction Check (Start with determined Camera phrase. Body Anchor applied. Model stands still. Glances down at the center of their outfit for 1 second, then looks up and smiles softly).
    NHIỆM VỤ 2: Viết Kịch bản Voiceover Tiếng Việt - STYLE "BẠN THÂN GEN Z"
    - YÊU CẦU: Viết 2 kịch bản (35s) giọng văn nói tự nhiên, đời thường.
    - PHONG CÁCH (BESTIE TONE):
      + Đóng vai bạn thân mách nhỏ, giọng điệu rủ rỉ, gần gũi.
      + Dùng từ ngữ nói chuyện hàng ngày, không văn vở máy móc. Thêm các từ đệm tự nhiên như: "kiểu là", "thề luôn", "trộm vía", "ta nói...", "mấy bà coi nè".
    - QUY TẮC AN TOÀN:
    - LUẬT AN TOÀN CHẤT LIỆU: KHÔNG bịa tên chất liệu. CHỈ tả cảm giác.
    + Không dùng Tiếng Anh.
    - LUẬT CẤM TỪ LAI CĂNG:
      + Cấm: "Set", "Mix", "Match", "Size", "Form", "Item".
      + Thay bằng: "Bộ này", "phối", "cỡ", "dáng/phom", "món này".
    - QUY TRÌNH NỘI DUNG:
      + Style Dễ thương/Sexy/Sang trọng -> Chọn từ vựng tương ứng.
      + Dáng Rộng/Ôm/Basic -> Chọn vấn đề tương ứng (Che bụng/Tôn dáng/Tiện lợi).
    - CẤU TRÚC:
      + Kịch bản 1 (Tâm sự): Kể về việc tìm ra món đồ này như một sự tình cờ thú vị, chia sẻ cảm giác thật khi mặc.
      + Kịch bản 2 (Rủ rê): Kêu gọi bạn bè mua chung để đi chơi, nhấn mạnh độ xinh xẻo của đồ.
    - ĐỊNH DẠNG ĐẦU RA (JSON BẮT BUỘC):
    {
      "videoPrompts": ["Static tripod camera, model stands in place..."],
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

// NEW: Generate Audio via Everai Proxy (Strict Polling with Retry)
export const generateEveraiSpeech = async (text: string): Promise<string> => {
  // Using Worker Proxy for CORS & Privacy
  const PROXY_URL = "https://apiproxy.coha.workers.dev/tts";
  const FIXED_VOICE_ID = "voice-e7bc94bb-b424-4a0a";

  try {
    // BƯỚC 1: Gửi Request tạo Audio (Retry up to 3 times)
    let createData;
    let createError;

    for (let i = 0; i < 3; i++) {
        try {
            const createResp = await fetch(PROXY_URL, {
              method: 'POST',
              headers: { 
                  'Content-Type': 'application/json',
                  'Accept': 'application/json' 
              },
              body: JSON.stringify({
                input_text: text,
                voice_id: FIXED_VOICE_ID,
                speed_rate: 1.0
              })
            });
            
            if (!createResp.ok) {
               // If server returns 5xx/4xx, throw to trigger retry or fail
               const errText = await createResp.text().catch(() => createResp.statusText);
               throw new Error(`HTTP Error ${createResp.status}: ${errText}`);
            }

            createData = await createResp.json();
            break; // Success
        } catch (e) {
            console.warn(`Everai POST attempt ${i+1} failed:`, e);
            createError = e;
            // Wait 1s before retry
            await new Promise(r => setTimeout(r, 1000));
        }
    }

    if (!createData) {
        throw createError || new Error("Không thể kết nối đến máy chủ Everai (Failed to fetch).");
    }
    
    // Kiểm tra Status = 1 (Thành công logic từ server)
    if (createData.status !== 1) {
        throw new Error(createData.error_message || "Lỗi không xác định từ Server Everai");
    }

    // Lấy Request ID
    const requestId = createData.result?.request_id;
    if (!requestId) {
       throw new Error("Không tìm thấy request_id trong phản hồi thành công");
    }

    // BƯỚC 2: Polling kết quả (Vòng lặp mỗi 2 giây)
    const MAX_TIME = 120000; // 2 phút timeout
    const startTime = Date.now();
    
    while (Date.now() - startTime < MAX_TIME) {
       await new Promise(r => setTimeout(r, 2000)); // Chờ 2 giây
       
       let statusBody;
       try {
           const statusResp = await fetch(`${PROXY_URL}/${requestId}`, {
               headers: { 'Accept': 'application/json' }
           });
           
           if (!statusResp.ok) {
               console.warn(`Polling HTTP Error ${statusResp.status}`);
               continue; // Retry on next loop
           }
           statusBody = await statusResp.json();
       } catch (netErr) {
           console.warn("Polling Network Error (Failed to fetch), retrying...", netErr);
           continue; // Retry on next loop
       }
       
       // Kiểm tra API call status
       if (statusBody.status !== 1) {
           throw new Error(statusBody.error_message || "Lỗi khi kiểm tra trạng thái");
       }

       // Kiểm tra trạng thái xử lý
       const resultData = statusBody.result;
       const processStatus = resultData?.status; // 'new', 'processing', 'done', 'failed'
       
       if (processStatus === 'done' || processStatus === 'success') {
           const audioUrl = resultData.audio_link || resultData.url || resultData.audio_url; 
           if (!audioUrl) throw new Error("Trạng thái DONE nhưng không thấy link Audio");
           
           // CHANGE: Directly return URL to avoid CORS "Failed to fetch" on client side download
           return audioUrl;
       }
       
       if (processStatus === 'failed' || processStatus === 'error') {
           throw new Error("Server báo lỗi: Quá trình tạo audio thất bại.");
       }
       
       // Nếu đang xử lý (new/processing), tiếp tục vòng lặp
    }
    
    throw new Error("Hết thời gian chờ (Timeout) sau 120s");

  } catch (error: any) {
    console.error("Everai TTS Logic Error:", error);
    throw error; // Ném lỗi gốc ra để UI hiển thị chính xác message
  }
};
