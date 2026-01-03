// Service to handle EverAI Text-to-Speech API
// Documents: https://help.everai.vn/api-docs/text-to-speech

const API_BASE_URL = '/api/everai';

interface EverAiResponse {
  code: number;
  message: string;
  data: any;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 1. Create TTS Request
const createRequest = async (apiKey: string, text: string, voiceCode: string) => {
  try {
    const response = await fetch(`${API_BASE_URL}/text-to-speech`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        text: text,
        voice_code: voiceCode,
        speed: 1,
        pitch: 1
      })
    });

    // Handle non-200 HTTP status specifically
    if (!response.ok) {
      // Check for Cloudflare specific 52x errors
      if (response.status === 526) {
         throw new Error("Lỗi kết nối SSL (526) giữa Proxy và EverAI. Vui lòng thử lại sau vài phút hoặc liên hệ quản trị viên.");
      }
      if (response.status >= 520 && response.status <= 529) {
         throw new Error(`Lỗi kết nối Server (${response.status}). Hệ thống trung gian đang gặp sự cố.`);
      }

      const errorText = await response.text();
      // Try to parse if it is JSON error
      try {
        const jsonError = JSON.parse(errorText);
        throw new Error(jsonError.message || `Lỗi API: ${response.status}`);
      } catch (e) {
        // If html or plain text
        console.error("Raw API Error Body:", errorText);
        throw new Error(`Lỗi Server (${response.status}): ${errorText.substring(0, 100)}...`);
      }
    }

    const result: EverAiResponse = await response.json();
    if (result.code !== 200 || !result.data?.id) {
      throw new Error(result.message || "Không lấy được ID yêu cầu từ EverAI.");
    }

    return result.data.id;
  } catch (err: any) {
    console.error("Create Request Error:", err);
    throw err;
  }
};

// 2. Check Status
const checkStatus = async (apiKey: string, requestId: string): Promise<string> => {
  const response = await fetch(`${API_BASE_URL}/get-request?id=${requestId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`
    }
  });

  if (!response.ok) throw new Error("Kiểm tra trạng thái thất bại.");

  const result: EverAiResponse = await response.json();
  return result.data?.status || 'failed';
};

// 3. Get Result URL
const getResultUrl = async (apiKey: string, requestId: string): Promise<string> => {
  const response = await fetch(`${API_BASE_URL}/get-callback-result?id=${requestId}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${apiKey}`
    }
  });

  if (!response.ok) throw new Error("Lấy link audio thất bại.");

  const result: EverAiResponse = await response.json();
  if (result.data?.url) {
    return result.data.url;
  }
  throw new Error("Không tìm thấy link audio trong kết quả.");
};

// Main Orchestrator Function
export const generateSpeechEverAI = async (apiKey: string, text: string, voiceCode: string): Promise<string> => {
  try {
    // Step 1: Send Request
    console.log("EverAI: Sending request...");
    const requestId = await createRequest(apiKey, text, voiceCode);
    console.log("EverAI: Request ID:", requestId);

    // Step 2: Poll for completion
    let attempts = 0;
    const maxAttempts = 30; // Increased to 60 seconds
    
    while (attempts < maxAttempts) {
      await sleep(2000); // Wait 2s
      const status = await checkStatus(apiKey, requestId);
      console.log(`EverAI: Status polling... ${status}`);

      if (status === 'done') {
        // Step 3: Get URL
        const audioUrl = await getResultUrl(apiKey, requestId);
        console.log("Audio URL:", audioUrl);
        
        // Fetch audio data via proxy
        try {
            const proxyAudioUrl = `${API_BASE_URL}/audio-proxy?url=${encodeURIComponent(audioUrl)}`;
            const audioFileResp = await fetch(proxyAudioUrl, {
                // Audio proxy generally doesn't need auth if url is public S3, but we pass if needed
                // Usually EverAI urls are public signed urls.
            });
            
            if (!audioFileResp.ok) throw new Error("Không thể tải file audio.");
            
            const blob = await audioFileResp.blob();
            return await blobToBase64(blob);
        } catch (e) {
            console.error("Audio download failed", e);
            throw new Error("Lỗi tải file âm thanh về trình duyệt.");
        }
      }

      if (status === 'failed') {
        throw new Error("EverAI báo lỗi trong quá trình xử lý.");
      }

      attempts++;
    }

    throw new Error("Quá thời gian chờ (Timeout). Vui lòng thử lại.");

  } catch (error: any) {
    console.error("EverAI Error:", error);
    throw new Error(error.message || "Lỗi tạo giọng nói EverAI.");
  }
};

const blobToBase64 = (blob: Blob): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};