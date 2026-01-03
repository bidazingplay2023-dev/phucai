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
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    });
  }

  const path = params.catchall ? (Array.isArray(params.catchall) ? params.catchall.join('/') : params.catchall) : '';

  // 2. AUDIO PROXY: Tải file MP3/WAV về và trả lại cho Client (Bypass CORS)
  if (path === 'audio-proxy') {
    const targetAudioUrl = url.searchParams.get('url');
    if (!targetAudioUrl) return new Response("Missing url", { status: 400 });

    try {
      const audioResponse = await fetch(targetAudioUrl);
      const newResponse = new Response(audioResponse.body, audioResponse);
      newResponse.headers.set("Access-Control-Allow-Origin", "*");
      return newResponse;
    } catch (e) {
      return new Response("Audio fetch failed", { status: 500 });
    }
  }

  // 3. API PROXY: Gọi API EverAI
  const targetUrl = `https://api.everai.vn/${path}${url.search}`;

  // TẠO HEADER MỚI TINH (Quan trọng để fix lỗi 526)
  // Tuyệt đối không copy toàn bộ header từ request cũ sang.
  const newHeaders = new Headers();
  
  // Chỉ lấy những cái cần thiết
  const contentType = request.headers.get("Content-Type");
  if (contentType) newHeaders.set("Content-Type", contentType);

  const auth = request.headers.get("Authorization");
  if (auth) newHeaders.set("Authorization", auth);

  // Ép buộc Host phải là api.everai.vn để khớp chứng chỉ SSL
  newHeaders.set("Host", "api.everai.vn");
  newHeaders.set("User-Agent", "FashionAI-Proxy/1.0");

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
        "Access-Control-Allow-Origin": "*", // Cho phép mọi domain
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      }
    });

    return newResponse;
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { 
        status: 500,
        headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
}