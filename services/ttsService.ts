// API Configuration for EverAI
const API_KEY = "3D6WxRll1VWKGZWj0DF9kgjG8O3wRCzie";
// CHANGED: New Voice ID
const VOICE_ID = "voice-49df0c0d-ec91-43ed";

const ENDPOINTS = {
  PROXY_TTS: "/api/everai/tts", 
  DIRECT_TTS: "https://www.everai.vn/api/v1/tts",
  
  PROXY_CALLBACK: "/api/everai/tts/callback",
  DIRECT_CALLBACK: "https://www.everai.vn/api/v1/tts/callback"
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const generateSpeech = async (text: string): Promise<string> => {
  
  // Helper to make requests (Handles Proxy -> Fallback -> Direct)
  const safeFetch = async (endpointType: 'TTS' | 'CALLBACK', params?: any) => {
      const isPost = endpointType === 'TTS';
      
      // Construct URL based on type
      // TTS (POST): /api/v1/tts
      // CALLBACK (GET): /api/v1/tts/callback?request_id=...
      const proxyUrl = isPost 
        ? ENDPOINTS.PROXY_TTS 
        : `${ENDPOINTS.PROXY_CALLBACK}?request_id=${params}`;
        
      const directUrl = isPost 
        ? ENDPOINTS.DIRECT_TTS 
        : `${ENDPOINTS.DIRECT_CALLBACK}?request_id=${params}`;
      
      const options: RequestInit = {
          method: isPost ? 'POST' : 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`,
          },
          body: isPost ? JSON.stringify({
            input_text: text,
            voice_code: VOICE_ID,
            speed_rate: 1.0,
            audio_type: "mp3",
            bitrate: 128,
            // Explicitly requesting async processing as per documentation implication
            response_type: "indirect" 
          }) : undefined
      };

      try {
          // 1. Try via Proxy (Best for Local Dev)
          const res = await fetch(proxyUrl, options);
          if (!res.ok) throw new Error("Proxy error");
          return await res.json();
      } catch (err) {
          // 2. Fallback Direct (Best for Production/CORS extension users)
          console.warn(`Proxy ${endpointType} failed, trying direct...`);
          const res = await fetch(directUrl, options);
          if (!res.ok) {
              const txt = await res.text();
              if (txt.includes("Failed to fetch")) {
                 throw new Error("Lỗi CORS: Trình duyệt chặn kết nối. Hãy cài extension 'Allow CORS' hoặc chạy 'npm run dev'.");
              }
              throw new Error(`API Error (${res.status}): ${txt}`);
          }
          return await res.json();
      }
  };

  // --- STEP 1: SUBMIT REQUEST ---
  console.log("TTS: Submitting request...");
  const initData = await safeFetch('TTS');
  
  if (initData.status === 0) {
      throw new Error(`EverAI Error: ${initData.error_message}`);
  }

  const result = initData.result;
  
  // Check if we got lucky and got the URL immediately (Unlikely for 'indirect')
  if (result && (result.audio_url || result.file_url || result.url)) {
      return result.audio_url || result.file_url || result.url;
  }

  // --- STEP 2 & 3: POLLING FOR RESULT ---
  if (result && result.request_id) {
      const requestId = result.request_id;
      console.log(`TTS: Request queued (ID: ${requestId}). Polling for result...`);
      
      const MAX_RETRIES = 20; // 20 attempts * 3 seconds = 60 seconds max wait
      
      for (let i = 0; i < MAX_RETRIES; i++) {
          await delay(3000); // Wait 3 seconds between checks
          
          try {
             const pollData = await safeFetch('CALLBACK', requestId);
             console.log(`TTS Polling attempt ${i+1}/${MAX_RETRIES}:`, pollData);

             // Check success status
             if (pollData.status === 1 && pollData.result) {
                 const audio = pollData.result.audio_url || pollData.result.file_url || pollData.result.url;
                 if (audio) {
                     console.log("TTS: Audio URL found!", audio);
                     return audio;
                 }
             }
             // Note: If status is 1 but no URL yet, or status indicates 'processing', we continue loop.
             // If status is 0 (error), typically we should stop, but sometimes it's a temporary glitch.
             
          } catch (e) {
              console.warn("Polling error (retrying):", e);
          }
      }
      throw new Error("Quá thời gian xử lý (Timeout). Server EverAI đang bận, vui lòng thử lại sau.");
  }

  throw new Error("Không nhận được phản hồi hợp lệ (request_id) từ EverAI.");
};