export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // Intercept requests to /api/everai and proxy them to the real API
    if (url.pathname.startsWith('/api/everai/')) {
      // Handle CORS Preflight (OPTIONS)
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': '*',
            'Access-Control-Max-Age': '86400',
          },
        });
      }

      const targetPath = url.pathname.replace('/api/everai', '');
      // Update target URL to www.everai.vn/api based on official docs
      const targetUrl = `https://www.everai.vn/api${targetPath}${url.search}`;
      
      // Create new headers, EXCLUDING 'Host' to avoid SNI mismatch (Error 526/403)
      const newHeaders = new Headers();
      // We must remove headers that betray the proxy's origin vs the target's expectation
      const headersToExclude = ['host', 'origin', 'referer', 'cf-connecting-ip', 'cf-ipcountry', 'cf-ray', 'cf-visitor', 'x-forwarded-proto'];
      
      for (const [key, value] of request.headers) {
        if (!headersToExclude.includes(key.toLowerCase())) {
          newHeaders.set(key, value);
        }
      }

      // Explicitly set headers required by APIs if lost
      newHeaders.set('Accept', 'application/json, */*');
      
      const newRequest = new Request(targetUrl, {
        method: request.method,
        headers: newHeaders,
        body: request.body,
        redirect: 'follow'
      });
      
      try {
        const response = await fetch(newRequest);
        
        // Re-construct response to ensure we can pass it back
        const newResponse = new Response(response.body, response);
        
        // Ensure CORS headers are present on the response
        newResponse.headers.set('Access-Control-Allow-Origin', '*');
        newResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        newResponse.headers.set('Access-Control-Allow-Headers', '*');
        
        return newResponse;
      } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { 
          status: 500,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
    }
    
    // For all other requests, serve the static assets
    return env.ASSETS.fetch(request);
  }
};