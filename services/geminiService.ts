// --- HELPER: Nén và Resize ảnh để tránh lỗi dung lượng ---
const MAX_DIMENSION = 1536;
const PROXY_URL = "https://gemini-proxy.coha.workers.dev";

export const resizeImageBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
          if (width > height) {
            height = Math.round((height * MAX_DIMENSION) / width);
            width = MAX_DIMENSION;
          } else {
            width = Math.round((width * MAX_DIMENSION) / height);
            height = MAX_DIMENSION;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error("Canvas context error"));
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        resolve(dataUrl.split(',')[1]); // Lấy phần base64
      };
    };
  });
};

// --- HÀM GỌI API QUA PROXY WORKER ---
async function callGeminiViaProxy(apiKey: string, model: string, payload: any) {
  // Đường dẫn qua Worker của bạn
  const endpoint = `${PROXY_URL}/v1beta/models/${model}:generateContent`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || "Lỗi API");
  }

  const result = await response.json();
  const base64Data = result.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData?.data;
  
  if (!base64Data) throw new Error("AI không trả về ảnh. Hãy thử lại.");
  return `data:image/png;base64,${base64Data}`;
}

// 1. Tách nền
export const isolateProduct = async (apiKey: string, imageBase64: string) => {
  const payload = {
    contents: [{
      parts: [
        { inlineData: { mimeType: "image/jpeg", data: imageBase64.split(',')[1] || imageBase64 } },
        { text: "Generate a high-quality image of JUST the main clothing item on a pure transparent-looking white background. Clean edges." }
      ]
    }]
  };
  return callGeminiViaProxy(apiKey, "gemini-2.0-flash", payload);
};

// 2. Ghép ảnh (Virtual Try-On)
export const compositeProduct = async (apiKey: string, productBase64: string, modelBase64: string) => {
  const payload = {
    contents: [{
      parts: [
        { inlineData: { mimeType: "image/jpeg", data: modelBase64.split(',')[1] || modelBase64 } },
        { inlineData: { mimeType: "image/jpeg", data: productBase64.split(',')[1] || productBase64 } },
        { text: "Photorealistic virtual try-on. Put the clothing from the second image onto the person in the first image. Natural lighting and wrinkles." }
      ]
    }]
  };
  return callGeminiViaProxy(apiKey, "gemini-2.0-flash", payload);
};

// 3. Thay đổi bối cảnh
export const replaceBackground = async (apiKey: string, imageBase64: string, prompt: string) => {
  const payload = {
    contents: [{
      parts: [
        { inlineData: { mimeType: "image/jpeg", data: imageBase64.split(',')[1] || imageBase64 } },
        { text: `Keep the person exactly as is, but change the background to: ${prompt}. Cinematic lighting.` }
      ]
    }]
  };
  return callGeminiViaProxy(apiKey, "gemini-2.0-flash", payload);
};

// 4. Render Video (Veo) - Lưu ý: Veo có endpoint khác, cần check logic Worker của bạn
export const generateSalesVideo = async (apiKey: string, imageParams: {base64: string}, config: any) => {
   throw new Error("Tính năng video cần cấu hình riêng cho Proxy. Hãy thử tính năng ảnh trước.");
};