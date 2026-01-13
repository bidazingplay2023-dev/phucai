
import { GoogleGenAI } from "@google/genai";
import { AppConfig, ProcessedImage, GarmentType } from "../types";
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

// GIAI ĐOẠN 1 CỦA BƯỚC 1: Tách nền sản phẩm (GHOST MANNEQUIN)
export const isolateProductImage = async (productImageBase64: string, garmentType: GarmentType = 'FULL'): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: getApiKey() });
    
    // STRICT GHOST MANNEQUIN PROMPT LOGIC
    let specificInstruction = "";
    
    switch (garmentType) {
      case 'TOP':
        specificInstruction = `
        - EXTRACT ONLY THE UPPER GARMENT (Shirt, Jacket, Top, Coat).
        - CUT/REMOVE completely: The Head, Neck, Hands, Arms (skin), and Lower Body (Pants/Skirts/Legs).
        - CROP: Crop tightly around the bottom hem of the shirt/top.
        - INPAINT: Reconstruct the inner neck label area and the bottom hem to make it look like a hollow ghost mannequin.
        `;
        break;
      case 'BOTTOM':
        specificInstruction = `
        - EXTRACT ONLY THE LOWER GARMENT (Pants, Skirt, Shorts, Jeans).
        - CUT/REMOVE completely: The Upper Body (Shirts/Tops), Head, Arms, and Feet/Shoes.
        - CROP: Crop tightly around the waistline.
        - INPAINT: Reconstruct the waistline area (inner waistband) to make it look like a hollow ghost mannequin.
        `;
        break;
      case 'FULL':
        specificInstruction = `
        - EXTRACT THE FULL OUTFIT (Top + Bottom connection).
        - CUT/REMOVE completely: Head, Face, Neck, Hands, Feet/Shoes, and any visible Skin.
        - KEEP: The structural connection between the top and bottom garments.
        - INPAINT: Reconstruct the neck opening and sleeve openings.
        `;
        break;
    }

    // Thay đoạn prompt cũ bằng đoạn này để ép lấy nét tối đa
    const prompt = `
      TASK: Precise Garment Extraction (High-Fidelity).
      INPUT: Raw product image.
      
      STRICT EXECUTION RULES:
      1. ACTION: ${specificInstruction}
      2. PRESERVATION (CRITICAL): 
         - Keep 100% original fabric texture, stitching, and folds. 
         - DO NOT SMOOTH or DENOISE the fabric.
         - Output in original resolution (Lossless).
      3. BACKGROUND: Remove background completely. Replace with TRANSPARENT (Alpha Channel) or PURE WHITE (#FFFFFF).
      4. COMPOSITION: Center the garment. Do not crop off any edges.
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
    Nhiệm vụ: Virtual Try-On & Auto-Harmonize (Thử đồ & Tự động cân bằng tổng thể).

Đầu vào: Ảnh 1 (Sản phẩm) + Ảnh 2 (Người mẫu).

QUY TRÌNH XỬ LÝ:

1. MẶC ĐỒ (TRY-ON):
   - Mặc sản phẩm từ Ảnh 1 lên người mẫu Ảnh 2.
   - Yêu cầu cốt lõi: Form dáng chuẩn, ánh sáng khớp môi trường.

2. ĐÁNH GIÁ & XỬ LÝ PHỤ KIỆN (GIÀY DÉP/TÚI/TRANG SỨC):
   - HÃY TỰ ĐẶT CÂU HỎI: "Phụ kiện hiện tại của người mẫu (Giày/Dép, Túi,...) có phù hợp (Matching) với bộ đồ mới mặc không?"

   - TRƯỜNG HỢP A: ĐÃ PHÙ HỢP (Good Match)
     => HÀNH ĐỘNG: GIỮ NGUYÊN ảnh gốc. Không chỉnh sửa gì thêm ở vùng chân/tay.
     (Ví dụ: Đang đi giày Sneaker và mặc bộ đồ mới cũng style năng động -> Giữ nguyên).

   - TRƯỜNG HỢP B: KHÔNG PHÙ HỢP (Style Clash/Mismatched)
     => HÀNH ĐỘNG: THAY THẾ phụ kiện đó bằng món đồ khác phù hợp nhất với trang phục mới.
     (Ví dụ: Đang đi giày thể thao hầm hố nhưng mặc váy lụa -> Thay ngay bằng giày cao gót/búp bê).

3. LƯU Ý QUAN TRỌNG KHI THAY THẾ (CLEANUP):
   - Nếu AI quyết định thay giày: Bắt buộc phải xử lý luôn phần TẤT (Socks). Nếu đổi sang giày hở chân/cao gót thì phải XÓA TẤT cũ đi.
   - Nguyên tắc: "Thà không sửa, đã sửa là phải đồng bộ".

4. BẢO TOÀN:
   - Tuyệt đối giữ nguyên khuôn mặt và bối cảnh.

KẾT QUẢ: Một bức ảnh hài hòa, nơi trang phục và phụ kiện ăn nhập với nhau (do AI tự đánh giá và quyết định).
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

    NHIỆM VỤ 1: Viết 5 Video Prompts (Image-to-Video) - CHẾ ĐỘ "CONTROLLED DRIFT" (TRÔI NHẸ)
    - MỤC TIÊU: Tạo video có chuyển động tự nhiên, nhẹ nhàng như đang "thở", không đứng im như tượng nhưng cũng không di chuyển mạnh.
    - TỪ KHÓA KIỂM SOÁT CHUYỂN ĐỘNG (SOFT LOCKS):
      1. CAMERA: Sử dụng "Slow, floating camera movement" hoặc "Gentle handheld drift" (Tạo cảm giác máy quay cầm tay rất êm, trôi nhẹ).
      2. NGƯỜI MẪU: Sử dụng "Subtle body sway" (Lắc lư cơ thể nhẹ) hoặc "Soft weight shift" (Dồn trọng tâm nhẹ).
      3. GIỚI HẠN BIÊN ĐỘ: Luôn kèm từ khóa "Minimal movement", "Slow motion", "No sudden moves" để kìm hãm AI không làm quá đà.
    - 4. LOGIC ĐIỆN THOẠI:
        - Có cầm điện thoại -> Dùng "Mirror selfie", "looking at phone".
        - Không cầm điện thoại -> Dùng "POV looking at camera".
    - 5 OUTPUTS (Tiếng Anh - Mô tả chuyển động tinh tế):
      1. The Gentle Float (Slow floating camera. Model sways body very slightly to the rhythm, looking confident. Minimal movement, keeping focus on the outfit).
      2. Soft Hair Play (Gentle handheld drift. Model tilts head slowly and tucks hair behind ear. The movement is smooth and slow, not jerky).
      3. The "Vibe" Check (Slow camera drift. Model shifts weight gently from one hip to the other, checking out their fit in the mirror/camera. Relaxed atmosphere).
      4. Angle Shift (Floating camera moves slightly around the model (very small arc). Model turns head slowly to follow the camera. Controlled motion).
      5. The Closer Look (Camera slowly drifts a bit closer (no zoom, just drift). Model looks down at their outfit then looks up and smiles. Smooth transition).
    NHIỆM VỤ 2: Viết Kịch bản Voiceover Tiếng Việt (LOGIC THÔNG MINH + TỰ NHIÊN)
    - YÊU CẦU: Viết 2 kịch bản (35s) bán hàng, tuyệt đối không dùng tiếng Anh.
    - PHONG CÁCH: Văn nói tự nhiên (đời thường), ngắt nghỉ bằng dấu câu chuẩn.
    - LUẬT CẤM TỪ LAI CĂNG:
      + Cấm: "Set", "Mix", "Match", "Size", "Form", "Item".
      + Thay bằng: "Bộ này", "phối", "cỡ", "dáng/phom", "món này".
    - LUẬT AN TOÀN CHẤT LIỆU: KHÔNG bịa tên chất liệu. CHỈ tả cảm giác.
    - LOGIC NỘI DUNG:
      + Style (Dễ thương/Cá tính/Sang trọng) -> Chọn từ vựng.
      + Dáng (Rộng/Ôm/Basic) -> Chọn nỗi đau (Che bụng/Khoe dáng/Tiện lợi).
    - CẤU TRÚC:
      + Kịch bản 1 (Tâm sự): Kể về việc tìm ra món đồ này như một sự tình cờ thú vị, chia sẻ cảm giác thật khi mặc.
      + Kịch bản 2 (Rủ rê): Kêu gọi bạn bè mua chung để đi chơi, nhấn mạnh độ xinh xẻo của đồ.
    - ĐỊNH DẠNG ĐẦU RA (JSON BẮT BUỘC):
    {
      "videoPrompts": ["Slow floating camera...", "Gentle handheld drift..."],
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
