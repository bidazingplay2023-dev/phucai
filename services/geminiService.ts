
import { GoogleGenAI } from "@google/genai";
import { AppConfig, ProcessedImage, GarmentType, GeneratedImage } from "../types";
import { blobToBase64, fileToBase64, base64ToBlob } from "./utils";

// Model for Image Tasks
const IMAGE_MODEL_NAME = 'gemini-2.5-flash-image';
// Model for Basic Text Tasks
const TEXT_MODEL_NAME = 'gemini-3-flash-preview';

/**
 * GUIDELINE COMPLIANCE:
 * The API key must be obtained exclusively from the environment variable process.env.API_KEY.
 * The application must not ask the user for it under any circumstances.
 */

// --- NEW: VALIDATE API KEY (Updated to use process.env.API_KEY) ---
export const validateApiKey = async (apiKey: string): Promise<boolean> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    await ai.models.generateContent({
      model: TEXT_MODEL_NAME,
      contents: "hi",
    });
    return true;
  } catch (error) {
    console.error("API Key Validation Failed:", error);
    return false;
  }
};

// GIAI ĐOẠN 1 CỦA BƯỚC 1: Tách nền sản phẩm (GHOST MANNEQUIN)
export const isolateProductImage = async (productImageBlob: Blob, garmentType: GarmentType = 'FULL'): Promise<GeneratedImage> => {
  try {
    // Initializing with process.env.API_KEY directly
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
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

    // Convert Blob to Base64 for API
    const base64Data = await blobToBase64(productImageBlob);

    const response = await ai.models.generateContent({
      model: IMAGE_MODEL_NAME,
      contents: {
        parts: [
          { inlineData: { mimeType: "image/png", data: base64Data } },
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
          // Convert Result Base64 to Blob
          const blob = base64ToBlob(part.inlineData.data, "image/png");
          const previewUrl = URL.createObjectURL(blob);
          return { blob, previewUrl };
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
  isolatedProductBlob: Blob,
  modelImage: ProcessedImage,
  config: AppConfig
): Promise<GeneratedImage> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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

KẾT QUẢ: Một bức ảnh hài hòa, nơi trang phục và phụ kiện ăn nhập with nhau (do AI tự đánh giá và quyết định).
    `;

    if (config.enableMannequin) {
      promptText += `
      - Tạo thêm một ma nơ canh đứng cạnh người mẫu, mặc cùng bộ trang phục này.
      `;
    }

    const isolatedBase64 = await blobToBase64(isolatedProductBlob);
    const modelBase64 = await fileToBase64(modelImage.file);

    const contents = {
      parts: [
        { text: "ẢNH 1 (SẢN PHẨM MỚI):" },
        { inlineData: { mimeType: "image/png", data: isolatedBase64 } },
        { text: "ẢNH 2 (NGƯỜI MẪU GỐC):" },
        { inlineData: { mimeType: "image/png", data: modelBase64 } },
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
          const blob = base64ToBlob(part.inlineData.data, "image/png");
          const previewUrl = URL.createObjectURL(blob);
          return { blob, previewUrl };
        }
      }
    }
    throw new Error("AI không trả về hình ảnh nào.");
  } catch (error: any) {
    console.error("Gemini Try-On Error:", error);
    throw new Error(error.message || "Lỗi xử lý ảnh.");
  }
};

// Define the expert prompts for each style
export const STYLE_PROMPTS: Record<string, string> = {
  "Retro (Home Studio)": `
    STRICT OUTPUT REQUIREMENT: Generate exactly 3 detailed paragraphs corresponding to:
    1. Living Room Corner (Góc Sofa)
    2. Window Area (Bên Cửa Sổ)
    3. Concrete Wall (Tường Bê Tông)

    --- MASTER STYLE ---
    - VIBE: Modern City Apartment, Soft Industrial & Korean Minimalist.
    - LIGHTING: Soft natural daylight, sun-drenched, cinematic shadows.
    - TECH: Shot on 35mm film, soft focus, high resolution, vintage grain.

    --- SCENE DETAILS ---
    1. (Living Room Corner): A beige curved sofa against a raw concrete wall, scattered indie fashion magazines, a sheepskin rug. Lived-in and cozy.
    2. (Window Area): Standing next to large floor-to-ceiling windows with sheer white curtains. Soft golden hour light flooding in, creating a dreamy silhouette backdrop.
    3. (Concrete Wall): A textured raw concrete wall corner with a retro standing lamp and a vinyl record player. Minimalist but artsy background.
  `,

  "Đơn Giản (Modern Warm)": `
    STRICT OUTPUT REQUIREMENT: Generate exactly 3 detailed paragraphs corresponding to:
    1. Bedroom (Phòng Ngủ)
    2. Living Room (Phòng Khách)
    3. Aesthetic Wall Corner (Góc Tường)

    --- MASTER STYLE ---
    - VIBE: Warm, inviting, "lived-in" modern home, high-end but cozy.
    - LIGHTING: Golden hour sunlight mixed with warm indoor lamps.
    - TECH: 85mm portrait lens, shallow depth of field (Bokeh), photorealistic.

    --- SCENE DETAILS ---
    1. (Bedroom): Focus on a cozy bed with messy cream linens. Background features a sleek glass fashion cabinet (blurred) to add depth.
    2. (Living Room): A modern lounge area with a soft rug, warm oak flooring, and a coffee table. Sunlight streaming through sheer curtains.
    3. (Wall Corner): A clean corner featuring a textured plaster wall, a large leaning floor mirror, and a single decorative vase.
  `,

  "Shop Thời Trang (Chow)": `
    STRICT OUTPUT REQUIREMENT: Generate exactly 3 detailed paragraphs corresponding to:
    1. Display Area (Kệ Trưng Bày)
    2. Fitting Room (Phòng Thay Đồ)
    3. Brand Corner (Góc Thương Hiệu)

    --- MASTER STYLE ---
    - REALISM: Hyper-realistic interior photography, 8k resolution, raw photo style, architectural digest aesthetic. NO plastic/3D render look.
    - VIBE: Modern, sophisticated multi-brand boutique. Clean lines, neutral tones (White/Grey/Metallic) to highlight the clothes.
    - CLOTHING: Rails filled with a DIVERSE collection of female fashion (various colors, textures, lengths, and styles).
    - LIGHTING: Mix of natural window light and professional track lighting, creating realistic shadows and highlights.

    --- SCENE DETAILS ---
    1. (Display Area): A main aisle view featuring elegant brushed-gold clothing racks on both sides. The racks are stocked with a colorful variety of women's dresses, blazers, and shirts. The floor is polished concrete or marble, reflecting the clothes realistically.
    2. (Fitting Room): A chic fitting room area with heavy textured velvet curtains (in a neutral color like beige or charcoal), a large high-clarity full-body mirror, and a plush rug. The lighting is flattering and soft.
    3. (Brand Corner): A stylish feature wall (textured stone or wood paneling) with the brand name "Chow" in a sleek metallic finish (Silver or Gold). Next to it, a mannequin wearing a trendy outfit and some potted plants for a natural touch.
  `
};

// Step 2: Suggest Backgrounds (Uses Flash text model)
export const suggestBackgrounds = async (imageBlob: Blob, styleKey: string = "Retro (Home Studio)"): Promise<string[]> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Get the expert prompt based on selection (fallback to first one)
    const expertContext = STYLE_PROMPTS[styleKey] || STYLE_PROMPTS["Retro (Home Studio)"];

    const prompt = `
      You are a Creative Director for a fashion brand.
      Based on this image (which I will use as a reference), generate 3 distinct background descriptions for a photoshoot.
      
      THEME & STYLE REQUIRED:
      ${expertContext}

      OUTPUT REQUIREMENT:
      - Return ONLY a JSON Array of 3 strings (English).
      - Each string must be a highly detailed image generation prompt.
      - Do NOT include markdown code blocks (like \`\`\`json). Just the raw array.
    `;

    const base64Data = await blobToBase64(imageBlob);

    const response = await ai.models.generateContent({
      model: TEXT_MODEL_NAME,
      contents: {
        parts: [
           { inlineData: { mimeType: "image/png", data: base64Data } },
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
        return json.map((item: any) => String(item).trim());
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
    return ["Nền màu be tối giản", "Đường phố thành thị", "Nội thất sang trọng"];
  }
};

// Step 2: Change Background
export const changeBackground = async (
  baseImageBlob: Blob,
  prompt: string,
  backgroundImage?: ProcessedImage | null
): Promise<GeneratedImage> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    let finalPrompt = `
      Nhiệm vụ: Thay đổi bối cảnh (background).
      Yêu cầu: 
      - Xác định người mẫu và trang phục từ ẢNH GỐC để tách ra sau đó thay nền phía sau bằng: ${prompt}.
      - Tỉ lệ ảnh: 9:16.
      Lưu ý: Giữ nguyên khuôn mặt của người mẫu tuyệt đối không thay đổi khuôn mặt người mẫu
    `;

    const base64Data = await blobToBase64(baseImageBlob);

    const parts: any[] = [
      { text: "ẢNH GỐC:" },
      { inlineData: { mimeType: "image/png", data: base64Data } }
    ];

    if (backgroundImage) {
      finalPrompt = `
        Nhiệm vụ: Ghép người mẫu vào nền mới.
        Xác định người mẫu và trang phục từ ẢNH GỐC để tách ra sau đó thay nền phía sau bằng: ẢNH NỀN MỚI này
        + Xử lý bóng đổ và ánh sáng chân thực.
        Lưu ý: Giữ nguyên khuôn mặt của người mẫu tuyệt đối không thay đổi khuôn mặt người mẫu
      `;
      const bgBase64 = await fileToBase64(backgroundImage.file);
      parts.push({ text: "ẢNH NỀN MỚI:" });
      parts.push({ inlineData: { mimeType: "image/png", data: bgBase64 } });
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
           const blob = base64ToBlob(part.inlineData.data, "image/png");
           const previewUrl = URL.createObjectURL(blob);
           return { blob, previewUrl };
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
export const generateVideoPrompt = async (
  imageBlob: Blob,
  fabricInfo?: string,
  detailInfo?: string
): Promise<{ videoPrompts: string[], voiceoverScripts: string[] }> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

    // --- 1. KHAI BÁO BIẾN RANDOM ---
    const PERSONAS = [
      "Bạn thân Gen Z (Vibe thân thiện): Dùng từ trẻ trung, năng lượng cao, xưng tui-bà.",
      "Chuyên gia Review (Vibe khó tính): Tập trung độ bền, kỹ thuật may, thực dụng.",
      "Stylist (Vibe sang chảnh): Tư vấn phối đồ, thẩm mỹ, tôn dáng.",
      "Storyteller (Vibe cảm xúc): Dùng so sánh, ẩn dụ tả cảm giác mặc.",
      "Thợ săn sale (Vibe nhanh gọn): Tập trung tính ứng dụng và độ hời."
    ];

    const ANGLES = [
      "Góc độ: Hack dáng & Che khuyết điểm.",
      "Góc độ: Soi chi tiết chất liệu & Cảm giác.",
      "Góc độ: Tính ứng dụng thực tế (Mặc đi đâu).",
      "Góc độ: Thần thái & Cảm xúc.",
      "Góc độ: So sánh & Phản biện."
    ];

    const HOOKS = [
      "Mở đầu: Câu hỏi nghi vấn/thách thức.",
      "Mở đầu: Cảnh báo/Ngăn cản ngược.",
      "Mở đầu: So sánh hài hước.",
      "Mở đầu: Đánh vào nỗi sợ (béo, đen, già).",
      "Mở đầu: Fact check/Sự thật bất ngờ."
    ];

    // --- 2. XỬ LÝ DỮ LIỆU ĐẦU VÀO ---
    const fabricInstruction = fabricInfo 
      ? `THÔNG TIN CHẤT LIỆU (User cung cấp): "${fabricInfo}". -> HÃY DÙNG THÔNG TIN NÀY. Biến tấu theo vai diễn (Gen Z tả độ mát/êm, Chuyên gia gọi tên chất vải).`
      : `KHÔNG CÓ THÔNG TIN CHẤT LIỆU. -> TỰ QUAN SÁT ẢNH. Chỉ dùng từ chỉ cảm quan (bóng, rủ, dày dặn). CẤM bịa tên vải (lụa, gấm) nếu không chắc chắn.`;

    const detailInstruction = detailInfo
      ? `THÔNG TIN CHI TIẾT (User cung cấp): "${detailInfo}". -> HÃY LỒNG GHÉP VÀO LỜI THOẠI. (Ví dụ: Nếu có "mút ngực" -> Khen tiện lợi, không lo lộ. Nếu có "buộc eo" -> Khen hack dáng). Đừng liệt kê, hãy khen tự nhiên.`
      : `KHÔNG CÓ CHI TIẾT ĐẶC BIỆT. -> TỰ QUAN SÁT FORM DÁNG TRÊN ẢNH để bình luận.`;

    // --- 3. Randomize Context ---
    const p = PERSONAS[Math.floor(Math.random() * PERSONAS.length)];
    const a = ANGLES[Math.floor(Math.random() * ANGLES.length)];
    const h = HOOKS[Math.floor(Math.random() * HOOKS.length)];
    
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
    NHIỆM VỤ 2: Viết 2 Kịch bản Voiceover Tiếng Việt (Độ dài 100-110 từ/kịch bản - Đủ 30s):
    - VAI DIỄN: ${p}
    - GÓC NHÌN: ${a}
    - HOOK ĐẦU: ${h}

    DỮ LIỆU SẢN PHẨM:
    ${fabricInstruction}
    ${detailInstruction}

    ⚠️ LUẬT AN TOÀN & VĂN PHONG (BẮT BUỘC):
    1. NO ENGLISH: Cấm tuyệt đối dùng từ tiếng Anh chêm vào (Zoom, Mix, Match, Set, Items...). Phải dùng thuần Việt (Soi kỹ, Phối đồ, Bộ này, Món đồ...).
    2. CÁCH DÙNG DATA: Nếu có thông tin người dùng cung cấp, hãy ưu tiên sử dụng nó để tăng độ chính xác. Nếu không, hãy dùng chế độ quan sát ảnh an toàn.
    3. VĂN PHONG: Tự nhiên, đời thường, dùng từ đệm (nha, nhỉ, á, trộm vía). Cấm văn mẫu sáo rỗng.

    OUTPUT JSON:
    {
      "videoPrompts": ["...", "..."],
      "voiceoverScripts": ["Kịch bản 1...", "Kịch bản 2..."]
    }
    `;

    const base64Data = await blobToBase64(imageBlob);

    const response = await ai.models.generateContent({
      model: TEXT_MODEL_NAME,
      contents: {
        parts: [
           { inlineData: { mimeType: "image/png", data: base64Data } },
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
               const errText = await createResp.text().catch(() => createResp.statusText);
               throw new Error(`HTTP Error ${createResp.status}: ${errText}`);
            }

            createData = await createResp.json();
            break; // Success
        } catch (e) {
            console.warn(`Everai POST attempt ${i+1} failed:`, e);
            createError = e;
            await new Promise(r => setTimeout(r, 1000));
        }
    }

    if (!createData) {
        throw createError || new Error("Không thể kết nối đến máy chủ Everai (Failed to fetch).");
    }
    
    if (createData.status !== 1) {
        throw new Error(createData.error_message || "Lỗi không xác định từ Server Everai");
    }

    const requestId = createData.result?.request_id;
    if (!requestId) {
       throw new Error("Không tìm thấy request_id trong phản hồi thành công");
    }

    // BƯỚC 2: Polling kết quả
    const MAX_TIME = 120000; // 2 phút timeout
    const startTime = Date.now();
    
    while (Date.now() - startTime < MAX_TIME) {
       await new Promise(r => setTimeout(r, 2000));
       
       let statusBody;
       try {
           const statusResp = await fetch(`${PROXY_URL}/${requestId}`, {
               headers: { 'Accept': 'application/json' }
           });
           
           if (!statusResp.ok) {
               console.warn(`Polling HTTP Error ${statusResp.status}`);
               continue;
           }
           statusBody = await statusResp.json();
       } catch (netErr) {
           console.warn("Polling Network Error (Failed to fetch), retrying...", netErr);
           continue;
       }
       
       if (statusBody.status !== 1) {
           throw new Error(statusBody.error_message || "Lỗi khi kiểm tra trạng thái");
       }

       const resultData = statusBody.result;
       const processStatus = resultData?.status;
       
       if (processStatus === 'done' || processStatus === 'success') {
           const audioUrl = resultData.audio_link || resultData.url || resultData.audio_url; 
           if (!audioUrl) throw new Error("Trạng thái DONE nhưng không thấy link Audio");
           return audioUrl;
       }
       
       if (processStatus === 'failed' || processStatus === 'error') {
           throw new Error("Server báo lỗi: Quá trình tạo audio thất bại.");
       }
    }
    
    throw new Error("Hết thời gian chờ (Timeout) sau 120s");

  } catch (error: any) {
    console.error("Everai TTS Logic Error:", error);
    throw error;
  }
};
