// Cloudflare Pages Function Proxy - Transparent Mode

export async function onRequest(context) {
  const { request, params } = context;
  const url = new URL(request.url);
  const path = params.catchall ? (Array.isArray(params.catchall) ? params.catchall.join('/') : params.catchall) : '';

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

  // Audio Proxy specifically for CORS bypass on media files
  if (path === 'audio-proxy') {
    const targetAudioUrl = url.searchParams.get('url');
    if (!targetAudioUrl) return new Response("Missing url", { status: 400 });
    try {
      const res = await fetch(targetAudioUrl);
      const audioBody = await res.arrayBuffer();
      return new Response(audioBody, {
        headers: { 
            "Content-Type": "audio/mpeg", 
            "Access-Control-Allow-Origin": "*",
            "Cache-Control": "public, max-age=3600"
        }
      });
    } catch (e) {
      return new Response("Audio error", { status: 500 });
    }
  }

  // API Proxy - Dùng fetch tối giản nhất có thể
  const targetUrl = `https://api.everai.vn/${path}${url.search}`;
  
  const headers = new Headers();
  const auth = request.headers.get("Authorization");
  const ctype = request.headers.get("Content-Type");
  if (auth) headers.set("Authorization", auth);
  if (ctype) headers.set("Content-Type", ctype);

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers: headers,
      body: request.method === 'POST' ? await request.arrayBuffer() : null,
    });

    const data = await response.arrayBuffer();
    return new Response(data, {
      status: response.status,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message, type: "proxy_failure" }), { 
      status: 500,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" }
    });
  }
}