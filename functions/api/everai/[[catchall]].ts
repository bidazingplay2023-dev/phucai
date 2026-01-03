// Cloudflare Pages Function
// This acts as a proxy to bypass CORS restrictions from the browser.
// It intercepts requests to /api/everai/* and forwards them to https://api.everai.vn/*

export async function onRequest(context) {
  const { request, params } = context;
  const url = new URL(request.url);
  
  // Extract the path after /api/everai/
  // The 'catchall' param comes from the filename [[catchall]].ts
  const path = params.catchall ? (Array.isArray(params.catchall) ? params.catchall.join('/') : params.catchall) : '';
  const query = url.search; // Keep query params like ?id=...

  const targetUrl = `https://api.everai.vn/${path}${query}`;
  console.log(`Proxying request to: ${targetUrl}`);

  // Create a new request to the target
  const newRequest = new Request(targetUrl, {
    method: request.method,
    headers: request.headers,
    body: request.body,
    redirect: 'follow',
  });

  try {
    const response = await fetch(newRequest);
    
    // Create a new response with CORS headers allowing the browser to read it
    const newResponse = new Response(response.body, response);
    
    newResponse.headers.set('Access-Control-Allow-Origin', '*');
    newResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    newResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    return newResponse;
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}

// Handle OPTIONS requests for preflight checks
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