// Service to handle EverAI Text-to-Speech API
// Documents: https://help.everai.vn/api-docs/text-to-speech

// We use a relative path /api/everai which will be handled by:
// 1. Vite Proxy (in Local Dev)
// 2. Cloudflare Functions (in Production)
// This avoids CORS issues completely.
const API_BASE_URL = '/api/everai';

interface EverAiResponse {
  code: number;
  message: string;
  data: any;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// 1. Create TTS Request
const createRequest = async (apiKey: string, text: string, voiceCode: string) => {
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

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`EverAI Init Failed: ${response.status} - ${errorText}`);
  }

  const result: EverAiResponse = await response.json();
  if (result.code !== 200 || !result.data?.id) {
    throw new Error(result.message || "Failed to create TTS request");
  }

  return result.data.id; // Return Request ID
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
  // Statuses: "waiting", "processing", "done", "failed"
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
        
        // Fetch the actual audio blob to convert to Base64 (consistent with app architecture)
        // Note: The audioUrl provided by EverAI might also need proxying if it doesn't allow CORS.
        // Usually file storage URLs are more permissive, but let's try direct fetch first.
        try {
            const audioFileResp = await fetch(audioUrl);
            const blob = await audioFileResp.blob();
            return await blobToBase64(blob);
        } catch (e) {
            // If direct fetch fails (CORS), try via our proxy
            console.warn("Direct audio fetch failed, trying via proxy...", e);
            const proxyAudioUrl = `${API_BASE_URL}/audio-proxy?url=${encodeURIComponent(audioUrl)}`;
            const audioFileResp = await fetch(proxyAudioUrl, {
                headers: { 'Authorization': `Bearer ${apiKey}` }
            });
            const blob = await audioFileResp.blob();
            return await blobToBase64(blob);
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