// CẤU HÌNH PROXY (Dán link Worker của bạn vào đây)
const PROXY_URL = "https://gemini-proxy.coha.workers.dev/"; 

const callGemini = async (apiKey: string, model: string, payload: any) => {
  const response = await fetch(`${PROXY_URL}/v1beta/models/${model}:generateContent`, {
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

// GỘP BƯỚC 1 & 2: THỬ ĐỒ THÔNG MINH
export const smartFitAI = async (apiKey: string, personImg: string, productImg: string) => {
  const p64 = personImg.split(',')[1] || personImg;
  const c64 = productImg.split(',')[1] || productImg;
  
  const payload = {
    contents: [{
      parts: [
        { inlineData: { mimeType: "image/jpeg", data: p64 } },
        { inlineData: { mimeType: "image/jpeg", data: c64 } },
        { text: "Tách quần áo ở ảnh 2 và ghép vào người ở ảnh 1. Giữ nguyên ánh sáng tự nhiên." }
      ]
    }]
  };
  return callGemini(apiKey, "gemini-1.5-flash", payload);
};

// CÁC HÀM KHÁC (Bối cảnh, Video...) tương tự dùng callGemini...