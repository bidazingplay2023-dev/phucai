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
      const errorText = await response.text();
      // Try to parse if it is JSON error
      try {
        const jsonError = JSON.parse(errorText);
        throw new Error(jsonError.message || `HTTP ${response.status}`);
      } catch (e) {
        // If html or plain text (like Cloudflare errors)
        console.error("Raw API Error:", errorText);
        throw new Error(`Server Error (${response.status}). Vui lòng kiểm tra lại Key hoặc thử lại sau.`);
      }
    }

    const result: EverAiResponse = await response.json();
    if (result.code !== 200 || !result.data?.id) {
      throw new Error(result.message || "Failed to create TTS request");
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

  if (!response.ok) throw new Error("EverAI Check Status Failed");

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

  if (!response.ok) throw new Error("EverAI Get Result Failed");

  const result: EverAiResponse = await response.json();
  if (result.data?.url) {
    return result.data.url;
  }
  throw new Error("No audio URL found in result");
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
    const maxAttempts = 20; // 40 seconds max (2s interval)
    
    while (attempts < maxAttempts) {
      await sleep(2000); // Wait 2s
      const status = await checkStatus(apiKey, requestId);
      console.log(`EverAI: Status polling... ${status}`);

      if (status === 'done') {
        // Step 3: Get URL
        const audioUrl = await getResultUrl(apiKey, requestId);
        console.log("Audio URL:", audioUrl);
        
        // Fetch audio data
        // Use proxy for audio file as well to avoid CORS on the file storage
        try {
            const proxyAudioUrl = `${API_BASE_URL}/audio-proxy?url=${encodeURIComponent(audioUrl)}`;
            const audioFileResp = await fetch(proxyAudioUrl, {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });
            
            if (!audioFileResp.ok) throw new Error("Failed to download audio file");
            
            const blob = await audioFileResp.blob();
            return await blobToBase64(blob);
        } catch (e) {
            console.error("Audio download failed", e);
            throw new Error("Không thể tải file audio về từ server.");
        }
      }

      if (status === 'failed') {
        throw new Error("EverAI processing failed on server side.");
      }

      attempts++;
    }

    throw new Error("EverAI Request Timeout");

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