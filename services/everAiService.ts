// Service to handle EverAI Text-to-Speech API with Multi-Path Fallback
import { generateSpeech } from './geminiService';

const PROXY_BASE_URL = '/api/everai';
const DIRECT_BASE_URL = 'https://api.everai.vn';

interface EverAiResponse {
  code: number;
  message: string;
  data: any;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Thử gọi API qua nhiều "con đường" khác nhau
 */
const smartFetch = async (endpoint: string, options: any) => {
  // Đường 1: Qua Proxy (Ưu tiên vì xử lý được CORS)
  try {
    const proxyUrl = `${PROXY_BASE_URL}${endpoint}`;
    const response = await fetch(proxyUrl, options);
    
    // Nếu gặp lỗi 526 (SSL Proxy lỗi) hoặc lỗi Server
    if (response.status === 526 || response.status >= 500) {
      console.warn(`Proxy failed with status ${response.status}, attempting direct connection...`);
      throw new Error("Proxy SSL/Server Error");
    }
    
    return response;
  } catch (proxyError) {
    // Đường 2: Gọi TRỰC TIẾP từ trình duyệt (Bỏ qua Proxy)
    // Nếu EverAI cho phép CORS, cách này sẽ thành công dứt điểm lỗi SSL của Proxy.
    try {
      const directUrl = `${DIRECT_BASE_URL}${endpoint}`;
      const directResponse = await fetch(directUrl, {
        ...options,
        mode: 'cors' // Cố gắng yêu cầu CORS
      });
      return directResponse;
    } catch (directError) {
      throw new Error("Cả Proxy và kết nối trực tiếp đều thất bại.");
    }
  }
};

const createRequest = async (apiKey: string, text: string, voiceCode: string) => {
  const response = await smartFetch('/text-to-speech', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({ text, voice_code: voiceCode, speed: 1, pitch: 1 })
  });

  if (!response.ok) throw new Error(`EverAI API Error ${response.status}`);
  const result: EverAiResponse = await response.json();
  if (result.code !== 200 || !result.data?.id) throw new Error(result.message || "No ID");
  return result.data.id;
};

const checkStatus = async (apiKey: string, requestId: string): Promise<string> => {
  const response = await smartFetch(`/get-request?id=${requestId}`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });
  const result: EverAiResponse = await response.json();
  return result.data?.status || 'failed';
};

const getResultUrl = async (apiKey: string, requestId: string): Promise<string> => {
  const response = await smartFetch(`/get-callback-result?id=${requestId}`, {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });
  const result: EverAiResponse = await response.json();
  return result.data?.url;
};

// Main Orchestrator
export const generateSpeechEverAI = async (
    text: string, 
    voiceCode: string
): Promise<string> => {
  const everAiKey = process.env.EVERAI_API_KEY || "";
  
  try {
    console.log("EverAI: Bắt đầu quy trình tạo audio (Hybrid Mode)...");
    const requestId = await createRequest(everAiKey, text, voiceCode);
    
    let attempts = 0;
    while (attempts < 20) {
      await sleep(2000);
      const status = await checkStatus(everAiKey, requestId);
      
      if (status === 'done') {
        const audioUrl = await getResultUrl(everAiKey, requestId);
        
        // Thử tải file audio qua Proxy trước, nếu lỗi thì tải trực tiếp
        try {
          const proxyAudioUrl = `${PROXY_BASE_URL}/audio-proxy?url=${encodeURIComponent(audioUrl)}`;
          const audioRes = await fetch(proxyAudioUrl);
          if (!audioRes.ok) throw new Error("Audio proxy failed");
          const blob = await audioRes.blob();
          return await blobToBase64(blob);
        } catch (e) {
          // Tải trực tiếp file từ URL (Thường các link S3/CDN cho phép CORS)
          console.log("Tải file qua proxy lỗi, thử tải trực tiếp...");
          const directAudioRes = await fetch(audioUrl);
          const blob = await directAudioRes.blob();
          return await blobToBase64(blob);
        }
      }
      if (status === 'failed') throw new Error("EverAI báo lỗi xử lý.");
      attempts++;
    }
    throw new Error("EverAI Timeout");
    
  } catch (error: any) {
    console.error("Sự cố EverAI:", error);
    
    // NẾU CẢ EVERAI QUA PROXY VÀ TRỰC TIẾP ĐỀU LỖI
    // TỰ ĐỘNG CHUYỂN SANG GEMINI TTS NGAY LẬP TỨC
    console.warn("Tự động chuyển sang Gemini TTS làm phương án dự phòng...");
    try {
      return await generateSpeech(text, 'Kore');
    } catch (geminiError) {
      throw new Error("Không thể tạo giọng nói. Vui lòng kiểm tra lại kết nối mạng.");
    }
  }
};

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};