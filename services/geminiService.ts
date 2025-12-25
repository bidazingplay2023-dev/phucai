// CẤU HÌNH PROXY (Thay link này bằng link Cloudflare Worker của bạn)
const PROXY_URL = "https://gemini-proxy.coha.workers.dev/"; 

// Helper: Nén ảnh để không bị quá dung lượng bản Free
const resizeImage = (base64Str: string): Promise<string> => {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const MAX_WIDTH = 1024; // Tối ưu cho Gemini Flash
      let width = img.width;
      let height = img.height;
      if (width > MAX_WIDTH) {
        height *= MAX_WIDTH / width;
        width = MAX_WIDTH;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.8).split(',')[1]);
    };
  });
};

const callGemini = async (apiKey: string, payload: any) => {
  const response = await fetch(`${PROXY_URL}/v1beta/models/gemini-2.0-flash:generateContent`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': apiKey
    },
    body: JSON.stringify(payload)
  });
  
  const data = await response.json();
  if (!response.ok) throw new Error(data.error?.message || "Lỗi API");
  
  const base64Data = data.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData)?.inlineData?.data;
  if (!base64Data) throw new Error("AI không trả về hình ảnh. Thử lại nhé!");
  return `data:image/jpeg;base64,${base64Data}`;
};

// CHỨC NĂNG 1: THỬ ĐỒ THÔNG MINH (Gộp tách nền + ghép)
export const smartFitAI = async (apiKey: string, personImg: string, clothImg: string) => {
  const pBase64 = await resizeImage(personImg);
  const cBase64 = await resizeImage(clothImg);
  
  const payload = {
    contents: [{
      parts: [
        { inlineData: { mimeType: "image/jpeg", data: pBase64 } },
        { inlineData: { mimeType: "image/jpeg", data: cBase64 } },
        { text: "Hãy tách sản phẩm quần áo ở ảnh thứ 2 và ghép trực tiếp vào người mẫu ở ảnh thứ 1. Giữ nguyên ánh sáng, nếp gấp vải tự nhiên. Kết quả chỉ trả về ảnh đã ghép thành công, chất lượng cao." }
      ]
    }],
    generationConfig: { response_mime_type: "image/jpeg" }
  };
  return callGemini(apiKey, payload);
};

// CHỨC NĂNG 2: KIẾN TRÚC BỐI CẢNH
export const sceneArchitect = async (apiKey: string, mainImg: string, prompt: string) => {
  const base64 = await resizeImage(mainImg);
  const payload = {
    contents: [{
      parts: [
        { inlineData: { mimeType: "image/jpeg", data: base64 } },
        { text: `Giữ nguyên chủ thể, thay đổi bối cảnh xung quanh thành: ${prompt}. Ánh sáng studio chuyên nghiệp.` }
      ]
    }]
  };
  return callGemini(apiKey, payload);
};