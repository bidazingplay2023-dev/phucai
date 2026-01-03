// Cloudflare Pages Function
// This acts as a proxy to bypass CORS restrictions from the browser.
// It intercepts requests to /api/everai/* and forwards them to https://api.everai.vn/*

export async function onRequest(context) {
  const { request, params } = context;
  const requestUrl = new URL(request.url);

  // 1. HEADER CLEANING (QUAN TRỌNG: Sửa lỗi 526 Invalid SSL)
  // Chúng ta phải loại bỏ header 'Host' vì nó chứa domain của Cloudflare Pages (phucai.pages.dev)
  // nhưng server EverAI yêu cầu Host phải là 'api.everai.vn'.
  const proxyHeaders = new Headers();
  for (const [key, value] of request.headers) {
    const k = key.toLowerCase();
    // Loại bỏ các header định danh nguồn gây lỗi SSL/SNI
    if (!['host', 'origin', 'referer', 'cf-connecting-ip', 'cf-ipcountry', 'x-forwarded-for', 'x-forwarded-proto', 'cookie'].includes(k)) {
      proxyHeaders.append(key, value);
    }
  }

  // 2. PATH HANDLING
  const path = params.catchall ? (Array.isArray(params.catchall) ? params.catchall.join('/') : params.catchall) : '';

  // 3. SPECIAL FEATURE: Audio Proxy (Xử lý tải file MP3 bypass CORS)
  // Được gọi bởi service: /api/everai/audio-proxy?url=...
  if (path === 'audio-proxy') {
    const targetAudioUrl = requestUrl.searchParams.get('url');
    if (!targetAudioUrl) return new Response("Missing 'url' param", { status: 400 });

    try {
        // Fetch file audio gốc (thường là từ S3/Google Storage của EverAI)
        const audioResponse = await fetch(targetAudioUrl, { method: 'GET' });
        
        // Trả về file với CORS header thoải mái
        const newResponse = new Response(audioResponse.body, audioResponse);
        newResponse.headers.set('Access-Control-Allow-Origin', '*');
        return newResponse;
    } catch (e) {
        return new Response(JSON.stringify({ error: "Audio fetch failed: " + e.message }), { status: 500 });
    }
  }

  // 4. API PROXY LOGIC (Chuyển tiếp yêu cầu đến EverAI API)
  const targetUrl = `https://api.everai.vn/${path}${requestUrl.search}`;
  
  const newRequest = new Request(targetUrl, {
    method: request.method,
    headers: proxyHeaders, // Sử dụng headers đã được làm sạch
    body: request.body,
    redirect: 'follow',
  });

  try {
    const response = await fetch(newRequest);
    
    // Tạo response mới để thêm CORS headers cho trình duyệt
    const newResponse = new Response(response.body, response);
    
    newResponse.headers.set('Access-Control-Allow-Origin', '*');
    newResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    newResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    return newResponse;
  } catch (e) {
    return new Response(JSON.stringify({ error: "Proxy Error: " + e.message }), { status: 500 });
  }
}

// Xử lý preflight request (OPTIONS)
export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
}