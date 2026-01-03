// Cloudflare Pages Function
// Proxy strict mode to fix SSL 526 and CORS

export async function onRequest(context) {
  const { request, params } = context;
  const url = new URL(request.url);

  // 1. Xử lý Preflight (OPTIONS)
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
      },
    });
  }

  const path = params.catchall ? (Array.isArray(params.catchall) ? params.catchall.join('/') : params.catchall) : '';

  // 2. AUDIO PROXY: Tải file MP3/WAV về và trả lại cho Client (Bypass CORS)
  if (path === 'audio-proxy') {
    const targetAudioUrl = url.searchParams.get('url');
    if (!targetAudioUrl) return new Response("Missing url", { status: 400 });

    try {
      // Fetch audio without custom headers to avoid contaminating the request to S3/Storage
      const audioResponse = await fetch(targetAudioUrl);
      
      const newResponse = new Response(audioResponse.body, audioResponse);
      // Clean headers for the response to client
      newResponse.headers.set("Access-Control-Allow-Origin", "*");
      // Remove header causing issues with audio tags sometimes
      newResponse.headers.delete("Content-Security-Policy"); 
      return newResponse;
    } catch (e) {
      return new Response("Audio fetch failed", { status: 500 });
    }
  }

  // 3. API PROXY: Gọi API EverAI
  const targetUrl = `https://api.everai.vn/${path}${url.search}`;

  // TẠO HEADER MỚI (CLEAN HEADERS)
  // Quan trọng: KHÔNG set header 'Host'. Để fetch tự động xử lý SNI dựa trên targetUrl.
  // Việc set Host thủ công thường gây lỗi SSL 526 trên Cloudflare Workers.
  const newHeaders = new Headers();
  
  const allowedHeaders = ['content-type', 'authorization', 'accept'];
  for (const [key, value] of request.headers) {
    if (allowedHeaders.includes(key.toLowerCase())) {
      newHeaders.set(key, value);
    }
  }

  // Đảm bảo luôn có User-Agent để tránh bị chặn bởi firewall đơn giản
  newHeaders.set("User-Agent", "FashionAI-App/1.0");

  const newRequest = new Request(targetUrl, {
    method: request.method,
    headers: newHeaders,
    body: request.body,
    redirect: "follow",
  });

  try {
    const response = await fetch(newRequest);
    
    // Đọc body trả về
    const body = await response.arrayBuffer();

    // Tạo response trả về Client với CORS headers
    const newResponse = new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: {
        "Content-Type": response.headers.get("Content-Type") || "application/json",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
      }
    });

    return newResponse;
  } catch (e) {
    return new Response(JSON.stringify({ error: "Proxy Fetch Error: " + e.message }), { 
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
}