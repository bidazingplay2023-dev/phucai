export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // Intercept requests to /api/everai and proxy them to the real API
    if (url.pathname.startsWith('/api/everai/')) {
      const targetPath = url.pathname.replace('/api/everai', '');
      const targetUrl = `https://api.everai.vn${targetPath}${url.search}`;
      
      const newRequest = new Request(targetUrl, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        redirect: 'follow'
      });
      
      try {
        const response = await fetch(newRequest);
        
        // Re-construct response to ensure we can pass it back
        const newResponse = new Response(response.body, response);
        
        // Ensure CORS headers are present (Cloudflare usually handles this for same-origin, but good to be explicit)
        newResponse.headers.set('Access-Control-Allow-Origin', '*');
        newResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        newResponse.headers.set('Access-Control-Allow-Headers', '*');
        
        return newResponse;
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }
    
    // For all other requests, serve the static assets (the React app)
    return env.ASSETS.fetch(request);
  }
};