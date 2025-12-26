import { GoogleGenAI } from "@google/genai";
import { ImageAsset } from "../types";

// Hàm thực hiện Virtual Try-On
export const generateVirtualFit = async (
  apiKey: string,
  product: ImageAsset,
  model: ImageAsset,
  instruction?: string
): Promise<string> => {
  
  const ai = new GoogleGenAI({ apiKey });

  // System Prompt nâng cao cho Fashion
  const basePrompt = `
    Bạn là một chuyên gia AI về thời trang và xử lý hình ảnh thương mại điện tử (AI Fashion Stylist).
    Nhiệm vụ: Thực hiện "Virtual Try-On" (Thử đồ ảo).
    
    Đầu vào gồm 2 hình ảnh:
    1. Hình ảnh sản phẩm (quần áo).
    2. Hình ảnh người mẫu.

    Yêu cầu kỹ thuật:
    1. Mặc sản phẩm từ hình 1 lên người mẫu ở hình 2.
    2. Giữ nguyên màu da, khuôn mặt, kiểu tóc và ánh sáng của người mẫu gốc.
    3. Sản phẩm phải ôm theo dáng người tự nhiên (drape), có nếp gấp vải và bóng đổ (shadows) phù hợp với môi trường ánh sáng của ảnh người mẫu.
    4. Xóa phông nền của sản phẩm nếu cần thiết để ghép hình hoàn hảo.
    5. Đầu ra CHỈ là hình ảnh kết quả chất lượng cao, không bao gồm text giải thích.
    
    ${instruction ? `Yêu cầu thêm từ người dùng: ${instruction}` : ''}
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image', // Model tối ưu cho image editing/generation
      contents: {
        parts: [
          { text: basePrompt },
          {
            inlineData: {
              mimeType: product.mimeType,
              data: product.base64
            }
          },
          {
            inlineData: {
              mimeType: model.mimeType,
              data: model.base64
            }
          }
        ]
      },
      config: {
        // Đối với model sinh ảnh, ta không set responseMimeType là json
        // Output sẽ nằm trong inlineData của response
      }
    });

    // Parse Response để lấy ảnh
    // Gemini 2.5 flash image trả về ảnh trong parts
    const candidates = response.candidates;
    if (candidates && candidates.length > 0) {
      const parts = candidates[0].content.parts;
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }
    
    throw new Error("Không tìm thấy hình ảnh trong phản hồi của AI.");

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    // Kiểm tra lỗi 429 để xử lý ở tầng UI
    if (error.status === 429 || error.message?.includes('429')) {
       throw new Error("RATE_LIMIT");
    }
    throw error;
  }
};